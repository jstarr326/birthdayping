import Link from "next/link";

export const metadata = {
  title: "Terms of Service — BirthdayPing",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center">
          <Link href="/" className="font-semibold text-gray-900">
            BirthdayPing
          </Link>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Terms of Service</h1>
        <p className="text-sm text-gray-400 mb-8">Last updated: March 29, 2026</p>

        <div className="prose prose-sm prose-gray max-w-none space-y-6 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-0">What BirthdayPing is</h2>
            <p>
              BirthdayPing is a birthday reminder service. It helps you keep track of
              birthdays for the people you actually talk to, and sends you a reminder
              on their birthday so you can reach out personally. It does not send
              messages to your contacts on your behalf.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">Your responsibilities</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Permissions:</strong> You&apos;re responsible for granting the Mac
                utility the permissions it needs (Full Disk Access, Contacts, Automation).
                BirthdayPing can&apos;t function without these.
              </li>
              <li>
                <strong>Accurate information:</strong> The phone number you provide for SMS
                reminders should be a number you own and can receive texts on.
              </li>
              <li>
                <strong>Account security:</strong> Keep your Google account secure. We use
                Google OAuth for sign-in and don&apos;t store passwords.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">SMS consent and opt-out</h2>
            <p>
              By entering your phone number in Settings and choosing SMS as your
              reminder method, you consent to receive text messages from BirthdayPing
              via Twilio. These messages are birthday reminders only — we won&apos;t send
              marketing texts or share your number.
            </p>
            <p>
              <strong>To stop receiving SMS reminders:</strong>
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Reply STOP to any reminder text</li>
              <li>Remove your phone number in Settings</li>
              <li>Switch to iMessage reminders in Settings</li>
              <li>Delete your account</li>
            </ul>
            <p>
              Standard message and data rates from your carrier may apply. We send
              at most a few texts per day (one per birthday).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">No delivery guarantees</h2>
            <p>
              We do our best to send reminders reliably every morning, but we can&apos;t
              guarantee delivery. SMS messages depend on Twilio and your carrier.
              iMessage reminders depend on your Mac being online. Server issues,
              network problems, or carrier filtering could prevent delivery.
            </p>
            <p>
              <strong>We are not responsible for missed birthdays.</strong> BirthdayPing
              is a best-effort reminder tool, not a guaranteed notification service.
              Don&apos;t rely on it as your only way to remember important dates.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">The Mac utility</h2>
            <p>
              The Mac utility runs locally on your computer and reads iMessage metadata
              from chat.db. It requires Full Disk Access, which is a sensitive permission.
              The utility is open source so you can inspect exactly what it does before
              granting access. We are not responsible for any issues caused by granting
              these permissions to your terminal or IDE.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">Account termination</h2>
            <p>
              You can delete your account at any time through the app. We may also
              terminate or suspend accounts that abuse the service (e.g., using the
              API for purposes other than personal birthday reminders, sending excessive
              requests, or attempting to access other users&apos; data).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">Changes to these terms</h2>
            <p>
              We may update these terms occasionally. If we make significant changes,
              we&apos;ll show a notice in the app. Continued use after changes means you
              accept the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">Limitation of liability</h2>
            <p>
              BirthdayPing is provided as-is. To the maximum extent permitted by law,
              we are not liable for any damages arising from your use of the service,
              including but not limited to missed reminders, data loss, or issues
              caused by the Mac utility&apos;s access to your system. Our total liability
              is limited to the amount you&apos;ve paid us (which is $0 for the free tier).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">Contact</h2>
            <p>
              Questions? Email{" "}
              <a href="mailto:jstarrtaylor@gmail.com" className="text-blue-600 underline">
                jstarrtaylor@gmail.com
              </a>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
