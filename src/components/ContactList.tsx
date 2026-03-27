"use client";

import { useState } from "react";
import type { Contact } from "@/lib/db";

function Toggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
        enabled ? "bg-green-500" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 70
      ? "bg-green-100 text-green-800"
      : pct >= 40
      ? "bg-blue-100 text-blue-800"
      : "bg-gray-100 text-gray-600";
  return (
    <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${color}`}>
      {pct}
    </span>
  );
}

function ContactRow({
  contact,
  onToggle,
  onBirthdaySet,
}: {
  contact: Contact;
  onToggle: (id: number, enabled: boolean) => void;
  onBirthdaySet: (id: number, date: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [dateInput, setDateInput] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSaveBirthday = async () => {
    if (!dateInput) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${contact.id}/birthday`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birthday_date: dateInput }),
      });
      if (res.ok) {
        onBirthdaySet(contact.id, dateInput);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (enabled: boolean) => {
    onToggle(contact.id, enabled);
    await fetch(`/api/contacts/${contact.id}/toggle`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
  };

  return (
    <div className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-0">
      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 truncate">{contact.name}</span>
          <ScoreBadge score={contact.score} />
        </div>
        <div className="text-xs text-gray-400 mt-0.5 flex gap-3">
          <span>{contact.total_messages.toLocaleString()} msgs</span>
          {contact.last_texted && <span>last {contact.last_texted}</span>}
        </div>
      </div>

      {/* Birthday */}
      <div className="w-44 text-sm">
        {contact.birthday_date ? (
          <span className="text-gray-600">{contact.birthday_date}</span>
        ) : editing ? (
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={handleSaveBirthday}
              disabled={saving || !dateInput}
              className="text-xs text-blue-600 font-medium hover:text-blue-800 disabled:opacity-40"
            >
              {saving ? "…" : "Save"}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-blue-500 hover:text-blue-700 font-medium"
          >
            + Add birthday
          </button>
        )}
      </div>

      {/* Toggle */}
      <div className="shrink-0">
        <Toggle enabled={contact.enabled} onChange={handleToggle} />
      </div>
    </div>
  );
}

export default function ContactList({
  contacts: initialContacts,
}: {
  contacts: Contact[];
}) {
  const [contacts, setContacts] = useState(initialContacts);

  const handleToggle = (id: number, enabled: boolean) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, enabled } : c))
    );
  };

  const handleBirthdaySet = (id: number, date: string) => {
    setContacts((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, birthday_date: date, has_birthday: true } : c
      )
    );
  };

  const hasBirthday = contacts.filter((c) => c.has_birthday);
  const missingBirthday = contacts.filter((c) => !c.has_birthday);

  return (
    <div className="space-y-8">
      {/* Has birthday */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800">
            Has birthday
            <span className="ml-2 text-sm font-normal text-gray-400">
              ({hasBirthday.length})
            </span>
          </h2>
          <span className="text-xs text-gray-400">Reminder on/off</span>
        </div>
        {hasBirthday.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            No contacts with birthdays yet. Sync from your Mac or add them below.
          </p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 px-4">
            {hasBirthday.map((c) => (
              <ContactRow
                key={c.id}
                contact={c}
                onToggle={handleToggle}
                onBirthdaySet={handleBirthdaySet}
              />
            ))}
          </div>
        )}
      </section>

      {/* Missing birthday */}
      <section>
        <div className="mb-3">
          <h2 className="font-semibold text-gray-800">
            Missing birthday
            <span className="ml-2 text-sm font-normal text-gray-400">
              ({missingBirthday.length})
            </span>
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            You talk to these people a lot. Add their birthday?
          </p>
        </div>
        {missingBirthday.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            All your top contacts have birthdays.
          </p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 px-4">
            {missingBirthday.map((c) => (
              <ContactRow
                key={c.id}
                contact={c}
                onToggle={handleToggle}
                onBirthdaySet={handleBirthdaySet}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
