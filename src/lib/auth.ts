import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const isPostgres = !!process.env.DATABASE_URL;

// ── Build the right adapter ─────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let adapter: any;

if (isPostgres) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PgAuthAdapter } = require("./db-postgres");
  adapter = PgAuthAdapter;
} else {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { sqliteDb } = require("./db-sqlite");
  const db = sqliteDb;

  function toUser(row: Record<string, unknown> | undefined) {
    if (!row) return null;
    return { ...row, emailVerified: row.email_verified ? new Date(row.email_verified as string) : null };
  }

  adapter = {
    async createUser(user: { email: string; name?: string | null; image?: string | null; emailVerified: Date | null }) {
      const id = crypto.randomUUID();
      db.prepare(`
        INSERT INTO users (id, name, email, email_verified, image)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (email) DO NOTHING
      `).run(id, user.name ?? null, user.email, user.emailVerified?.toISOString() ?? null, user.image ?? null);
      return toUser(db.prepare("SELECT * FROM users WHERE email = ?").get(user.email) as Record<string, unknown>);
    },
    async getUser(id: string) {
      return toUser(db.prepare("SELECT * FROM users WHERE id = ?").get(id) as Record<string, unknown> | undefined);
    },
    async getUserByEmail(email: string) {
      return toUser(db.prepare("SELECT * FROM users WHERE email = ?").get(email) as Record<string, unknown> | undefined);
    },
    async getUserByAccount({ provider, providerAccountId }: { provider: string; providerAccountId: string }) {
      return toUser(db.prepare(`
        SELECT u.* FROM users u JOIN accounts a ON u.id = a.user_id
        WHERE a.provider = ? AND a.provider_account_id = ?
      `).get(provider, providerAccountId) as Record<string, unknown> | undefined);
    },
    async updateUser(user: { id: string; name?: string | null; image?: string | null }) {
      db.prepare("UPDATE users SET name = ?, image = ? WHERE id = ?").run(user.name ?? null, user.image ?? null, user.id);
      return toUser(db.prepare("SELECT * FROM users WHERE id = ?").get(user.id) as Record<string, unknown>);
    },
    async linkAccount(account: {
      userId: string; type: string; provider: string; providerAccountId: string;
      refresh_token?: string | null; access_token?: string | null; expires_at?: number | null;
      token_type?: string | null; scope?: string | null; id_token?: string | null; session_state?: string | null;
    }) {
      const id = crypto.randomUUID();
      db.prepare(`
        INSERT INTO accounts (id, user_id, type, provider, provider_account_id,
          refresh_token, access_token, expires_at, token_type, scope, id_token, session_state)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (provider, provider_account_id) DO NOTHING
      `).run(
        id, account.userId, account.type, account.provider, account.providerAccountId,
        account.refresh_token ?? null, account.access_token ?? null, account.expires_at ?? null,
        account.token_type ?? null, account.scope ?? null, account.id_token ?? null, account.session_state ?? null
      );
    },
    async createSession(session: { sessionToken: string; userId: string; expires: Date }) {
      const id = crypto.randomUUID();
      db.prepare("INSERT INTO sessions (id, session_token, user_id, expires) VALUES (?, ?, ?, ?)")
        .run(id, session.sessionToken, session.userId, session.expires.toISOString());
      return session;
    },
    async getSessionAndUser(sessionToken: string) {
      const row = db.prepare(`
        SELECT s.*, u.id as uid, u.name, u.email, u.image, u.email_verified
        FROM sessions s JOIN users u ON s.user_id = u.id
        WHERE s.session_token = ? AND s.expires > datetime('now')
      `).get(sessionToken) as Record<string, unknown> | undefined;
      if (!row) return null;
      return {
        session: { sessionToken: row.session_token as string, userId: row.user_id as string, expires: new Date(row.expires as string) },
        user: { id: row.uid as string, name: row.name as string, email: row.email as string, image: row.image as string, emailVerified: row.email_verified ? new Date(row.email_verified as string) : null },
      };
    },
    async updateSession(session: { sessionToken: string; expires?: Date }) {
      if (session.expires) {
        db.prepare("UPDATE sessions SET expires = ? WHERE session_token = ?").run(session.expires.toISOString(), session.sessionToken);
      }
      return session;
    },
    async deleteSession(sessionToken: string) {
      db.prepare("DELETE FROM sessions WHERE session_token = ?").run(sessionToken);
    },
    async createVerificationToken(token: { identifier: string; token: string; expires: Date }) {
      db.prepare("INSERT INTO verification_tokens (identifier, token, expires) VALUES (?, ?, ?)")
        .run(token.identifier, token.token, token.expires.toISOString());
      return token;
    },
    async useVerificationToken({ identifier, token }: { identifier: string; token: string }) {
      const row = db.prepare("SELECT * FROM verification_tokens WHERE identifier = ? AND token = ?").get(identifier, token);
      if (row) db.prepare("DELETE FROM verification_tokens WHERE identifier = ? AND token = ?").run(identifier, token);
      return row ?? null;
    },
  };
}

// ── Providers ───────────────────────────────────────────────────────

import CredentialsProvider from "next-auth/providers/credentials";

const devProviders = process.env.NODE_ENV === "development" && !isPostgres
  ? [
      CredentialsProvider({
        id: "dev",
        name: "Dev Login",
        credentials: {},
        async authorize() {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { sqliteDb } = require("./db-sqlite");
          const row = sqliteDb.prepare("SELECT * FROM users WHERE email = 'dev@localhost'").get() as Record<string, unknown> | undefined;
          return row ? { id: row.id as string, email: row.email as string, name: row.name as string } : null;
        },
      }),
    ]
  : [];

export const authOptions: NextAuthOptions = {
  adapter,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "placeholder",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "placeholder",
    }),
    ...devProviders,
  ],
  session: { strategy: "database" },
  debug: process.env.NODE_ENV === "development" || !!process.env.NEXTAUTH_DEBUG,
  callbacks: {
    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
};

export default NextAuth(authOptions);
