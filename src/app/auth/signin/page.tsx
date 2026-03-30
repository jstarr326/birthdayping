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
            description="We rank your contacts by closeness and pull birthdays from your address book."
          />
          <Step
            number="3"
            title="Get reminders"
            description="Receive a text the morning of — so you never miss the ones that matter."
          />
        </div>
      </section>

      {/* Privacy */}
      <section className="bg-gray-50 border-y border-gray-100">
        <div className="max-w-2xl mx-auto px-6 py-16 text-center">
          <div className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 text-xs font-medium px-3 py-1 rounded-full mb-6 border border-green-200">
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
              />
            </svg>
            Your privacy, seriously
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900 leading-snug max-w-lg mx-auto">
            We read who you text and how often
            — never what you say.
          </p>
          <p className="mt-4 text-base text-gray-500 max-w-md mx-auto leading-relaxed">
            Your messages never leave your Mac. The local script only counts
            message timestamps per contact. Zero message content is ever
            read, stored, or transmitted.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
            <TrustSignal
              icon={
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
                  />
                </svg>
              }
              label="Open source"
            />
            <TrustSignal
              icon={
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a9 9 0 11-18 0V5.25"
                  />
                </svg>
              }
              label="Local analysis only"
            />
            <TrustSignal
              icon={
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                  />
                </svg>
              }
              label="No message content accessed"
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-sm mx-auto px-6 py-20 text-center">
        <p className="text-sm text-gray-500 mb-5">
          Sign in to get started — it takes about 2 minutes.
        </p>
        <GoogleSignInButton callbackUrl={callbackUrl} />
        {process.env.NODE_ENV === "development" && (
          <div className="mt-3">
            <DevSignInButton callbackUrl={callbackUrl} />
          </div>
        )}
        <p className="text-xs text-gray-400 mt-6">
          Free while in beta. We&apos;ll never spam you.
        </p>
      </section>
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

function TrustSignal({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 text-gray-500">
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}
