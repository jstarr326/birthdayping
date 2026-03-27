import Database from "better-sqlite3";
import path from "path";

const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "local.db");
const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export { db };

export type Contact = {
  id: number;
  user_id: string;
  name: string;
  identifier: string;
  score: number;
  total_messages: number;
  sent_count: number;
  received_count: number;
  last_texted: string | null;
  has_birthday: boolean;
  birthday_date: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

// SQLite stores booleans as 0/1 — convert raw rows to Contact type
type RawContact = Omit<Contact, "has_birthday" | "enabled"> & { has_birthday: number; enabled: number };
function toContact(row: RawContact): Contact {
  return { ...row, has_birthday: !!row.has_birthday, enabled: !!row.enabled };
}

export type Settings = {
  user_id: string;
  send_time: string;
  threshold: number;
  default_message: string;
};

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE NOT NULL,
      email_verified TEXT,
      image TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      refresh_token TEXT,
      access_token TEXT,
      expires_at INTEGER,
      token_type TEXT,
      scope TEXT,
      id_token TEXT,
      session_state TEXT,
      UNIQUE(provider, provider_account_id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      session_token TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS verification_tokens (
      identifier TEXT NOT NULL,
      token TEXT NOT NULL,
      expires TEXT NOT NULL,
      PRIMARY KEY (identifier, token)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      identifier TEXT NOT NULL,
      score REAL DEFAULT 0,
      total_messages INTEGER DEFAULT 0,
      sent_count INTEGER DEFAULT 0,
      received_count INTEGER DEFAULT 0,
      last_texted TEXT,
      has_birthday INTEGER DEFAULT 0,
      birthday_date TEXT,
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, identifier)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      send_time TEXT DEFAULT '09:00',
      threshold REAL DEFAULT 0.3,
      default_message TEXT DEFAULT 'Happy birthday!',
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
}

export function getContacts(userId: string): Contact[] {
  const rows = db.prepare(`
    SELECT * FROM contacts
    WHERE user_id = ?
    ORDER BY score DESC
  `).all(userId) as RawContact[];
  return rows.map(toContact);
}

export function upsertContact(
  userId: string,
  contact: Omit<Contact, "id" | "user_id" | "created_at" | "updated_at" | "enabled">
) {
  db.prepare(`
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

export function updateContactBirthday(
  userId: string,
  contactId: number,
  birthdayDate: string
) {
  const result = db.prepare(`
    UPDATE contacts
    SET birthday_date = ?, has_birthday = 1, updated_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `).run(birthdayDate, contactId, userId);
  return result.changes;
}

export function toggleContact(
  userId: string,
  contactId: number,
  enabled: boolean
) {
  const result = db.prepare(`
    UPDATE contacts
    SET enabled = ?, updated_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `).run(enabled ? 1 : 0, contactId, userId);
  return result.changes;
}

export function getSettings(userId: string): Settings | null {
  const row = db.prepare(`
    SELECT * FROM settings WHERE user_id = ?
  `).get(userId) as Settings | undefined;
  return row ?? null;
}

export function upsertSettings(
  userId: string,
  settings: Partial<Omit<Settings, "user_id">>
) {
  db.prepare(`
    INSERT INTO settings (user_id, send_time, threshold, default_message)
    VALUES (?, ?, ?, ?)
    ON CONFLICT (user_id) DO UPDATE SET
      send_time = COALESCE(?, settings.send_time),
      threshold = COALESCE(?, settings.threshold),
      default_message = COALESCE(?, settings.default_message),
      updated_at = datetime('now')
  `).run(
    userId,
    settings.send_time ?? "09:00",
    settings.threshold ?? 0.3,
    settings.default_message ?? "Happy birthday!",
    settings.send_time ?? null,
    settings.threshold ?? null,
    settings.default_message ?? null
  );
}
