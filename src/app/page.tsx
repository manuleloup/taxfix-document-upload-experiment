"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import "./landing.css";

export default function Landing() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "consent">("form");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="landing">
      <div className="tf-card tf-card--outlined landing-card">
        {step === "form" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setStep("consent");
            }}
          >
            {/* Brand: headlines take full-stops for rhythm. */}
            <h1 className="t-h2 t-heavy">Your tax position. Before anything else.</h1>
            <p className="t-bodyLong t-muted landing-value">
              Drop in whatever tax documents you have. We&rsquo;ll work out what they tell us and build your
              tax picture as we go — no questionnaire.
            </p>

            <label className="tf-field">
              <input
                id="landing-email"
                type="email"
                required
                placeholder=" "
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <span className="tf-field-label">Email</span>
            </label>
            <label className="tf-field">
              <input
                id="landing-name"
                type="text"
                required
                placeholder=" "
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <span className="tf-field-label">Name</span>
            </label>

            <div className="landing-actions">
              <button type="submit" className="tf-btn tf-btn--primary tf-btn--large t-button">
                Start now
              </button>
            </div>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              router.push("/upload");
            }}
          >
            <h1 className="t-h3">Before you upload anything.</h1>
            <ul className="t-bodySmall t-muted landing-consent-list">
              <li>We collect the documents you upload, this conversation, and your email and name.</li>
              <li>
                It&rsquo;s used to build a tax picture for a human accountant to review — nothing is filed
                automatically.
              </li>
              <li>Everything is stored on UK servers.</li>
              <li>We keep it for as long as needed to review your submission — final retention policy TBC.</li>
              <li>A human reviews everything before any outcome.</li>
            </ul>
            <label className="landing-checkbox">
              <input
                type="checkbox"
                className="tf-checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              <span className="t-bodySmall">I&rsquo;ve read this and agree to continue.</span>
            </label>
            <div className="landing-actions">
              <button
                type="button"
                className="tf-btn tf-btn--tertiary tf-btn--medium t-buttonSmall"
                onClick={() => setStep("form")}
              >
                Back
              </button>
              <button
                type="submit"
                className="tf-btn tf-btn--primary tf-btn--large t-button"
                disabled={!agreed}
              >
                Continue
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
