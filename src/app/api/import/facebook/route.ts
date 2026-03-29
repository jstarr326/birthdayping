import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getContacts, updateContactBirthday } from "@/lib/db";
import { parseIcs, parseCsv } from "@/lib/ics-parser";
import { matchBirthdays } from "@/lib/name-matcher";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const text = await file.text();
  const fileName = file.name.toLowerCase();

  let birthdays;
  if (fileName.endsWith(".ics") || fileName.endsWith(".ical")) {
    birthdays = parseIcs(text);
  } else if (fileName.endsWith(".csv")) {
    birthdays = parseCsv(text);
  } else {
    return NextResponse.json(
      { error: "Unsupported file type. Upload a .ics or .csv file." },
      { status: 400 }
    );
  }

  if (birthdays.length === 0) {
    return NextResponse.json(
      { error: "No birthdays found in file. Check the format and try again." },
      { status: 400 }
    );
  }

  const contacts = await getContacts(session.user.id);
  const matches = matchBirthdays(birthdays, contacts);

  // Auto-apply exact matches immediately
  let applied = 0;
  for (const { birthday, contact } of matches.exact) {
    // Only update if contact doesn't already have a birthday
    if (!contact.birthday_date) {
      const dateStr = `????-${String(birthday.month).padStart(2, "0")}-${String(birthday.day).padStart(2, "0")}`;
      await updateContactBirthday(session.user.id, contact.id, dateStr);
      applied++;
    }
  }

  return NextResponse.json({
    parsed: birthdays.length,
    exact: matches.exact.map((m) => ({
      name: m.birthday.name,
      contactName: m.contact.name,
      contactId: m.contact.id,
      month: m.birthday.month,
      day: m.birthday.day,
      alreadyHad: !!m.contact.birthday_date,
    })),
    close: matches.close.map((m) => ({
      name: m.birthday.name,
      contactName: m.contact.name,
      contactId: m.contact.id,
      month: m.birthday.month,
      day: m.birthday.day,
      reason: m.reason,
      alreadyHad: !!m.contact.birthday_date,
    })),
    unmatched: matches.unmatched.map((b) => ({
      name: b.name,
      month: b.month,
      day: b.day,
    })),
    applied,
  });
}

// Confirm close matches — user accepts specific ones
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as {
    confirmations: { contactId: number; month: number; day: number }[];
  };

  if (!Array.isArray(body.confirmations)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  let confirmed = 0;
  for (const { contactId, month, day } of body.confirmations) {
    const dateStr = `????-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const changes = await updateContactBirthday(session.user.id, contactId, dateStr);
    if (changes) confirmed++;
  }

  return NextResponse.json({ confirmed });
}
