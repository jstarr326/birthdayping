import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/reminders/today
// Returns contacts with birthdays today (month+day match) and reminders enabled.
// Auth: Bearer token (SYNC_API_KEY) — called by the Mac utility, not the browser.

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth || auth !== `Bearer ${process.env.SYNC_API_KEY}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userEmail = req.headers.get("x-user-email");
  if (!userEmail) {
    return NextResponse.json({ error: "Missing x-user-email header" }, { status: 400 });
  }

  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(userEmail) as
    | { id: string }
    | undefined;
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Get current month/day and build the ????-MM-DD pattern
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const pattern = `%-${mm}-${dd}`;

  const contacts = db
    .prepare(
      `SELECT id, name, identifier, birthday_date, score
       FROM contacts
       WHERE user_id = ?
         AND enabled = 1
         AND has_birthday = 1
         AND birthday_date LIKE ?
       ORDER BY score DESC`
    )
    .all(user.id, pattern) as {
    id: number;
    name: string;
    identifier: string;
    birthday_date: string;
    score: number;
  }[];

  // Get the user's default message template
  const settings = db
    .prepare("SELECT default_message FROM settings WHERE user_id = ?")
    .get(user.id) as { default_message: string } | undefined;

  const template = settings?.default_message ?? "Reminder: today is {name}'s birthday!";

  const reminders = contacts.map((c) => ({
    contactId: c.id,
    name: c.name,
    message: template.replace(/\{name\}/g, c.name),
  }));

  return NextResponse.json({ date: `${now.getFullYear()}-${mm}-${dd}`, reminders });
}
