import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// POST /api/reminders/test
// Returns a test reminder payload so the settings page can trigger a test iMessage.
// Uses the first enabled contact with a birthday, or a placeholder name.

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = db
    .prepare("SELECT default_message FROM settings WHERE user_id = ?")
    .get(session.user.id) as { default_message: string } | undefined;

  const template = settings?.default_message ?? "Reminder: today is {name}'s birthday!";

  // Pick a real contact name for the test
  const sample = db
    .prepare(
      `SELECT name FROM contacts
       WHERE user_id = ? AND enabled = 1 AND has_birthday = 1
       ORDER BY score DESC LIMIT 1`
    )
    .get(session.user.id) as { name: string } | undefined;

  const name = sample?.name ?? "Jane Doe";
  const message = template.replace(/\{name\}/g, name);

  return NextResponse.json({ message, name });
}
