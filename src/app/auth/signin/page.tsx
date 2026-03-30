import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { GoogleSignInButton, DevSignInButton } from "./SignInButtons";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  const { callbackUrl = "/dashboard" } = await searchParams;

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎂</span>
          <span className="text-sm font-semibold text-gray-900 tracking-tight">
            BirthdayPing
          </span>
        </div>
        <a
          href="https://github.com/jstarr326/birthdayping"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          GitHub
        </a>
      </nav>

      {/* Hero */}
      <section className="max-w-2xl mx-auto px-6 pt-20 pb-16 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight leading-tight">
          Remember the birthdays of
          <br />
          people you actually care about
        </h1>
        <p className="mt-5 text-lg text-gray-500 max-w-md mx-auto leading-relaxed">
          BirthdayPing scans your iMessage history to figure out who matters
          most, then reminds you before their birthday.
        </p>
      </section>

      {/* How it works */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Step
            number="1"
            title="Scan your contacts"
            description="A local script reads your iMessage metadata — frequency and recency, never content."
          />
          <Step
            number="2"
            title="Import birthdays"
            description="Pull birthdays from Facebook and your address book. We match them to your ranked contacts."
          />
          <Step
            number="3"
            title="Get reminders"
            description="Receive a text the morning of — so you never miss the ones that matter."
          />
        </div>
      </section>

      {/* Dashboard preview */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <div className="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden shadow-sm">
          <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">🎂</span>
              <span className="text-xs font-semibold text-gray-700">BirthdayPing</span>
            </div>
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-200" />
              <span className="w-2.5 h-2.5 rounded-full bg-gray-200" />
              <span className="w-2.5 h-2.5 rounded-full bg-gray-200" />
            </div>
          </div>
          <div className="px-5 py-4">
            <div className="text-xs font-semibold text-gray-500 mb-3">
              Upcoming birthdays
            </div>
            <div className="space-y-2.5">
              <MockContact name="Sarah Chen" score={94} date="Apr 2" msgs="2,847" />
              <MockContact name="Marcus Johnson" score={87} date="Apr 5" msgs="1,203" />
              <MockContact name="Priya Patel" score={72} date="Apr 12" msgs="891" />
            </div>
            <div className="mt-4 pt-3 border-t border-gray-200">
              <div className="text-xs font-semibold text-gray-500 mb-3">
                Missing birthday
              </div>
              <div className="space-y-2.5">
                <MockContactMissing name="David Kim" score={68} msgs="743" />
                <MockContactMissing name="Rachel Torres" score={61} msgs="512" />
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-400 text-center mt-3">
          Your contacts ranked by how often you actually talk
        </p>
      </section>

      {/* Privacy */}
      <section className="bg-gray-950">
        <div className="max-w-3xl mx-auto px-6 py-20">
          <div className="flex items-start gap-5 sm:gap-6">
            <div className="shrink-0 w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mt-0.5">
              <svg
                className="w-6 h-6 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white leading-snug">
                We read who you text and how often — never what you say.
              </h2>
              <p className="mt-4 text-base text-gray-400 leading-relaxed max-w-xl">
                Your messages never leave your Mac. The local script only reads
                message timestamps and contact identifiers — it counts how often
                you text each person, not what you said. Zero message content
                is ever read, stored, or transmitted.
              </p>
            </div>
          </div>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <PrivacyPoint
              title="Open source"
              description="The Mac utility is fully auditable. Read the code yourself."
            />
            <PrivacyPoint
              title="Local analysis only"
              description="Contact scoring happens on your Mac. Only names and scores are synced."
            />
            <PrivacyPoint
              title="No message content"
              description="We query message.date and handle.id. Never message.text or attachments."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-sm mx-auto px-6 py-20 text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Get started</h2>
        <p className="text-sm text-gray-500 mb-6">
          Sign in with Google, then download the Mac utility.
        </p>
        <div className="space-y-3">
          <GoogleSignInButton callbackUrl={callbackUrl} />
          <a
            href="https://github.com/jstarr326/birthdayping/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-gray-900 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors shadow-sm w-full"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Download for Mac
          </a>
        </div>
        {process.env.NODE_ENV === "development" && (
          <div className="mt-3">
            <DevSignInButton callbackUrl={callbackUrl} />
          </div>
        )}
        <p className="text-xs text-gray-400 mt-6">
          Free while in beta. macOS 12+ required.
        </p>
      </section>

      {/* FAQ */}
      <section className="border-t border-gray-100">
        <div className="max-w-2xl mx-auto px-6 py-20">
          <h2 className="text-lg font-bold text-gray-900 mb-8 text-center">
            Common questions
          </h2>
          <div className="space-y-6">
            <FAQ
              q="Can you read my messages?"
              a="No. The local script queries message timestamps and contact identifiers only. It never accesses message.text, attachments, or any content. The code is open source — you can verify this yourself."
            />
            <FAQ
              q="Does it work without a Mac?"
              a="Not yet. BirthdayPing requires a Mac to scan your iMessage history. SMS reminders via Twilio work from any device once set up, but the initial contact scan needs macOS."
            />
            <FAQ
              q="Is it free?"
              a="Yes, free while in beta. If we add a paid tier later, the core features will stay free."
            />
            <FAQ
              q="What about WhatsApp or Android?"
              a="Coming later. WhatsApp and Telegram store local databases on Mac too, so we can cross-reference them. Android support is on the roadmap but further out."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>🎂</span>
            <span>BirthdayPing</span>
          </div>
          <div className="flex gap-6 text-xs text-gray-400">
            <a href="/privacy" className="hover:text-gray-600 transition-colors">
              Privacy Policy
            </a>
            <a href="/terms" className="hover:text-gray-600 transition-colors">
              Terms of Service
            </a>
            <a
              href="https://github.com/jstarr326/birthdayping"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-600 transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center sm:text-left">
      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-xs font-semibold text-gray-500 mb-3">
        {number}
      </div>
      <h3 className="text-sm font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
    </div>
  );
}

function PrivacyPoint({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-white mb-1">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
    </div>
  );
}

function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900">{q}</h3>
      <p className="text-sm text-gray-500 mt-1 leading-relaxed">{a}</p>
    </div>
  );
}

function MockContact({
  name,
  score,
  date,
  msgs,
}: {
  name: string;
  score: number;
  date: string;
  msgs: string;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-7 h-7 rounded-full bg-gray-200 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{name}</span>
          <span className="text-xs font-mono px-1.5 py-0.5 rounded-full bg-green-100 text-green-800">
            {score}
          </span>
        </div>
        <span className="text-xs text-gray-400">{msgs} msgs</span>
      </div>
      <span className="text-xs text-gray-500">{date}</span>
      <div className="w-9 h-5 rounded-full bg-green-500 relative">
        <span className="absolute right-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow-sm" />
      </div>
    </div>
  );
}

function MockContactMissing({
  name,
  score,
  msgs,
}: {
  name: string;
  score: number;
  msgs: string;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-7 h-7 rounded-full bg-gray-200 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{name}</span>
          <span className="text-xs font-mono px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
            {score}
          </span>
        </div>
        <span className="text-xs text-gray-400">{msgs} msgs</span>
      </div>
      <span className="text-xs text-blue-500 font-medium">+ Add birthday</span>
    </div>
  );
}
