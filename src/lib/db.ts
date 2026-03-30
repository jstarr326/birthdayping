/**
 * Database layer — auto-selects SQLite (local dev) or Postgres (Vercel).
 *
 * All consumers import from this file. The backing implementation is chosen
 * at startup based on the DATABASE_URL environment variable.
 */

export type { Contact, Settings, Reminder, TestReminderInfo } from "./db-types";

import type { Contact, Settings, Reminder, TestReminderInfo } from "./db-types";

// Postgres is imported statically (always available on Vercel).
// SQLite is imported via require() so it only loads locally where
// better-sqlite3 is installed — on Vercel it's never reached.
import * as postgres from "./db-postgres";

interface DbBackend {
  getContacts(userId: string): Contact[] | Promise<Contact[]>;
  upsertContact(userId: string, contact: Omit<Contact, "id" | "user_id" | "created_at" | "updated_at" | "enabled">): void | Promise<void>;
  updateContactBirthday(userId: string, contactId: number, birthdayDate: string): number | Promise<number>;
  toggleContact(userId: string, contactId: number, enabled: boolean): number | Promise<number>;
  getSettings(userId: string): Settings | null | Promise<Settings | null>;
  upsertSettings(userId: string, settings: Partial<Omit<Settings, "user_id">>): void | Promise<void>;
  getUserIdByEmail(email: string): string | null | Promise<string | null>;
  getTodayReminders(userId: string): Reminder[] | Promise<Reminder[]>;
  getTestReminderInfo(userId: string): TestReminderInfo | null | Promise<TestReminderInfo | null>;
  isOnboardingComplete(userId: string): boolean | Promise<boolean>;
  completeOnboarding(userId: string): void | Promise<void>;
}

const isPostgres = !!process.env.DATABASE_URL;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const backend: DbBackend = isPostgres ? postgres : require("./db-sqlite");

// ── Re-export functions ─────────────────────────────────────────────

export function getContacts(userId: string) {
  return backend.getContacts(userId) as Promise<Contact[]>;
}

export function upsertContact(
  userId: string,
  contact: Omit<Contact, "id" | "user_id" | "created_at" | "updated_at" | "enabled">
) {
  return backend.upsertContact(userId, contact) as Promise<void>;
}

export function updateContactBirthday(userId: string, contactId: number, birthdayDate: string) {
  return backend.updateContactBirthday(userId, contactId, birthdayDate) as Promise<number>;
}

export function toggleContact(userId: string, contactId: number, enabled: boolean) {
  return backend.toggleContact(userId, contactId, enabled) as Promise<number>;
}

export function getSettings(userId: string) {
  return backend.getSettings(userId) as Promise<Settings | null>;
}

export function upsertSettings(userId: string, settings: Partial<Omit<Settings, "user_id">>) {
  return backend.upsertSettings(userId, settings) as Promise<void>;
}

export function getUserIdByEmail(email: string) {
  return backend.getUserIdByEmail(email) as Promise<string | null>;
}

export function getTodayReminders(userId: string) {
  return backend.getTodayReminders(userId) as Promise<Reminder[]>;
}

export function getTestReminderInfo(userId: string) {
  return backend.getTestReminderInfo(userId) as Promise<TestReminderInfo | null>;
}

export function isOnboardingComplete(userId: string) {
  return backend.isOnboardingComplete(userId) as Promise<boolean>;
}

export function completeOnboarding(userId: string) {
  return backend.completeOnboarding(userId) as Promise<void>;
}
