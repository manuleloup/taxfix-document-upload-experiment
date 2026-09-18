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
            <rect width="36" height="36" rx="10" fill="#a0d766" />
            <path d="M9 13h18M14 13v11" stroke="#154618" strokeWidth="2.8" strokeLinecap="round" />
          </svg>
          <span style={s.brand}>Taxfix</span>
          <span style={s.badge}>Early access</span>
        </div>

        <h1 style={s.heading}>Your tax return, sorted</h1>
        <p style={s.sub}>
          Upload your documents or fill in a few figures — our AI does the heavy lifting.
          Here&rsquo;s everything you need to know before you start.
        </p>

        <div style={s.sections}>
          {/* Section 1 */}
          <div style={s.section}>
            <div style={s.iconWrap}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#154618" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            </div>
            <div style={s.sectionBody}>
              <h2 style={s.sectionTitle}>Upload documents or enter values directly</h2>
              <p style={s.sectionText}>
                Drop in any financial document — P60s, payslips, bank statements, invoices,
                dividend certificates — and our AI reads them for you. Prefer to type? You can
                enter any figure manually at any time.
              </p>
            </div>
          </div>

          <div style={s.divider} />

          {/* Section 2 */}
          <div style={s.section}>
            <div style={s.iconWrap}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#154618" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div style={s.sectionBody}>
              <h2 style={s.sectionTitle}>Ask our AI assistant anything</h2>
              <p style={s.sectionText}>
                Our assistant is trained on HMRC guidance and your uploaded documents. Ask it
                about allowances, deductions, or what a figure means.
              </p>
              <div style={s.disclaimer}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>
                  This is a trial version. Please don&rsquo;t treat anything shown here as
                  final — have it reviewed by an accountant before submitting to HMRC.
                </span>
              </div>
            </div>
          </div>

          <div style={s.divider} />

          {/* Section 3 */}
          <div style={s.section}>
            <div style={s.iconWrap}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#154618" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <div style={s.sectionBody}>
              <h2 style={s.sectionTitle}>Your data stays in the UK</h2>
              <p style={s.sectionText}>
                All data is processed and stored within the United Kingdom. Your documents are
                encrypted in transit and at rest, and are never used to train AI models.
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
    background: "#f5f5f2",
    padding: "32px 16px",
  },
  card: {
    background: "#ffffff",
    borderRadius: "20px",
    padding: "48px 44px",
    width: "100%",
    maxWidth: "560px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.07), 0 8px 32px rgba(0,0,0,0.07)",
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
    color: "#154618",
    letterSpacing: "-0.3px",
  },
  badge: {
    fontSize: "11px",
    fontWeight: 600,
    color: "#4b5563",
    background: "#f3f4f6",
    borderRadius: "999px",
    padding: "3px 9px",
    letterSpacing: "0.02em",
    textTransform: "uppercase",
  },
  heading: {
    fontSize: "26px",
    fontWeight: 800,
    color: "#154618",
    margin: "0 0 10px",
    letterSpacing: "-0.5px",
    lineHeight: 1.2,
  },
  sub: {
    fontSize: "15px",
    color: "#4b5563",
    margin: "0 0 36px",
    lineHeight: 1.6,
  },
  sections: {
    display: "flex",
    flexDirection: "column",
    gap: "0",
    marginBottom: "36px",
  },
  divider: {
    height: "1px",
    background: "#f1f1ef",
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
    background: "#f0f9e4",
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
    color: "#154618",
    margin: "0",
    lineHeight: 1.4,
  },
  sectionText: {
    fontSize: "14px",
    color: "#4b5563",
    margin: "0",
    lineHeight: 1.6,
  },
  disclaimer: {
    display: "flex",
    gap: "8px",
    alignItems: "flex-start",
    background: "#fffbeb",
    border: "1px solid #fde68a",
    borderRadius: "10px",
    padding: "10px 12px",
    marginTop: "6px",
    fontSize: "13px",
    color: "#92400e",
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
    color: "#154618",
    background: "#a0d766",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
    letterSpacing: "-0.1px",
    transition: "background 0.15s",
  },
};
