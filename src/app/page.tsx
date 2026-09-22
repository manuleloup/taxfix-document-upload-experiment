"use client";

import { useRouter } from "next/navigation";

export default function IntroPage() {
  const router = useRouter();

  return (
    <main style={s.page}>
      <div style={s.card}>
        {/* Logo */}
        <div style={s.logo}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
            <rect width="36" height="36" rx="10" fill="#A0D766" />
            <path d="M9 13h18M14 13v11" stroke="#154618" strokeWidth="2.8" strokeLinecap="round" />
          </svg>
          <span style={s.brand}>Taxfix</span>
          <span style={s.badge}>Early access</span>
        </div>

        <h1 style={s.heading}>Your tax return, sorted.</h1>
        <p style={s.sub}>
          Upload your documents — we'll read them, sort the numbers, and a real accountant
          checks everything before anything goes to HMRC.
        </p>

        <div style={s.sections}>
          {/* Section 1 */}
          <div style={s.section}>
            <div style={s.iconWrap} aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#154618" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            <div style={s.sectionBody}>
              <h2 style={s.sectionTitle}>Drop in your documents</h2>
              <p style={s.sectionText}>
                P60s, payslips, bank statements, dividend certificates — anything with
                figures on it. We'll read them. Prefer to type? Add any figure directly.
              </p>
            </div>
          </div>

          <div style={s.divider} />

          {/* Section 2 */}
          <div style={s.section}>
            <div style={s.iconWrap} aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#154618" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div style={s.sectionBody}>
              <h2 style={s.sectionTitle}>Ask us anything</h2>
              <p style={s.sectionText}>
                Questions about what something means, or whether you can claim it? Just ask.
                We know HMRC guidance and your own documents.
              </p>
              {/* Framed as a feature promise, not a legal disclaimer */}
              <div style={s.notice} role="note">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#66541A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>
                  Still in early access — what you see here is a draft. A Taxfix accountant
                  reviews everything before anything is filed. Nothing goes to HMRC without a
                  human check.
                </span>
              </div>
            </div>
          </div>

          <div style={s.divider} />

          {/* Section 3 */}
          <div style={s.section}>
            <div style={s.iconWrap} aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#154618" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <div style={s.sectionBody}>
              <h2 style={s.sectionTitle}>Your data stays in the UK</h2>
              <p style={s.sectionText}>
                Processed and stored within the United Kingdom. Encrypted in transit and at
                rest — and never used to train AI.
              </p>
            </div>
          </div>
        </div>

        <button style={s.cta} onClick={() => router.push("/upload")}>
          Get started
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
          </svg>
        </button>
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    /* DS token: neutral.backgroundLight */
    background: "#F9F7F5",
    padding: "32px 16px",
  },
  card: {
    background: "#ffffff",
    borderRadius: "20px",
    padding: "48px 44px",
    width: "100%",
    maxWidth: "560px",
    /* DS token: neutral shadow treatment */
    boxShadow: "0 1px 3px rgba(12,11,10,0.08), 0 8px 32px rgba(12,11,10,0.07)",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "32px",
  },
  brand: {
    fontSize: "20px",
    fontWeight: 700,
    /* DS token: primary.main */
    color: "#154618",
    letterSpacing: "-0.3px",
  },
  badge: {
    fontSize: "11px",
    fontWeight: 600,
    /* DS token: text.secondary / neutral.background */
    color: "rgba(12,11,10,0.65)",
    background: "#F2EFED",
    borderRadius: "999px",
    padding: "3px 9px",
    letterSpacing: "0.03em",
    textTransform: "uppercase",
  },
  heading: {
    fontSize: "26px",
    fontWeight: 800,
    /* DS token: primary.main */
    color: "#154618",
    margin: "0 0 10px",
    letterSpacing: "-0.5px",
    lineHeight: 1.2,
  },
  sub: {
    fontSize: "15px",
    /* DS token: text.secondary */
    color: "rgba(12,11,10,0.65)",
    margin: "0 0 36px",
    lineHeight: 1.6,
  },
  sections: {
    display: "flex",
    flexDirection: "column",
    marginBottom: "36px",
  },
  divider: {
    height: "1px",
    /* DS token: neutral.primaryAction at low opacity */
    background: "#F2EFED",
    margin: "20px 0",
  },
  section: {
    display: "flex",
    gap: "16px",
    alignItems: "flex-start",
  },
  iconWrap: {
    width: "40px",
    height: "40px",
    borderRadius: "10px",
    /* DS token: primary.backgroundLight */
    background: "#ECFFC7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: "2px",
  },
  sectionBody: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    flex: 1,
  },
  sectionTitle: {
    fontSize: "15px",
    fontWeight: 700,
    /* DS token: primary.main */
    color: "#154618",
    margin: "0",
    lineHeight: 1.4,
  },
  sectionText: {
    fontSize: "14px",
    /* DS token: text.secondary */
    color: "rgba(12,11,10,0.65)",
    margin: "0",
    lineHeight: 1.6,
  },
  notice: {
    display: "flex",
    gap: "8px",
    alignItems: "flex-start",
    /* DS token: accent3.backgroundLight */
    background: "#FFEFD3",
    /* DS token: accent3.background */
    border: "1px solid #F8C677",
    borderRadius: "10px",
    padding: "10px 12px",
    marginTop: "8px",
    fontSize: "13px",
    /* DS token: accent3.main */
    color: "#66541A",
    lineHeight: 1.5,
  },
  cta: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    width: "100%",
    padding: "15px",
    fontSize: "16px",
    fontWeight: 700,
    /* DS token: primary.main — text on primaryAction background */
    color: "#154618",
    /* DS token: primary.primaryAction */
    background: "#A0D766",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
    letterSpacing: "-0.1px",
    transition: "background 0.15s",
  },
};
