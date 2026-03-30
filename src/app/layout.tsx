import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "BirthdayPing",
  description: "Never miss a birthday that matters",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">
        {children}
        <footer className="border-t border-gray-200 bg-white mt-auto">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-center gap-4 text-xs text-gray-400">
            <span>BirthdayPing</span>
            <span>·</span>
            <Link href="/privacy" className="hover:text-gray-600">Privacy Policy</Link>
            <span>·</span>
            <Link href="/terms" className="hover:text-gray-600">Terms of Service</Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
