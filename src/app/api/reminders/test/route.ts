import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTestReminderInfo, getSettings } from "@/lib/db";
import { sendSms } from "@/lib/twilio";

// POST /api/reminders/test
// Sends a test reminder via the user's chosen method (SMS or iMessage).

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const info = await getTestReminderInfo(session.user.id);
  if (!info) {
    return NextResponse.json(
      { error: "Set your phone number above first" },
      { status: 400 }
    );
  }

  const settings = await getSettings(session.user.id);
  const method = settings?.reminder_method ?? "sms";
  const { phone, message } = info;

  if (method === "sms") {
    const result = await sendSms(phone, message);
    if (result.success) {
      return NextResponse.json({ sent: true, method: "sms", message, phone });
    }
    return NextResponse.json(
      { error: `Twilio: ${result.error}` },
      { status: 500 }
    );
  }

  // iMessage via osascript (local Mac only)
  try {
    const { execSync } = await import("child_process");
    const escaped = message.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const script = `tell application "Messages" to send "${escaped}" to buddy "${phone}"`;
    execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { timeout: 15000 });
    return NextResponse.json({ sent: true, method: "imessage", message, phone });
  } catch (e) {
    const err = e as { stderr?: Buffer };
    const stderr = err.stderr?.toString().trim() ?? "Unknown error";
    return NextResponse.json(
      { error: `osascript failed: ${stderr}` },
      { status: 500 }
    );
  }
}
