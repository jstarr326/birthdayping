import { Pool } from "pg";
import type { Contact, Settings, Reminder, TestReminderInfo } from "./db-types";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
});

async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const { rows } = await pool.query(text, params);
  return rows as T[];
}

async function queryOne<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

async function execute(text: string, params: unknown[] = []): Promise<number> {
  const { rowCount } = await pool.query(text, params);
  return rowCount ?? 0;
}

// ── App functions ───────────────────────────────────────────────────

export async function getContacts(userId: string): Promise<Contact[]> {
  return query<Contact>(
    "SELECT * FROM contacts WHERE user_id = $1 ORDER BY score DESC",
    [userId]
  );
}

export async function upsertContact(
  userId: string,
  contact: Omit<Contact, "id" | "user_id" | "created_at" | "updated_at" | "enabled">
) {
  await execute(
    `INSERT INTO contacts (
      user_id, name, identifier, score, total_messages,
      sent_count, received_count, last_texted, has_birthday, birthday_date
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (user_id, identifier) DO UPDATE SET
      name = EXCLUDED.name,
      score = EXCLUDED.score,
      total_messages = EXCLUDED.total_messages,
      sent_count = EXCLUDED.sent_count,
      received_count = EXCLUDED.received_count,
      last_texted = EXCLUDED.last_texted,
      birthday_date = COALESCE(contacts.birthday_date, EXCLUDED.birthday_date),
      has_birthday = CASE
        WHEN COALESCE(contacts.birthday_date, EXCLUDED.birthday_date) IS NOT NULL THEN true
        ELSE false
      END,
      updated_at = NOW()`,
    [
      userId, contact.name, contact.identifier, contact.score,
      contact.total_messages, contact.sent_count, contact.received_count,
      contact.last_texted, contact.has_birthday, contact.birthday_date,
    ]
  );
}

export async function updateContactBirthday(userId: string, contactId: number, birthdayDate: string) {
  return execute(
    "UPDATE contacts SET birthday_date = $1, has_birthday = true, updated_at = NOW() WHERE id = $2 AND user_id = $3",
    [birthdayDate, contactId, userId]
  );
}

export async function toggleContact(userId: string, contactId: number, enabled: boolean) {
  return execute(
    "UPDATE contacts SET enabled = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3",
    [enabled, contactId, userId]
  );
}

export async function getSettings(userId: string): Promise<Settings | null> {
  return queryOne<Settings>("SELECT * FROM settings WHERE user_id = $1", [userId]);
}

export async function upsertSettings(userId: string, settings: Partial<Omit<Settings, "user_id">>) {
  await execute(
    `INSERT INTO settings (user_id, send_time, threshold, default_message, phone_number)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE SET
       send_time = COALESCE($6, settings.send_time),
       threshold = COALESCE($7, settings.threshold),
       default_message = COALESCE($8, settings.default_message),
       phone_number = COALESCE($9, settings.phone_number),
       updated_at = NOW()`,
    [
      userId,
      settings.send_time ?? "09:00",
      settings.threshold ?? 0.3,
      settings.default_message ?? "Happy birthday!",
      settings.phone_number ?? null,
      settings.send_time ?? null,
      settings.threshold ?? null,
      settings.default_message ?? null,
      settings.phone_number ?? null,
    ]
  );
}

export async function getUserIdByEmail(email: string): Promise<string | null> {
  const row = await queryOne<{ id: string }>("SELECT id FROM users WHERE email = $1", [email]);
  return row?.id ?? null;
}

export async function getTodayReminders(userId: string): Promise<Reminder[]> {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const pattern = `%-${mm}-${dd}`;

  const contacts = await query<{ id: number; name: string }>(
    `SELECT id, name FROM contacts
     WHERE user_id = $1 AND enabled = true AND has_birthday = true AND birthday_date LIKE $2
     ORDER BY score DESC`,
    [userId, pattern]
  );

  const settings = await queryOne<{ default_message: string }>(
    "SELECT default_message FROM settings WHERE user_id = $1",
    [userId]
  );
  const template = settings?.default_message ?? "Reminder: today is {name}'s birthday!";

  return contacts.map((c) => ({
    contactId: c.id,
    name: c.name,
    message: template.replace(/\{name\}/g, c.name),
  }));
}

