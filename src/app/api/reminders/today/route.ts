import { NextRequest, NextResponse } from "next/server";
import { getUserIdByEmail, getTodayReminders } from "@/lib/db";

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

  const userId = await getUserIdByEmail(userEmail);
  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  const reminders = await getTodayReminders(userId);

  return NextResponse.json({ date: `${now.getFullYear()}-${mm}-${dd}`, reminders });
}
