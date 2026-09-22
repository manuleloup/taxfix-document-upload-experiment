"use client";

import { useRouter } from "next/navigation";
import "./landing.css";

export default function Landing() {
  const router = useRouter();

  return (
    <div className="landing">
      <div className="tf-card tf-card--outlined landing-card">
        <h1 className="t-h2 t-heavy">Build your full tax picture.</h1>
        <p className="t-bodyLong t-muted landing-value">
          Have a more complex tax situation? We can help you. Drop in any tax-related documents, or
          add information manually. We&rsquo;ll work out your situation and how to optimise it.
        </p>
        <div className="landing-actions">
          <button
            type="button"
            className="tf-btn tf-btn--primary tf-btn--large t-button"
            onClick={() => router.push("/upload")}
          >
            Start for free
          </button>
        </div>
      </div>
    </div>
  );
}
