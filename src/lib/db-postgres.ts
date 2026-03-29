import { neon } from "@neondatabase/serverless";
import type { Contact, Settings, Reminder, TestReminderInfo } from "./db-types";

const sql = neon(process.env.DATABASE_URL!);

export async function getContacts(userId: string): Promise<Contact[]> {
  const rows = await sql`
    SELECT * FROM contacts WHERE user_id = ${userId} ORDER BY score DESC
  `;
  return rows as Contact[];
}

export async function upsertContact(
  userId: string,
  contact: Omit<Contact, "id" | "user_id" | "created_at" | "updated_at" | "enabled">
) {
  await sql`
    INSERT INTO contacts (
      user_id, name, identifier, score, total_messages,
      sent_count, received_count, last_texted, has_birthday, birthday_date
    )
    VALUES (
      ${userId}, ${contact.name}, ${contact.identifier}, ${contact.score},
      ${contact.total_messages}, ${contact.sent_count}, ${contact.received_count},
      ${contact.last_texted}, ${contact.has_birthday}, ${contact.birthday_date}
    )
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
      updated_at = NOW()
  `;
}

export async function updateContactBirthday(userId: string, contactId: number, birthdayDate: string) {
  const rows = await sql`
    UPDATE contacts SET birthday_date = ${birthdayDate}, has_birthday = true, updated_at = NOW()
    WHERE id = ${contactId} AND user_id = ${userId}
  `;
  return rows.length;
}

export async function toggleContact(userId: string, contactId: number, enabled: boolean) {
  const rows = await sql`
    UPDATE contacts SET enabled = ${enabled}, updated_at = NOW()
    WHERE id = ${contactId} AND user_id = ${userId}
  `;
  return rows.length;
}

export async function getSettings(userId: string): Promise<Settings | null> {
  const rows = await sql`SELECT * FROM settings WHERE user_id = ${userId}`;
  return (rows[0] as Settings) ?? null;
}

export async function upsertSettings(userId: string, settings: Partial<Omit<Settings, "user_id">>) {
  await sql`
    INSERT INTO settings (user_id, send_time, threshold, default_message, phone_number)
    VALUES (
      ${userId},
      ${settings.send_time ?? "09:00"},
      ${settings.threshold ?? 0.3},
      ${settings.default_message ?? "Happy birthday!"},
      ${settings.phone_number ?? null}
    )
    ON CONFLICT (user_id) DO UPDATE SET
      send_time = COALESCE(${settings.send_time ?? null}, settings.send_time),
      threshold = COALESCE(${settings.threshold ?? null}, settings.threshold),
      default_message = COALESCE(${settings.default_message ?? null}, settings.default_message),
      phone_number = COALESCE(${settings.phone_number ?? null}, settings.phone_number),
      updated_at = NOW()
  `;
}

export async function getUserIdByEmail(email: string): Promise<string | null> {
  const rows = await sql`SELECT id FROM users WHERE email = ${email}`;
  return (rows[0]?.id as string) ?? null;
}

export async function getTodayReminders(userId: string): Promise<Reminder[]> {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const pattern = `%-${mm}-${dd}`;

  const contacts = await sql`
    SELECT id, name, birthday_date, score
    FROM contacts
    WHERE user_id = ${userId} AND enabled = true AND has_birthday = true AND birthday_date LIKE ${pattern}
    ORDER BY score DESC
  `;

  const settingsRows = await sql`SELECT default_message FROM settings WHERE user_id = ${userId}`;
  const template = (settingsRows[0]?.default_message as string) ?? "Reminder: today is {name}'s birthday!";

  return contacts.map((c) => ({
    contactId: c.id as number,
    name: c.name as string,
    message: template.replace(/\{name\}/g, c.name as string),
  }));
}

export async function getTestReminderInfo(userId: string): Promise<TestReminderInfo | null> {
  const settingsRows = await sql`
    SELECT default_message, phone_number FROM settings WHERE user_id = ${userId}
  `;
  const settings = settingsRows[0];
  if (!settings?.phone_number) return null;

  const template = (settings.default_message as string) ?? "Reminder: today is {name}'s birthday!";

  const contacts = await sql`
    SELECT name, birthday_date FROM contacts
    WHERE user_id = ${userId} AND enabled = true AND has_birthday = true
    ORDER BY score DESC
  `;

  const now = new Date();
  const thisYear = now.getFullYear();
  let testName = (contacts[0]?.name as string) ?? "Jane Doe";
  for (const c of contacts) {
    const bd = c.birthday_date as string;
    const match = bd.match(/(\d{4}|\?\?\?\?)-(\d{2})-(\d{2})/);
    if (!match) continue;
    const next = new Date(thisYear, parseInt(match[2]) - 1, parseInt(match[3]));
    if (next >= now) { testName = c.name as string; break; }
  }

  return {
    phone: settings.phone_number as string,
    message: template.replace(/\{name\}/g, testName),
    name: testName,
  };
}

