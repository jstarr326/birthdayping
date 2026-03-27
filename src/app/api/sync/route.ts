import { NextRequest, NextResponse } from "next/server";
import { db, upsertContact } from "@/lib/db";

// The Mac utility posts to this endpoint with contacts_ranked.json data.
// Auth: Bearer token (SYNC_API_KEY env var) + user lookup by email.

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth || auth !== `Bearer ${process.env.SYNC_API_KEY}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userEmail = req.headers.get("x-user-email");
  if (!userEmail) {
    return NextResponse.json({ error: "Missing x-user-email header" }, { status: 400 });
  }

  const user = db.prepare(`SELECT id FROM users WHERE email = ?`).get(userEmail) as { id: string } | undefined;
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const userId = user.id;

  let body: { has_birthday?: unknown[]; missing_birthday?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const contacts = [
    ...(Array.isArray(body.has_birthday) ? body.has_birthday : []),
    ...(Array.isArray(body.missing_birthday) ? body.missing_birthday : []),
  ];

  let synced = 0;
  for (const c of contacts) {
    const contact = c as {
      name: string;
      identifier: string;
      score: number;
      total_messages: number;
      sent_count: number;
      received_count: number;
      last_texted: string | null;
      has_birthday: boolean;
      birthday_date: string | null;
    };
    if (!contact.name || !contact.identifier) continue;
    upsertContact(userId, {
      name: contact.name,
      identifier: contact.identifier,
      score: contact.score ?? 0,
      total_messages: contact.total_messages ?? 0,
      sent_count: contact.sent_count ?? 0,
      received_count: contact.received_count ?? 0,
      last_texted: contact.last_texted ?? null,
      has_birthday: contact.has_birthday ?? false,
      birthday_date: contact.birthday_date ?? null,
    });
    synced++;
  }

  return NextResponse.json({ synced });
}
