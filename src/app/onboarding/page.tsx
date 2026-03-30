import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { isOnboardingComplete, getContacts } from "@/lib/db";
import OnboardingFlow from "./OnboardingFlow";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/signin");

  const complete = await isOnboardingComplete(session.user.id);
  if (complete) redirect("/dashboard");

  const contacts = await getContacts(session.user.id);

  return <OnboardingFlow contactCount={contacts.length} contacts={contacts} />;
}
