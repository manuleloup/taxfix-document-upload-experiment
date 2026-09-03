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
      <div className="landing-card">
        {step === "form" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setStep("consent");
            }}
          >
            <h1>See your tax position, before doing anything else</h1>
            <p className="landing-value">
              Drop in whatever tax documents you have. We&rsquo;ll work out what they tell us and build up
              your tax picture as we go — no questionnaire.
            </p>
            <div className="landing-field">
              <label htmlFor="landing-email">Email</label>
              <input
                id="landing-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="landing-field">
              <label htmlFor="landing-name">Name</label>
              <input
                id="landing-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="landing-actions">
              <button type="submit" className="landing-continue">
                Continue
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
            <h1>Before you upload anything</h1>
            <ul className="landing-consent-list">
              <li>We collect the documents you upload, this conversation, and your email and name.</li>
              <li>It&rsquo;s used to build a tax picture for a human accountant to review — nothing is filed automatically.</li>
              <li>Everything is stored on UK servers.</li>
              <li>We keep it for as long as needed to review your submission — final retention policy TBC.</li>
              <li>A human reviews everything before any outcome.</li>
            </ul>
            <label className="landing-checkbox">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>I&rsquo;ve read this and agree to continue.</span>
            </label>
            <div className="landing-actions">
              <button type="button" className="landing-back" onClick={() => setStep("form")}>
                Back
              </button>
              <button type="submit" className="landing-continue" disabled={!agreed}>
                Continue
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
