"use client";

import { useRouter } from "next/navigation";

// The design's full header (wordmark, announcement chip, tax-year breadcrumb,
// account menu) has been removed — the prototype only needs the reset
// affordance, which isn't part of the design in the first place.
export default function Header() {
  const router = useRouter();
  return (
    <div className="header">
      <button className="reset-link t-caption" onClick={() => router.push("/")}>
        ↺ Reset
      </button>
    </div>
  );
}
