"use client";

import { useState, useRef } from "react";

type ExactMatch = {
  name: string;
  contactName: string;
  contactId: number;
  month: number;
  day: number;
  alreadyHad: boolean;
};

type CloseMatch = ExactMatch & { reason: string };
type Unmatched = { name: string; month: number; day: number };

type ImportResult = {
  parsed: number;
  exact: ExactMatch[];
  close: CloseMatch[];
  unmatched: Unmatched[];
  applied: number;
};

type Step = "idle" | "prompting" | "uploading" | "results" | "reviewing";

function formatDate(month: number, day: number): string {
  const date = new Date(2000, month - 1, day);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function BirthdayImport({
  onComplete,
  autoPrompt = false,
}: {
  onComplete: () => void;
  autoPrompt?: boolean;
}) {
  const [step, setStep] = useState<Step>(autoPrompt ? "prompting" : "idle");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<Set<number>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setStep("uploading");
    setError(null);
    setResult(null);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/import/facebook", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        setStep("idle");
        return;
      }

      setResult(data);
      setStep("results");
      // Pre-accept all close matches
      setAccepted(new Set(data.close.map((m: CloseMatch) => m.contactId)));
    } catch {
      setError("Network error. Is the dev server running?");
      setStep("idle");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  const toggleAccepted = (contactId: number) => {
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  };

  const handleConfirm = async () => {
    if (!result) return;
    setConfirming(true);

    const confirmations = result.close
      .filter((m) => accepted.has(m.contactId) && !m.alreadyHad)
      .map((m) => ({ contactId: m.contactId, month: m.month, day: m.day }));

    if (confirmations.length === 0) {
      setConfirmed(0);
      setConfirming(false);
      setStep("results");
      return;
    }

    try {
      const res = await fetch("/api/import/facebook", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmations }),
      });
      const data = await res.json();
      setConfirmed(data.confirmed ?? 0);
      setStep("results");
    } finally {
      setConfirming(false);
    }
  };

  const handleDone = () => {
    setStep("idle");
    setResult(null);
    setError(null);
    setConfirmed(null);
    onComplete();
  };

  // ── Prompting: shown after Facebook scraper completes ──
  if (step === "prompting") {
    return (
      <div className="col-span-full">
        <input
          ref={fileRef}
          type="file"
          accept=".ics,.ical,.csv"
          className="hidden"
          onChange={handleFileChange}
        />
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            dragging
              ? "border-blue-500 bg-blue-50"
              : "border-blue-300 bg-blue-50/50"
          }`}
        >
          <div className="text-3xl mb-3">🎉</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            Facebook birthdays are ready to import!
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Drop the <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">facebook-birthdays.csv</code> file
            here, or click to browse.
          </p>
          <button
            onClick={() => fileRef.current?.click()}
            className="bg-blue-600 text-white text-sm font-medium px-6 py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Choose CSV file
          </button>
          <p className="text-xs text-gray-400 mt-3">
            Default location: ~/.birthdayping/facebook-birthdays.csv
          </p>
        </div>
        {error && (
          <p className="text-sm text-red-600 mt-2">{error}</p>
        )}
      </div>
    );
  }

  // ── Idle: show upload button ──
  if (step === "idle") {
    return (
      <div>
        <input
          ref={fileRef}
          type="file"
          accept=".ics,.ical,.csv"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import Birthdays
          </button>
          <a
            href="https://chromewebstore.google.com/detail/birthday-calendar-exporte/imielmggcccenhgncmpjlehemlinhjjo"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            title="Get the Chrome extension to export Facebook birthdays"
          >
            Get Facebook CSV
          </a>
        </div>
        {error && (
          <p className="text-sm text-red-600 mt-2">{error}</p>
        )}
      </div>
    );
  }

  // ── Uploading ──
  if (step === "uploading") {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
        <div className="text-sm text-gray-500">Parsing file and matching names...</div>
      </div>
    );
  }

  if (!result) return null;

  const newExact = result.exact.filter((m) => !m.alreadyHad);
  const newClose = result.close.filter((m) => !m.alreadyHad);
  const totalNew = newExact.length + newClose.length;

  // ── Reviewing close matches ──
  if (step === "reviewing") {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-1">Review matches</h3>
        <p className="text-xs text-gray-500 mb-4">
          These names are close but not exact. Uncheck any that are wrong.
        </p>

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {result.close.map((m) => (
            <label
              key={m.contactId}
              className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={accepted.has(m.contactId)}
                onChange={() => toggleAccepted(m.contactId)}
                disabled={m.alreadyHad}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-900">
                  <span className="font-medium">{m.name}</span>
                  <span className="text-gray-400"> → </span>
                  <span className="font-medium">{m.contactName}</span>
                  <span className="text-gray-400 ml-2">{formatDate(m.month, m.day)}</span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{m.reason}</div>
                {m.alreadyHad && (
                  <div className="text-xs text-green-600 mt-0.5">Already has birthday</div>
                )}
              </div>
            </label>
          ))}
        </div>

        <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100">
          <button
            onClick={() => setStep("results")}
            className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2"
          >
            Back
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {confirming ? "Saving..." : `Confirm ${accepted.size} match${accepted.size !== 1 ? "es" : ""}`}
          </button>
        </div>
      </div>
    );
  }

  // ── Results summary ──
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-6 ${autoPrompt ? "col-span-full" : ""}`}>
      <h3 className="font-semibold text-gray-900 mb-3">Import results</h3>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-700">{result.exact.length}</div>
          <div className="text-xs text-green-600 mt-0.5">Exact matches</div>
        </div>
        <div className="text-center p-3 bg-yellow-50 rounded-lg">
          <div className="text-2xl font-bold text-yellow-700">{result.close.length}</div>
          <div className="text-xs text-yellow-600 mt-0.5">Need review</div>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-gray-500">{result.unmatched.length}</div>
          <div className="text-xs text-gray-400 mt-0.5">Unmatched</div>
        </div>
      </div>

      {result.applied > 0 && (
        <p className="text-sm text-green-700 mb-3">
          {result.applied} new birthday{result.applied !== 1 ? "s" : ""} saved from exact matches.
        </p>
      )}
      {confirmed !== null && confirmed > 0 && (
        <p className="text-sm text-green-700 mb-3">
          {confirmed} birthday{confirmed !== 1 ? "s" : ""} saved from reviewed matches.
        </p>
      )}

      {/* Exact matches list (collapsed by default) */}
      {result.exact.length > 0 && (
        <details className="mb-3">
          <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-800">
            Show exact matches ({result.exact.length})
          </summary>
          <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
            {result.exact.map((m, i) => (
              <div key={i} className="text-sm text-gray-600 flex justify-between px-2">
                <span>{m.contactName}</span>
                <span className="text-gray-400">{formatDate(m.month, m.day)}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Unmatched list (collapsed) */}
      {result.unmatched.length > 0 && (
        <details className="mb-3">
          <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-600">
            Show unmatched ({result.unmatched.length})
          </summary>
          <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
            {result.unmatched.map((b, i) => (
              <div key={i} className="text-sm text-gray-400 flex justify-between px-2">
                <span>{b.name}</span>
                <span>{formatDate(b.month, b.day)}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100">
        {result.close.length > 0 && confirmed === null && (
          <button
            onClick={() => setStep("reviewing")}
            className="bg-yellow-500 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-yellow-600 transition-colors"
          >
            Review {result.close.length} close match{result.close.length !== 1 ? "es" : ""}
          </button>
        )}
        <button
          onClick={handleDone}
          className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2"
        >
          {totalNew === 0 && confirmed !== null ? "Done" : "Close"}
        </button>
      </div>
    </div>
  );
}