export async function getTestReminderInfo(userId: string): Promise<TestReminderInfo | null> {
  const settings = await queryOne<{ default_message: string; phone_number: string | null }>(
    "SELECT default_message, phone_number FROM settings WHERE user_id = $1",
    [userId]
  );
  if (!settings?.phone_number) return null;

  const template = settings.default_message ?? "Reminder: today is {name}'s birthday!";

  const contacts = await query<{ name: string; birthday_date: string }>(
    `SELECT name, birthday_date FROM contacts
     WHERE user_id = $1 AND enabled = true AND has_birthday = true
     ORDER BY score DESC`,
    [userId]
  );

  const now = new Date();
  const thisYear = now.getFullYear();
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

// ── Auth adapter ────────────────────────────────────────────────────

function toUser(row: Record<string, unknown> | undefined | null) {
  if (!row) return null;
  // NextAuth expects { id, name, email, emailVerified, image } — map from Postgres columns
  return {
    id: row.id as string,
    name: (row.name as string) ?? null,
    email: row.email as string,
    emailVerified: row.email_verified ? new Date(row.email_verified as string) : null,
    image: (row.image as string) ?? null,
  };
}

export const PgAuthAdapter = {
  async createUser(user: { email: string; name?: string | null; image?: string | null; emailVerified: Date | null }) {
    const id = crypto.randomUUID();
    console.log("[PgAuthAdapter.createUser] creating:", { id, email: user.email });
    await execute(
      `INSERT INTO users (id, name, email, email_verified, image)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO NOTHING`,
      [id, user.name ?? null, user.email, user.emailVerified?.toISOString() ?? null, user.image ?? null]
    );
    const result = toUser(await queryOne("SELECT * FROM users WHERE email = $1", [user.email]));
    console.log("[PgAuthAdapter.createUser] returning:", result);
    return result;
  },
  async getUser(id: string) {
    return toUser(await queryOne("SELECT * FROM users WHERE id = $1", [id]));
  },
  async getUserByEmail(email: string) {
    return toUser(await queryOne("SELECT * FROM users WHERE email = $1", [email]));
  },
  async getUserByAccount({ provider, providerAccountId }: { provider: string; providerAccountId: string }) {
    return toUser(await queryOne(
      `SELECT u.* FROM users u JOIN accounts a ON u.id = a.user_id
       WHERE a.provider = $1 AND a.provider_account_id = $2`,
      [provider, providerAccountId]
    ));
  },
  async updateUser(user: { id: string; name?: string | null; image?: string | null }) {
    await execute("UPDATE users SET name = $1, image = $2 WHERE id = $3", [user.name ?? null, user.image ?? null, user.id]);
    return toUser(await queryOne("SELECT * FROM users WHERE id = $1", [user.id]));
  },
  async linkAccount(account: {
    userId: string; type: string; provider: string; providerAccountId: string;
    refresh_token?: string | null; access_token?: string | null; expires_at?: number | null;
    token_type?: string | null; scope?: string | null; id_token?: string | null; session_state?: string | null;
  }) {
    const id = crypto.randomUUID();
    console.log("[PgAuthAdapter.linkAccount] linking:", { userId: account.userId, provider: account.provider });
    await execute(
      `INSERT INTO accounts (id, user_id, type, provider, provider_account_id,
        refresh_token, access_token, expires_at, token_type, scope, id_token, session_state)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (provider, provider_account_id) DO NOTHING`,
      [
        id, account.userId, account.type, account.provider, account.providerAccountId,
        account.refresh_token ?? null, account.access_token ?? null, account.expires_at ?? null,
        account.token_type ?? null, account.scope ?? null, account.id_token ?? null, account.session_state ?? null,
      ]
    );
    console.log("[PgAuthAdapter.linkAccount] done");
  },
  async createSession(session: { sessionToken: string; userId: string; expires: Date }) {
    try {
      const id = crypto.randomUUID();
      const expiresStr = session.expires instanceof Date
        ? session.expires.toISOString()
        : String(session.expires);
      console.log("[PgAuthAdapter.createSession] input:", { sessionToken: session.sessionToken, userId: session.userId, expires: expiresStr });
      const { rows } = await pool.query(
        "INSERT INTO sessions (id, session_token, user_id, expires) VALUES ($1, $2, $3, $4) RETURNING session_token, user_id, expires",
        [id, session.sessionToken, session.userId, expiresStr]
      );
      const row = rows[0];
      console.log("[PgAuthAdapter.createSession] RETURNING row:", row);
      if (!row) {
        console.error("[PgAuthAdapter.createSession] INSERT RETURNING returned no rows!");
        return { sessionToken: session.sessionToken, userId: session.userId, expires: session.expires };
      }
      const result = {
        sessionToken: row.session_token,
        userId: row.user_id,
        expires: new Date(row.expires),
      };
      console.log("[PgAuthAdapter.createSession] returning:", result);
      return result;
    } catch (err) {
      console.error("[PgAuthAdapter.createSession] ERROR:", err);
      throw err;
    }
  },
  async getSessionAndUser(sessionToken: string) {
    const row = await queryOne<Record<string, unknown>>(
      `SELECT s.*, u.id as uid, u.name, u.email, u.image, u.email_verified
       FROM sessions s JOIN users u ON s.user_id = u.id
       WHERE s.session_token = $1 AND s.expires > NOW()`,
      [sessionToken]
    );
    if (!row) return null;
    return {
      session: {
        sessionToken: row.session_token as string,
        userId: row.user_id as string,
        expires: new Date(row.expires as string),
      },
      user: {
        id: row.uid as string,
        name: row.name as string,
        email: row.email as string,
        image: row.image as string,
        emailVerified: row.email_verified ? new Date(row.email_verified as string) : null,
      },
    };
  },
  async updateSession(session: { sessionToken: string; expires?: Date }) {
    if (session.expires) {
      await execute(
        "UPDATE sessions SET expires = $1 WHERE session_token = $2",
        [session.expires.toISOString(), session.sessionToken]
      );
    }
    return session;
  },
  async deleteSession(sessionToken: string) {
    await execute("DELETE FROM sessions WHERE session_token = $1", [sessionToken]);
  },
  async createVerificationToken(token: { identifier: string; token: string; expires: Date }) {
    await execute(
      "INSERT INTO verification_tokens (identifier, token, expires) VALUES ($1, $2, $3)",
      [token.identifier, token.token, token.expires.toISOString()]
    );
    return token;
  },
  async useVerificationToken({ identifier, token }: { identifier: string; token: string }) {
    const row = await queryOne(
      "DELETE FROM verification_tokens WHERE identifier = $1 AND token = $2 RETURNING *",
      [identifier, token]
    );
    return row ?? null;
  },
};
