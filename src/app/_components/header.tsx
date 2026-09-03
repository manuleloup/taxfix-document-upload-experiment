"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

export default function Header() {
  const router = useRouter();
  return (
    <header className="header">
      {/* Brand rule: the logotype is never reproduced in type — this is the
          real wordmark asset (dark-green on vivid-green, light-bg variant). */}
      <Image
        className="logo-mark"
        src="/brand/Logo_Wordmark_dark_green.jpg"
        alt="Taxfix"
        width={820}
        height={325}
        priority
      />
      <button className="reset-link t-caption" onClick={() => router.push("/")}>
        ↺ Reset prototype
      </button>
    </header>
  );
}
