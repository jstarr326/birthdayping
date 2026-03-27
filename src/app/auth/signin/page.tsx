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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 w-full max-w-sm text-center">
        <div className="text-4xl mb-4">🎂</div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">BirthdayPing</h1>
        <p className="text-sm text-gray-500 mb-6">
          Never miss a birthday that matters
        </p>
        <GoogleSignInButton callbackUrl={callbackUrl} />
        {process.env.NODE_ENV === "development" && (
          <div className="mt-3">
            <DevSignInButton callbackUrl={callbackUrl} />
          </div>
        )}
        <p className="text-xs text-gray-400 mt-6 leading-relaxed">
          BirthdayPing reads who you text and how often — never what you say.
          All analysis happens on your Mac.
        </p>
      </div>
    </div>
  );
}
