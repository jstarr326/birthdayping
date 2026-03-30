import { NextRequest, NextResponse } from "next/server";
import { getUserIdByEmail, getTodayReminders, getSettings } from "@/lib/db";
import { sendSms } from "@/lib/twilio";

// POST /api/reminders/send
// Checks for birthdays today and sends SMS reminders via Twilio.
// Called by Vercel Cron or manually. Protected by SYNC_API_KEY or CRON_SECRET.

export async function POST(req: NextRequest) {
  // Auth: accept SYNC_API_KEY or CRON_SECRET as Bearer token
  // Vercel cron sends: Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.get("authorization");
  const token = auth?.replace("Bearer ", "");
  const validSyncKey = token && token === process.env.SYNC_API_KEY;
  const validCron = token && token === process.env.CRON_SECRET;

  if (!validSyncKey && !validCron) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // For cron jobs, we need to know which user to send for.
  // For now, use x-user-email header or send for all users with phone numbers.
  const userEmail = req.headers.get("x-user-email");

  if (userEmail) {
    // Single-user mode (manual trigger or specific cron)
    const result = await sendForUser(userEmail);
    return NextResponse.json(result);
  }

  // Multi-user mode: Vercel cron sends for ALL users with phone numbers + birthdays today
  // Query all users who have settings with a phone number
  const results = await sendForAllUsers();
  return NextResponse.json(results);
}

async function sendForUser(email: string) {
  const userId = await getUserIdByEmail(email);
  if (!userId) return { error: "User not found", sent: 0 };

  const settings = await getSettings(userId);
  if (!settings?.phone_number) return { error: "No phone number configured", sent: 0 };

  const reminders = await getTodayReminders(userId);
  if (reminders.length === 0) return { sent: 0, message: "No birthdays today" };

  const results = [];
  let sent = 0;

  for (const r of reminders) {
    const result = await sendSms(settings.phone_number, r.message);
    results.push({ name: r.name, ...result });
    if (result.success) sent++;
    console.log(`[reminders/send] ${r.name}: ${result.success ? "sent" : "failed"} — ${result.error ?? result.sid}`);
  }

  return { sent, total: reminders.length, results };
}

async function sendForAllUsers() {
  // Import pg pool directly for the multi-user query
  // This only runs on Vercel where DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    return { error: "Multi-user mode requires DATABASE_URL", sent: 0 };
  }

  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const pattern = `%-${mm}-${dd}`;

    // Find all users who have a phone number and at least one birthday today
    const { rows: users } = await pool.query(`
      SELECT DISTINCT s.user_id, s.phone_number, s.default_message, u.email
      FROM settings s
      JOIN users u ON s.user_id = u.id
      JOIN contacts c ON c.user_id = s.user_id
      WHERE s.phone_number IS NOT NULL
        AND s.reminder_method = 'sms'
        AND c.enabled = true
        AND c.has_birthday = true
        AND c.birthday_date LIKE $1
    `, [pattern]);

    let totalSent = 0;
    const userResults = [];

    for (const user of users) {
      const { rows: contacts } = await pool.query(`
        SELECT id, name FROM contacts
        WHERE user_id = $1 AND enabled = true AND has_birthday = true AND birthday_date LIKE $2
        ORDER BY score DESC
      `, [user.user_id, pattern]);

      const template = user.default_message ?? "Reminder: today is {name}'s birthday!";

      for (const c of contacts) {
        const message = template.replace(/\{name\}/g, c.name);
        const result = await sendSms(user.phone_number, message);
        console.log(`[reminders/send] ${user.email} → ${c.name}: ${result.success ? "sent" : "failed"}`);
        if (result.success) totalSent++;
        userResults.push({ email: user.email, name: c.name, success: result.success });
      }
    }

    return {
      date: `${now.getFullYear()}-${mm}-${dd}`,
      usersChecked: users.length,
      sent: totalSent,
      results: userResults,
    };
  } finally {
    await pool.end();
  }
}
