import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSettings, upsertSettings } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getSettings(session.user.id);
  return NextResponse.json(
    settings ?? { send_time: "09:00", threshold: 0.3, default_message: "Happy birthday!" }
  );
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  await upsertSettings(session.user.id, {
    send_time: body.send_time,
    threshold: body.threshold,
    default_message: body.default_message,
    phone_number: body.phone_number,
  });

  return NextResponse.json({ ok: true });
}
