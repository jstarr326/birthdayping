/**
 * Initialize the Postgres database schema on Vercel/Neon.
 * Run: DATABASE_URL=postgres://... node scripts/init-db-postgres.mjs
 */

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Set DATABASE_URL to your Neon/Postgres connection string");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

console.log("Initializing Postgres schema...");

await sql`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE NOT NULL,
    email_verified TIMESTAMPTZ,
    image TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`;

await sql`
  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_account_id TEXT NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at INT,
    token_type TEXT,
    scope TEXT,
    id_token TEXT,
    session_state TEXT,
    UNIQUE(provider, provider_account_id)
  )
`;

await sql`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    session_token TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires TIMESTAMPTZ NOT NULL
  )
`;

await sql`
  CREATE TABLE IF NOT EXISTS verification_tokens (
    identifier TEXT NOT NULL,
    token TEXT NOT NULL,
    expires TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (identifier, token)
  )
`;

await sql`
  CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    identifier TEXT NOT NULL,
    score FLOAT DEFAULT 0,
    total_messages INT DEFAULT 0,
    sent_count INT DEFAULT 0,
    received_count INT DEFAULT 0,
    last_texted DATE,
    has_birthday BOOLEAN DEFAULT false,
    birthday_date TEXT,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, identifier)
  )
`;

await sql`
  CREATE TABLE IF NOT EXISTS settings (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    send_time TEXT DEFAULT '09:00',
    threshold FLOAT DEFAULT 0.3,
    default_message TEXT DEFAULT 'Happy birthday!',
    phone_number TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )
`;

console.log("✓ Postgres schema ready");
