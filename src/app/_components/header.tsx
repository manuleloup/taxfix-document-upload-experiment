"use client";

import { useRouter } from "next/navigation";

export default function Header() {
  const router = useRouter();
  return (
    <header className="header">
      <span className="logo">taxfix</span>
      <button className="reset-link" onClick={() => router.push("/")}>
        ↺ Reset prototype
      </button>
    </header>
  );
}
