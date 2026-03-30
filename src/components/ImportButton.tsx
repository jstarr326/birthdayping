"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import BirthdayImport from "./BirthdayImport";

export default function ImportButton() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (searchParams.get("import") === "facebook") {
      setShowPrompt(true);
      // Clean up URL without reloading
      window.history.replaceState({}, "", "/dashboard");
    }
  }, [searchParams]);

  const handleComplete = () => {
    setShowPrompt(false);
    router.refresh();
  };

  if (showPrompt) {
    return <FacebookImportPrompt onComplete={handleComplete} />;
  }

  return <BirthdayImport onComplete={handleComplete} />;
}

function FacebookImportPrompt({ onComplete }: { onComplete: () => void }) {
  return (
    <div>
      <BirthdayImport onComplete={onComplete} autoPrompt />
    </div>
  );
}
