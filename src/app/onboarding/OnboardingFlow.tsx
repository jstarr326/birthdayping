"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Contact } from "@/lib/db";
import BirthdayImport from "@/components/BirthdayImport";

type Step = "welcome" | "setup" | "threshold" | "import" | "done";

export default function OnboardingFlow({
  contactCount: initialContactCount,
  contacts,
}: {
  contactCount: number;
  contacts: Contact[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialContactCount > 0 ? "threshold" : "welcome");
  const [contactCount, setContactCount] = useState(initialContactCount);
  const [checking, setChecking] = useState(false);
  const [threshold, setThreshold] = useState(0.3);
  const [saving, setSaving] = useState(false);

  const checkSync = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/onboarding");
      const data = await res.json();
      setContactCount(data.contactCount);
      if (data.contactCount > 0) setStep("threshold");
    } finally {
      setChecking(false);
    }
  }, []);

  const saveThresholdAndContinue = async () => {
    setSaving(true);
    await fetch("/api/onboarding", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threshold }),
    });
    setSaving(false);
    setStep("import");
  };

  const finishOnboarding = async () => {
    setSaving(true);
    await fetch("/api/onboarding", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ complete: true }),
    });
    router.push("/dashboard");
  };

  // Count contacts at each threshold tier
  const countAbove = (t: number) => contacts.filter((c) => c.score >= t).length;
  const presets = [
    { label: "Top ~20 closest", value: getThresholdForCount(contacts, 20) },
    { label: "Top ~50", value: getThresholdForCount(contacts, 50) },
    { label: "Everyone synced", value: 0 },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm max-w-lg w-full">

        {/* Progress bar */}
        <div className="px-8 pt-6">
          <div className="flex gap-1.5">
            {(["welcome", "setup", "threshold", "import", "done"] as Step[]).map((s, i) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full ${
                  i <= ["welcome", "setup", "threshold", "import", "done"].indexOf(step)
                    ? "bg-blue-500"
                    : "bg-gray-200"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="p-8">

          {/* ── Step 1: Welcome ── */}
          {step === "welcome" && (
            <div>
              <div className="text-4xl mb-4">🎂</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Welcome to BirthdayPing
              </h1>
              <p className="text-gray-600 mb-6 leading-relaxed">
                BirthdayPing figures out who you actually talk to and reminds
                you of their birthdays. No more forgetting the people who
                matter most.
              </p>
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Privacy first
                </p>
                <p className="text-sm text-gray-500 leading-relaxed">
                  We read who you text and how often — never what you say.
                  Your message content never leaves your Mac. The Mac utility
                  is{" "}
                  <a
                    href="https://github.com/jstarr326/birthdayping"
                    className="text-blue-600 underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    open source
                  </a>{" "}
                  so you can verify this yourself.
                </p>
              </div>
              <button
                onClick={() => setStep("setup")}
                className="w-full bg-blue-600 text-white font-medium py-3 rounded-xl hover:bg-blue-700 transition-colors"
              >
                Get Started
              </button>
            </div>
          )}

          {/* ── Step 2: Setup & Permissions ── */}
          {step === "setup" && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                Set up the Mac utility
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                The Mac utility scans your iMessage metadata and syncs
                contact scores to BirthdayPing.
              </p>

              {/* Download */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
                <p className="text-sm font-medium text-blue-800 mb-2">
                  1. Download and run the Mac utility
                </p>
                <pre className="bg-white rounded-lg p-3 text-xs text-gray-700 overflow-x-auto">
{`git clone https://github.com/jstarr326/birthdayping.git
cd birthdayping
python3 core_engine.py
python3 scripts/sync.py`}</pre>
              </div>

              {/* Permissions checklist */}
              <div className="space-y-3 mb-6">
                <PermissionItem
                  title="Full Disk Access"
                  description="Required to read iMessage metadata from chat.db"
                  instructions="System Settings → Privacy & Security → Full Disk Access → add Terminal (or your IDE)"
                />
                <PermissionItem
                  title="Contacts access"
                  description="Required to match phone numbers to contact names"
                  instructions="System Settings → Privacy & Security → Contacts → allow Terminal"
                />
                <PermissionItem
                  title="Automation permission"
                  description="Required to send you birthday reminder texts via Messages"
                  instructions='System Settings → Privacy & Security → Automation → allow Terminal to control "Messages"'
                />
              </div>

              {contactCount > 0 ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                  <p className="text-sm text-green-800 font-medium">
                    {contactCount} contacts synced
                  </p>
                </div>
              ) : (
                <p className="text-xs text-gray-400 mb-4">
                  Run the utility first, then click below to continue.
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep("welcome")}
                  className="text-sm text-gray-500 hover:text-gray-700 px-4 py-3"
                >
                  Back
                </button>
                {contactCount > 0 ? (
                  <button
                    onClick={() => setStep("threshold")}
                    className="flex-1 bg-blue-600 text-white font-medium py-3 rounded-xl hover:bg-blue-700 transition-colors"
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    onClick={checkSync}
                    disabled={checking}
                    className="flex-1 bg-gray-900 text-white font-medium py-3 rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors"
                  >
                    {checking
                      ? "Checking..."
                      : "I've run the utility — check for contacts"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Step 3: Threshold ── */}
          {step === "threshold" && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                Who should you get reminders for?
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Choose how many of your{" "}
                <span className="font-medium text-gray-700">
                  {contactCount}
                </span>{" "}
                contacts you want birthday reminders for. You can always
                toggle individuals on or off later.
              </p>

              <div className="space-y-2 mb-6">
                {presets.map((p) => {
                  const count = countAbove(p.value);
                  const selected =
                    Math.abs(threshold - p.value) < 0.01;
                  return (
                    <button
                      key={p.label}
                      onClick={() => setThreshold(p.value)}
                      className={`w-full text-left p-4 rounded-xl border transition-colors ${
                        selected
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span
                          className={`text-sm font-medium ${
                            selected
                              ? "text-blue-700"
                              : "text-gray-700"
                          }`}
                        >
                          {p.label}
                        </span>
                        <span
                          className={`text-sm ${
                            selected
                              ? "text-blue-600"
                              : "text-gray-400"
                          }`}
                        >
                          {count} people
                        </span>
                      </div>
                    </button>
                  );
                })}

                {/* Custom slider */}
                <div className="pt-2">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Custom threshold</span>
                    <span>
                      {countAbove(threshold)} people (score{" "}
                      {threshold.toFixed(2)}+)
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={threshold}
                    onChange={(e) =>
                      setThreshold(parseFloat(e.target.value))
                    }
                    className="w-full accent-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() =>
                    setStep(initialContactCount > 0 ? "welcome" : "setup")
                  }
                  className="text-sm text-gray-500 hover:text-gray-700 px-4 py-3"
                >
                  Back
                </button>
                <button
                  onClick={saveThresholdAndContinue}
                  disabled={saving}
                  className="flex-1 bg-blue-600 text-white font-medium py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Saving..." : "Continue"}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4: Import Birthdays ── */}
          {step === "import" && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                Import birthdays from Facebook
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Most of your contacts won&apos;t have birthdays in macOS
                Contacts. Facebook is the fastest way to fill in the gaps.
              </p>
              <div className="bg-gray-50 rounded-xl p-4 mb-5">
                <p className="text-sm text-gray-700 font-medium mb-2">
                  How to export from Facebook
                </p>
                <ol className="text-sm text-gray-500 space-y-1 list-decimal list-inside">
                  <li>
                    Install the{" "}
                    <span className="font-medium text-gray-700">
                      Birthday Calendar Exporter
                    </span>{" "}
                    Chrome extension
                  </li>
                  <li>
                    Go to Facebook and let it scan (~10 min)
                  </li>
                  <li>Download the .csv export</li>
                  <li>Upload it below</li>
                </ol>
              </div>

              <div className="mb-6">
                <BirthdayImport onComplete={() => router.refresh()} />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep("threshold")}
                  className="text-sm text-gray-500 hover:text-gray-700 px-4 py-3"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep("done")}
                  className="flex-1 text-sm text-gray-500 hover:text-gray-700 py-3 border border-gray-200 rounded-xl"
                >
                  Skip for now
                </button>
              </div>
            </div>
          )}

          {/* ── Step 5: Done ── */}
          {step === "done" && (
            <div className="text-center">
              <div className="text-5xl mb-4">🎉</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                You&apos;re all set!
              </h2>
              <p className="text-gray-500 mb-6 leading-relaxed">
                BirthdayPing will text you on the morning of each
                person&apos;s birthday so you never forget.
              </p>

              <UpcomingPreview contacts={contacts} />

              <button
                onClick={finishOnboarding}
                disabled={saving}
                className="w-full bg-blue-600 text-white font-medium py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors mt-6"
              >
                {saving ? "Finishing..." : "Go to Dashboard"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function PermissionItem({
  title,
  description,
  instructions,
}: {
  title: string;
  description: string;
  instructions: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-gray-200 rounded-xl p-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-800">{title}</p>
          <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="text-xs text-blue-600 hover:text-blue-800 shrink-0 ml-2 mt-0.5"
        >
          {open ? "Hide" : "How to enable"}
        </button>
      </div>
      {open && (
        <p className="text-xs text-gray-500 mt-2 bg-gray-50 rounded-lg p-2">
          {instructions}
        </p>
      )}
    </div>
  );
}

function UpcomingPreview({ contacts }: { contacts: Contact[] }) {
  const upcoming = contacts
    .filter((c) => c.has_birthday && c.birthday_date && c.enabled)
    .map((c) => {
      const match = c.birthday_date!.match(/(\d{4}|\?\?\?\?)-(\d{2})-(\d{2})/);
      if (!match) return null;
      const today = new Date();
      const thisYear = today.getFullYear();
      let next = new Date(thisYear, parseInt(match[2]) - 1, parseInt(match[3]));
      if (next < today) next = new Date(thisYear + 1, parseInt(match[2]) - 1, parseInt(match[3]));
      const days = Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return { name: c.name, days, date: next };
    })
    .filter(Boolean)
    .sort((a, b) => a!.days - b!.days)
    .slice(0, 5);

  if (upcoming.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left mb-2">
      <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">
        Upcoming birthdays
      </p>
      {upcoming.map((u) => (
        <div
          key={u!.name}
          className="flex justify-between text-sm py-1"
        >
          <span className="text-gray-800">{u!.name}</span>
          <span className="text-amber-600 text-xs">
            {u!.days === 0
              ? "Today!"
              : u!.days === 1
              ? "Tomorrow"
              : `in ${u!.days} days`}
          </span>
        </div>
      ))}
    </div>
  );
}

function getThresholdForCount(
  contacts: Contact[],
  target: number
): number {
  if (contacts.length <= target) return 0;
  const sorted = [...contacts].sort((a, b) => b.score - a.score);
  // Return the score of the contact at position `target`, so that
  // contacts with score >= that value gives roughly `target` people
  return sorted[Math.min(target, sorted.length - 1)]?.score ?? 0;
}
