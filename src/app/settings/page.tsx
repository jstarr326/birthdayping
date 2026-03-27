"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Settings = {
  send_time: string;
  threshold: number;
  default_message: string;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    send_time: "09:00",
    threshold: 0.3,
    default_message: "Happy birthday!",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setSettings(data);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">
            ← Dashboard
          </Link>
          <span className="font-semibold text-gray-900">Settings</span>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">

          {/* Reminder time */}
          <div className="p-5 flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-gray-900 text-sm">Reminder send time</p>
              <p className="text-xs text-gray-400 mt-0.5">
                When the Mac utility texts you on birthdays
              </p>
            </div>
            <input
              type="time"
              value={settings.send_time}
              onChange={(e) => setSettings({ ...settings, send_time: e.target.value })}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Score threshold */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-medium text-gray-900 text-sm">Score threshold</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Minimum relationship score to show a contact
                </p>
              </div>
              <span className="text-sm font-mono font-medium text-gray-700">
                {settings.threshold.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.threshold}
              onChange={(e) =>
                setSettings({ ...settings, threshold: parseFloat(e.target.value) })
              }
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Show everyone</span>
              <span>Only closest</span>
            </div>
          </div>

          {/* Default message */}
          <div className="p-5">
            <p className="font-medium text-gray-900 text-sm mb-1">
              Default reminder message
            </p>
            <p className="text-xs text-gray-400 mb-3">
              The reminder the Mac utility texts YOU on someone&apos;s birthday. Not sent to the contact.
            </p>
            <textarea
              value={settings.default_message}
              onChange={(e) =>
                setSettings({ ...settings, default_message: e.target.value })
              }
              rows={3}
              placeholder="e.g. Reminder: today is {name}'s birthday!"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              Use <code className="bg-gray-100 px-1 rounded">{"{name}"}</code> to insert the contact&apos;s name.
            </p>
          </div>

          {/* Test reminder */}
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 text-sm">Test reminder</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Preview what the reminder text will look like
                </p>
              </div>
              <button
                onClick={async () => {
                  setTesting(true);
                  setTestResult(null);
                  try {
                    const res = await fetch("/api/reminders/test", { method: "POST" });
                    const data = await res.json();
                    setTestResult(data.message);
                  } catch {
                    setTestResult("Failed to generate test reminder");
                  } finally {
                    setTesting(false);
                  }
                }}
                disabled={testing}
                className="text-sm text-blue-600 font-medium hover:text-blue-800 disabled:opacity-50"
              >
                {testing ? "Loading…" : "Send test"}
              </button>
            </div>
            {testResult && (
              <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-xs text-green-600 font-medium mb-1">Preview:</p>
                <p className="text-sm text-green-800">{testResult}</p>
              </div>
            )}
          </div>

          {/* Save */}
          <div className="p-5 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saved ? "Saved!" : saving ? "Saving…" : "Save settings"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
