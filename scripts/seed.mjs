/**
 * Seed the database from contacts_ranked.json.
 * Creates a local dev user and inserts contacts.
 *
 * Run: node scripts/seed.mjs
 */

import Database from "better-sqlite3";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_PATH ?? resolve(__dirname, "../local.db");
const db = new Database(dbPath);

db.pragma("foreign_keys = ON");

const ranked = JSON.parse(
  readFileSync(resolve(__dirname, "../contacts_ranked.json"), "utf8")
);

const DEV_USER_ID = "dev-user-local";
const DEV_USER_EMAIL = "dev@localhost";

// Upsert dev user
db.prepare(`
  INSERT INTO users (id, name, email)
  VALUES (?, ?, ?)
  ON CONFLICT (email) DO NOTHING
`).run(DEV_USER_ID, "Dev User", DEV_USER_EMAIL);
console.log(`✓ Dev user: ${DEV_USER_EMAIL} (id: ${DEV_USER_ID})`);

const contacts = [
  ...(ranked.has_birthday ?? []),
  ...(ranked.missing_birthday ?? []),
];

const upsert = db.prepare(`
  INSERT INTO contacts (
    user_id, name, identifier, score, total_messages,
    sent_count, received_count, last_texted, has_birthday, birthday_date
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (user_id, identifier) DO UPDATE SET
    score = excluded.score,
    total_messages = excluded.total_messages,
    updated_at = datetime('now')
`);

const insertMany = db.transaction((contacts) => {
  let inserted = 0;
  for (const c of contacts) {
    if (!c.name || !c.identifier) continue;
    upsert.run(
      DEV_USER_ID, c.name, c.identifier, c.score ?? 0,
      c.total_messages ?? 0, c.sent_count ?? 0, c.received_count ?? 0,
      c.last_texted ?? null, c.has_birthday ? 1 : 0, c.birthday_date ?? null
    );
    inserted++;
  }
  return inserted;
});

const inserted = insertMany(contacts);
console.log(`✓ Seeded ${inserted} contacts`);

db.close();
