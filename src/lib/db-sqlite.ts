import Database from "better-sqlite3";
import path from "path";

const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "local.db");
const sqliteDb = new Database(dbPath);

sqliteDb.pragma("journal_mode = WAL");
sqliteDb.pragma("foreign_keys = ON");

// Export raw db for the auth adapter (SQLite-only, local dev)
export { sqliteDb };

import type { Contact, Settings, Reminder, TestReminderInfo } from "./db-types";

// SQLite stores booleans as 0/1
type RawContact = Omit<Contact, "has_birthday" | "enabled"> & { has_birthday: number; enabled: number };
function toContact(row: RawContact): Contact {
  return { ...row, has_birthday: !!row.has_birthday, enabled: !!row.enabled };
}

export function getContacts(userId: string): Contact[] {
  const rows = sqliteDb.prepare(
    "SELECT * FROM contacts WHERE user_id = ? ORDER BY score DESC"
  ).all(userId) as RawContact[];
  return rows.map(toContact);
}

export function upsertContact(
  userId: string,
  contact: Omit<Contact, "id" | "user_id" | "created_at" | "updated_at" | "enabled">
) {
  sqliteDb.prepare(`
    INSERT INTO contacts (
      user_id, name, identifier, score, total_messages,
      sent_count, received_count, last_texted, has_birthday, birthday_date
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (user_id, identifier) DO UPDATE SET
      name = excluded.name,
      score = excluded.score,
      total_messages = excluded.total_messages,
      sent_count = excluded.sent_count,
      received_count = excluded.received_count,
      last_texted = excluded.last_texted,
      birthday_date = COALESCE(contacts.birthday_date, excluded.birthday_date),
      has_birthday = CASE
        WHEN COALESCE(contacts.birthday_date, excluded.birthday_date) IS NOT NULL THEN 1
        ELSE 0
      END,
      updated_at = datetime('now')
  `).run(
    userId, contact.name, contact.identifier, contact.score,
    contact.total_messages, contact.sent_count, contact.received_count,
    contact.last_texted, contact.has_birthday ? 1 : 0, contact.birthday_date
  );
}

export function updateContactBirthday(userId: string, contactId: number, birthdayDate: string) {
  const result = sqliteDb.prepare(
    "UPDATE contacts SET birthday_date = ?, has_birthday = 1, updated_at = datetime('now') WHERE id = ? AND user_id = ?"
  ).run(birthdayDate, contactId, userId);
  return result.changes;
}

export function toggleContact(userId: string, contactId: number, enabled: boolean) {
  const result = sqliteDb.prepare(
    "UPDATE contacts SET enabled = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?"
  ).run(enabled ? 1 : 0, contactId, userId);
  return result.changes;
}

export function getSettings(userId: string): Settings | null {
  const row = sqliteDb.prepare("SELECT * FROM settings WHERE user_id = ?").get(userId) as Settings | undefined;
  return row ?? null;
}

export function upsertSettings(userId: string, settings: Partial<Omit<Settings, "user_id">>) {
  sqliteDb.prepare(`
    INSERT INTO settings (user_id, send_time, threshold, default_message, phone_number)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (user_id) DO UPDATE SET
      send_time = COALESCE(?, settings.send_time),
      threshold = COALESCE(?, settings.threshold),
      default_message = COALESCE(?, settings.default_message),
      phone_number = COALESCE(?, settings.phone_number),
      updated_at = datetime('now')
  `).run(
    userId,
    settings.send_time ?? "09:00",
    settings.threshold ?? 0.3,
    settings.default_message ?? "Happy birthday!",
    settings.phone_number ?? null,
    settings.send_time ?? null,
    settings.threshold ?? null,
    settings.default_message ?? null,
    settings.phone_number ?? null
  );
}

export function getUserIdByEmail(email: string): string | null {
  const row = sqliteDb.prepare("SELECT id FROM users WHERE email = ?").get(email) as { id: string } | undefined;
  return row?.id ?? null;
}

export function getTodayReminders(userId: string): Reminder[] {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const pattern = `%-${mm}-${dd}`;

  const contacts = sqliteDb.prepare(`
    SELECT id, name, birthday_date, score
    FROM contacts
    WHERE user_id = ? AND enabled = 1 AND has_birthday = 1 AND birthday_date LIKE ?
    ORDER BY score DESC
  `).all(userId, pattern) as { id: number; name: string; birthday_date: string; score: number }[];

  const settings = sqliteDb.prepare("SELECT default_message FROM settings WHERE user_id = ?")
    .get(userId) as { default_message: string } | undefined;
  const template = settings?.default_message ?? "Reminder: today is {name}'s birthday!";

  return contacts.map((c) => ({
    contactId: c.id,
    name: c.name,
    message: template.replace(/\{name\}/g, c.name),
  }));
}

export function getTestReminderInfo(userId: string): TestReminderInfo | null {
  const settings = sqliteDb.prepare("SELECT default_message, phone_number FROM settings WHERE user_id = ?")
    .get(userId) as { default_message: string; phone_number: string | null } | undefined;

  if (!settings?.phone_number) return null;

  const template = settings.default_message ?? "Reminder: today is {name}'s birthday!";

  const now = new Date();
  const thisYear = now.getFullYear();
  const contacts = sqliteDb.prepare(`
    SELECT name, birthday_date FROM contacts
    WHERE user_id = ? AND enabled = 1 AND has_birthday = 1
    ORDER BY score DESC
  `).all(userId) as { name: string; birthday_date: string }[];

  // Find next upcoming birthday
  let testName = contacts[0]?.name ?? "Jane Doe";
  for (const c of contacts) {
    const match = c.birthday_date.match(/(\d{4}|\?\?\?\?)-(\d{2})-(\d{2})/);
    if (!match) continue;
    const next = new Date(thisYear, parseInt(match[2]) - 1, parseInt(match[3]));
    if (next >= now) { testName = c.name; break; }
  }

  return {
    phone: settings.phone_number,
    message: template.replace(/\{name\}/g, testName),
    name: testName,
  };
}

export function isOnboardingComplete(userId: string): boolean {
  const row = sqliteDb.prepare("SELECT onboarding_complete FROM settings WHERE user_id = ?")
    .get(userId) as { onboarding_complete: number } | undefined;
  return !!row?.onboarding_complete;
}

export function completeOnboarding(userId: string): void {
  sqliteDb.prepare(`
    INSERT INTO settings (user_id, onboarding_complete)
    VALUES (?, 1)
    ON CONFLICT (user_id) DO UPDATE SET onboarding_complete = 1, updated_at = datetime('now')
  `).run(userId);
}
