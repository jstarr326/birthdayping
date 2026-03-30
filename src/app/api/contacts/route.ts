import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getContacts, upsertContact } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contacts = await getContacts(session.user.id);
  return NextResponse.json(contacts);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, birthday_date } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!birthday_date || !/^\d{4}-\d{2}-\d{2}$/.test(birthday_date)) {
    return NextResponse.json({ error: "birthday_date must be YYYY-MM-DD" }, { status: 400 });
  }

  const identifier = `manual:${name.trim().toLowerCase()}`;

  await upsertContact(session.user.id, {
    name: name.trim(),
    identifier,
    score: 0,
    total_messages: 0,
    sent_count: 0,
    received_count: 0,
    last_texted: null,
    has_birthday: true,
    birthday_date,
  });

  // Fetch the newly created contact to return it with its ID
  const contacts = await getContacts(session.user.id);
  const created = contacts.find((c) => c.identifier === identifier);

  if (!created) {
    return NextResponse.json({ error: "Failed to create contact" }, { status: 500 });
  }

  return NextResponse.json({ contact: created }, { status: 201 });
}
