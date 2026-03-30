import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getContacts, isOnboardingComplete } from "@/lib/db";
import ContactList from "@/components/ContactList";
import UpcomingBirthdays from "@/components/UpcomingBirthdays";
import ImportButton from "@/components/ImportButton";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/api/auth/signin");
  }

  const onboarded = await isOnboardingComplete(session.user.id);
  if (!onboarded) redirect("/onboarding");

  const contacts = await getContacts(session.user.id);

  const hasBirthdayCount = contacts.filter((c) => c.has_birthday).length;
  const missingCount = contacts.filter((c) => !c.has_birthday).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-semibold text-gray-900">🎂 BirthdayPing</span>
          <div className="flex items-center gap-4">
            <Link href="/settings" className="text-sm text-gray-500 hover:text-gray-800">
              Settings
            </Link>
            <span className="text-sm text-gray-400">{session.user.email}</span>
            <Link
              href="/api/auth/signout"
              className="text-sm text-gray-500 hover:text-gray-800"
            >
              Sign out
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Your contacts</h1>
            <p className="text-sm text-gray-500 mt-1">
              {hasBirthdayCount} with birthdays · {missingCount} missing birthdays
            </p>
          </div>
          <ImportButton />
        </div>

        <UpcomingBirthdays contacts={contacts} />
        <ContactList contacts={contacts} />
      </main>
    </div>
  );
}
