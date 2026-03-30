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

function ScoreBadge({ score, manual }: { score: number; manual?: boolean }) {
  if (manual) {
    return (
      <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
        Manual
      </span>
    );
  }
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

function formatBirthday(dateStr: string): string {
  // dateStr is "YYYY-MM-DD" where YYYY might be "????" or "0000"
  const parts = dateStr.split("-");
  if (parts.length < 3) return dateStr;
  const month = parseInt(parts[1]);
  const day = parseInt(parts[2]);
  if (isNaN(month) || isNaN(day)) return dateStr;
  const date = new Date(2000, month - 1, day);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function MonthDayPicker({
  onSave,
  onCancel,
}: {
  onSave: (month: number, day: number) => void;
  onCancel: () => void;
}) {
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);

  const daysInMonth = new Date(2000, month, 0).getDate();

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={month}
        onChange={(e) => {
          const m = parseInt(e.target.value);
          setMonth(m);
          const maxDay = new Date(2000, m, 0).getDate();
          if (day > maxDay) setDay(maxDay);
        }}
        className="border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {MONTH_NAMES.map((name, i) => (
          <option key={i} value={i + 1}>{name}</option>
        ))}
      </select>
      <select
        value={day}
        onChange={(e) => setDay(parseInt(e.target.value))}
        className="border border-gray-300 rounded px-1.5 py-1 text-xs w-14 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {Array.from({ length: daysInMonth }, (_, i) => (
          <option key={i} value={i + 1}>{i + 1}</option>
        ))}
      </select>
      <button
        onClick={() => onSave(month, day)}
        className="text-xs text-blue-600 font-medium hover:text-blue-800"
      >
        Save
      </button>
      <button
        onClick={onCancel}
        className="text-xs text-gray-400 hover:text-gray-600"
      >
        Cancel
      </button>
    </div>
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
  const [saving, setSaving] = useState(false);
  const isManual = contact.score === 0 && contact.total_messages === 0;

  const handleSaveBirthday = async (month: number, day: number) => {
    setSaving(true);
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    const birthday_date = `0000-${mm}-${dd}`;
    try {
      const res = await fetch(`/api/contacts/${contact.id}/birthday`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birthday_date }),
      });
      if (res.ok) {
        onBirthdaySet(contact.id, birthday_date);
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
          <ScoreBadge score={contact.score} manual={isManual} />
        </div>
        {!isManual && (
          <div className="text-xs text-gray-400 mt-0.5 flex gap-3">
            <span>{contact.total_messages.toLocaleString()} msgs</span>
            {contact.last_texted && <span>last {contact.last_texted}</span>}
          </div>
        )}
      </div>

      {/* Birthday */}
      <div className="w-44 text-sm">
        {contact.birthday_date ? (
          <span className="text-gray-600">{formatBirthday(contact.birthday_date)}</span>
        ) : editing ? (
          saving ? (
            <span className="text-xs text-gray-400">Saving...</span>
          ) : (
            <MonthDayPicker
              onSave={handleSaveBirthday}
              onCancel={() => setEditing(false)}
            />
          )
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

function AddContactForm({
  onAdd,
}: {
  onAdd: (contact: Contact) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const daysInMonth = new Date(2000, month, 0).getDate();

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);

    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");

    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          birthday_date: `0000-${mm}-${dd}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to add contact");
        return;
      }
      onAdd(data.contact);
      setName("");
      setMonth(1);
      setDay(1);
      setOpen(false);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-blue-600 font-medium hover:text-blue-800"
      >
        + Add contact manually
      </button>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-sm font-medium text-gray-900 mb-3">Add a contact</p>
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="First Last"
            className="border border-gray-300 rounded px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Birthday</label>
          <div className="flex gap-1.5">
            <select
              value={month}
              onChange={(e) => {
                const m = parseInt(e.target.value);
                setMonth(m);
                const maxDay = new Date(2000, m, 0).getDate();
                if (day > maxDay) setDay(maxDay);
              }}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {MONTH_NAMES.map((n, i) => (
                <option key={i} value={i + 1}>{n}</option>
              ))}
            </select>
            <select
              value={day}
              onChange={(e) => setDay(parseInt(e.target.value))}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm w-16 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {Array.from({ length: daysInMonth }, (_, i) => (
                <option key={i} value={i + 1}>{i + 1}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={saving || !name.trim()}
          className="bg-blue-600 text-white text-sm font-medium px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Adding..." : "Add"}
        </button>
        <button
          onClick={() => { setOpen(false); setError(null); }}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}

function isUnknownContact(contact: Contact): boolean {
  return contact.name.startsWith("Unknown —") || contact.name.startsWith("Unknown —");
}

export default function ContactList({
  contacts: initialContacts,
}: {
  contacts: Contact[];
}) {
  const [contacts, setContacts] = useState(initialContacts);
  const [showUnknown, setShowUnknown] = useState(false);

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

  const handleAddContact = (contact: Contact) => {
    setContacts((prev) => [...prev, contact]);
  };

  const knownContacts = contacts.filter((c) => !isUnknownContact(c));
  const unknownContacts = contacts.filter((c) => isUnknownContact(c));

  const hasBirthday = knownContacts.filter((c) => c.has_birthday);
  const missingBirthday = knownContacts.filter((c) => !c.has_birthday);
  const unknownWithBirthday = unknownContacts.filter((c) => c.has_birthday);
  const unknownMissing = unknownContacts.filter((c) => !c.has_birthday);

  const totalWithBirthday = hasBirthday.length + unknownWithBirthday.length;
  const totalContacts = contacts.length;
  const coveragePct = totalContacts > 0 ? Math.round((totalWithBirthday / totalContacts) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Coverage bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-green-500 h-2 rounded-full transition-all"
            style={{ width: `${coveragePct}%` }}
          />
        </div>
        <span className="text-xs text-gray-500 font-medium whitespace-nowrap">
          {coveragePct}% coverage
        </span>
      </div>

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

      {/* Add contact manually */}
      <section>
        <AddContactForm onAdd={handleAddContact} />
      </section>

      {/* Unknown contacts */}
      {unknownContacts.length > 0 && (
        <section>
          <button
            onClick={() => setShowUnknown(!showUnknown)}
            className="text-xs text-gray-400 hover:text-gray-600 font-medium"
          >
            {showUnknown ? "Hide" : "Show"} {unknownContacts.length} unknown contact{unknownContacts.length !== 1 ? "s" : ""}
          </button>
          {showUnknown && (
            <div className="mt-3 bg-white rounded-xl border border-gray-200 px-4">
              {[...unknownWithBirthday, ...unknownMissing].map((c) => (
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
      )}
    </div>
  );
}
