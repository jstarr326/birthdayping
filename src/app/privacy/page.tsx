import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — BirthdayPing",
};

export default function PrivacyPage() {
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
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-8">Last updated: March 29, 2026</p>

        <div className="prose prose-sm prose-gray max-w-none space-y-6 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-0">What BirthdayPing does</h2>
            <p>
              BirthdayPing is a birthday reminder tool. It analyzes who you text and how often
              to figure out the people you care about, then reminds you of their birthdays so
              you never forget.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">What we read on your Mac</h2>
            <p>
              The BirthdayPing Mac utility reads <strong>iMessage metadata only</strong>:
              who you texted, how many messages, and when the last message was sent.
              It also reads your macOS Contacts to match phone numbers to names and
              pull in any birthdays already stored there.
            </p>
            <p>
              <strong>We never read your message content.</strong> The utility does not access
              message text, attachments, photos, or any media. It only reads metadata
              (handles, counts, and timestamps). The Mac utility is{" "}
              <a
                href="https://github.com/jstarr326/birthdayping"
                className="text-blue-600 underline"
                target="_blank"
                rel="noreferrer"
              >
                open source
              </a>{" "}
              so you can verify exactly what it accesses.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">What data we store</h2>
            <p>When you sync your contacts, the following is sent to and stored on our server:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Contact names and phone numbers</li>
              <li>Relationship scores (based on message frequency and recency)</li>
              <li>Birthday dates (from macOS Contacts or Facebook import)</li>
              <li>Message counts per contact (total, sent, received)</li>
              <li>Your email address and name (from Google sign-in)</li>
              <li>Your phone number (if you enter it for SMS reminders)</li>
              <li>Your preferences (reminder time, message template, threshold)</li>
            </ul>
            <p>
              <strong>We never store message content, message text, attachments, or media.</strong>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">Facebook birthday data</h2>
            <p>
              If you choose to import birthdays from Facebook, you upload a .csv or .ics
              file that you exported yourself using a browser extension. This file contains
              your Facebook friends&apos; names and birthday dates. We process it server-side to
              match names against your synced contacts. We do not connect to your Facebook
              account directly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">SMS reminders via Twilio</h2>
            <p>
              If you opt in to SMS reminders by entering your phone number in Settings,
              we send birthday reminder texts to that number using Twilio. Your phone
              number is shared with Twilio solely for the purpose of delivering these
              messages. Twilio&apos;s privacy policy applies to their handling of your
              number.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">Where your data lives</h2>
            <p>
              Your data is stored on Supabase (PostgreSQL) and the web app is hosted
              on Vercel. Both are US-based services. Your data is transmitted over
              HTTPS and stored in encrypted databases.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">What we don&apos;t do</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>We don&apos;t sell your data to anyone</li>
              <li>We don&apos;t share your data with third parties (except Twilio for SMS delivery)</li>
              <li>We don&apos;t use your data for advertising</li>
              <li>We don&apos;t read your messages</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">Cookies</h2>
            <p>
              We use cookies for authentication only (keeping you signed in). We don&apos;t
              use tracking cookies, analytics cookies, or advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">Deleting your data</h2>
            <p>
              You can delete your account and all associated data at any time. This
              removes your contacts, birthdays, scores, settings, and account
              information permanently. Contact us at the email below or use the
              account deletion option in Settings.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">Contact</h2>
            <p>
              Questions about this policy? Email{" "}
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
