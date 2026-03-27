"use client";

import { useRouter } from "next/navigation";
import BirthdayImport from "./BirthdayImport";

export default function ImportButton() {
  const router = useRouter();
  return <BirthdayImport onComplete={() => router.refresh()} />;
}
