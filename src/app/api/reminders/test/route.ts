import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTestReminderInfo } from "@/lib/db";
import { execSync } from "child_process";

// POST /api/reminders/test
// Sends a real test iMessage to the user's phone number via osascript.
// Only works when the Next.js server is running locally on a Mac.

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

  const { phone, message } = info;

  // Send via osascript (local Mac only)
  const escaped = message.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const script = `tell application "Messages" to send "${escaped}" to buddy "${phone}"`;

  try {
    execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
      timeout: 15000,
    });
    return NextResponse.json({ sent: true, message, phone });
  } catch (e) {
    const err = e as { stderr?: Buffer };
    const stderr = err.stderr?.toString().trim() ?? "Unknown error";
    return NextResponse.json(
      { error: `osascript failed: ${stderr}` },
      { status: 500 }
    );
  }
}
