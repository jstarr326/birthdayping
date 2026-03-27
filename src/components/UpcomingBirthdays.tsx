"use client";

import type { Contact } from "@/lib/db";

function getDaysUntilBirthday(birthdayDate: string): number | null {
  // Handle ????-MM-DD (no year stored)
  const match = birthdayDate.match(/(\d{4}|\?\?\?\?)-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, , month, day] = match;

  const today = new Date();
  const thisYear = today.getFullYear();

  let next = new Date(thisYear, parseInt(month) - 1, parseInt(day));
  if (next < today) {
    next = new Date(thisYear + 1, parseInt(month) - 1, parseInt(day));
  }

  const diffMs = next.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function formatBirthday(birthdayDate: string): string {
  const match = birthdayDate.match(/(\d{4}|\?\?\?\?)-(\d{2})-(\d{2})/);
  if (!match) return birthdayDate;
  const [, , month, day] = match;
  const date = new Date(2000, parseInt(month) - 1, parseInt(day));
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

export default function UpcomingBirthdays({ contacts }: { contacts: Contact[] }) {
  const upcoming = contacts
    .filter((c) => c.has_birthday && c.birthday_date && c.enabled)
    .map((c) => ({
      ...c,
      daysUntil: getDaysUntilBirthday(c.birthday_date!),
    }))
    .filter((c) => c.daysUntil !== null && c.daysUntil <= 30)
    .sort((a, b) => a.daysUntil! - b.daysUntil!);

  if (upcoming.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
      <h2 className="text-sm font-semibold text-amber-800 uppercase tracking-wide mb-3">
        Upcoming — next 30 days
      </h2>
      <div className="space-y-2">
        {upcoming.map((c) => (
          <div key={c.id} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎂</span>
              <span className="font-medium text-gray-900">{c.name}</span>
              <span className="text-sm text-gray-500">{formatBirthday(c.birthday_date!)}</span>
            </div>
            <span className="text-sm font-medium text-amber-700">
              {c.daysUntil === 0
                ? "Today!"
                : c.daysUntil === 1
                ? "Tomorrow"
                : `in ${c.daysUntil} days`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