// Auth adapter for Postgres
function toUser(row: Record<string, unknown> | undefined) {
  if (!row) return null;
  return {
    ...row,
    emailVerified: row.email_verified ? new Date(row.email_verified as string) : null,
  };
}

export const PgAuthAdapter = {
  async createUser(user: { email: string; name?: string | null; image?: string | null; emailVerified: Date | null }) {
    const id = crypto.randomUUID();
    await sql`
      INSERT INTO users (id, name, email, email_verified, image)
      VALUES (${id}, ${user.name ?? null}, ${user.email}, ${user.emailVerified?.toISOString() ?? null}, ${user.image ?? null})
      ON CONFLICT (email) DO NOTHING
    `;
    const rows = await sql`SELECT * FROM users WHERE email = ${user.email}`;
    return toUser(rows[0] as Record<string, unknown>);
  },
  async getUser(id: string) {
    const rows = await sql`SELECT * FROM users WHERE id = ${id}`;
    return toUser(rows[0] as Record<string, unknown> | undefined);
  },
  async getUserByEmail(email: string) {
    const rows = await sql`SELECT * FROM users WHERE email = ${email}`;
    return toUser(rows[0] as Record<string, unknown> | undefined);
  },
  async getUserByAccount({ provider, providerAccountId }: { provider: string; providerAccountId: string }) {
    const rows = await sql`
      SELECT u.* FROM users u
      JOIN accounts a ON u.id = a.user_id
      WHERE a.provider = ${provider} AND a.provider_account_id = ${providerAccountId}
    `;
    return toUser(rows[0] as Record<string, unknown> | undefined);
  },
  async updateUser(user: { id: string; name?: string | null; image?: string | null }) {
    await sql`UPDATE users SET name = ${user.name ?? null}, image = ${user.image ?? null} WHERE id = ${user.id}`;
    const rows = await sql`SELECT * FROM users WHERE id = ${user.id}`;
    return toUser(rows[0] as Record<string, unknown>);
  },
  async linkAccount(account: {
    userId: string; type: string; provider: string; providerAccountId: string;
    refresh_token?: string | null; access_token?: string | null; expires_at?: number | null;
    token_type?: string | null; scope?: string | null; id_token?: string | null; session_state?: string | null;
  }) {
    const id = crypto.randomUUID();
    await sql`
      INSERT INTO accounts (id, user_id, type, provider, provider_account_id,
        refresh_token, access_token, expires_at, token_type, scope, id_token, session_state)
      VALUES (${id}, ${account.userId}, ${account.type}, ${account.provider}, ${account.providerAccountId},
        ${account.refresh_token ?? null}, ${account.access_token ?? null}, ${account.expires_at ?? null},
        ${account.token_type ?? null}, ${account.scope ?? null}, ${account.id_token ?? null}, ${account.session_state ?? null})
      ON CONFLICT (provider, provider_account_id) DO NOTHING
    `;
  },
  async createSession(session: { sessionToken: string; userId: string; expires: Date }) {
    const id = crypto.randomUUID();
    await sql`
      INSERT INTO sessions (id, session_token, user_id, expires)
      VALUES (${id}, ${session.sessionToken}, ${session.userId}, ${session.expires.toISOString()})
    `;
    return session;
  },
  async getSessionAndUser(sessionToken: string) {
    const rows = await sql`
      SELECT s.*, u.id as uid, u.name, u.email, u.image, u.email_verified
      FROM sessions s JOIN users u ON s.user_id = u.id
      WHERE s.session_token = ${sessionToken} AND s.expires > NOW()
    `;
    const row = rows[0];
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
      await sql`UPDATE sessions SET expires = ${session.expires.toISOString()} WHERE session_token = ${session.sessionToken}`;
    }
    return session;
  },
  async deleteSession(sessionToken: string) {
    await sql`DELETE FROM sessions WHERE session_token = ${sessionToken}`;
  },
  async createVerificationToken(token: { identifier: string; token: string; expires: Date }) {
    await sql`
      INSERT INTO verification_tokens (identifier, token, expires)
      VALUES (${token.identifier}, ${token.token}, ${token.expires.toISOString()})
    `;
    return token;
  },
  async useVerificationToken({ identifier, token }: { identifier: string; token: string }) {
    const rows = await sql`
      DELETE FROM verification_tokens WHERE identifier = ${identifier} AND token = ${token}
      RETURNING *
    `;
    return (rows[0] as Record<string, unknown>) ?? null;
  },
};
