import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateContactBirthday } from "@/lib/db";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const contactId = parseInt(id);
  if (isNaN(contactId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const { birthday_date } = await req.json();
  if (!birthday_date || !/^\d{4}-\d{2}-\d{2}$/.test(birthday_date)) {
    return NextResponse.json({ error: "birthday_date must be YYYY-MM-DD" }, { status: 400 });
  }

  const rowCount = await updateContactBirthday(session.user.id, contactId, birthday_date);
  if (!rowCount) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
