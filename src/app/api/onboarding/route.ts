import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getContacts, getSettings, upsertSettings, completeOnboarding } from "@/lib/db";

// GET — check sync status (how many contacts)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contacts = await getContacts(session.user.id);
  const settings = await getSettings(session.user.id);

  return NextResponse.json({
    contactCount: contacts.length,
    hasBirthdayCount: contacts.filter((c) => c.has_birthday).length,
    threshold: settings?.threshold ?? 0.3,
  });
}

// PUT — save threshold choice and mark onboarding complete
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  if (body.threshold !== undefined) {
    await upsertSettings(session.user.id, { threshold: body.threshold });
  }

  if (body.complete) {
    await completeOnboarding(session.user.id);
  }

  return NextResponse.json({ ok: true });
}
