"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        setError("Incorrect password. Try again.");
        setPassword("");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="#a0d766" />
            <path d="M8 11h16M13 11v10" stroke="#154618" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <span style={styles.brand}>Taxfix</span>
        </div>

        <h1 style={styles.heading}>Enter password to continue</h1>
        <p style={styles.sub}>This demo is password-protected.</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            autoComplete="current-password"
            disabled={loading}
            style={styles.input}
          />
          {error && <p style={styles.error}>{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            style={{
              ...styles.button,
              ...(loading || !password ? styles.buttonDisabled : {}),
            }}
          >
            {loading ? "Checking…" : "Continue"}
          </button>
        </form>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f5f5f2",
    padding: "24px",
  },
  card: {
    background: "#ffffff",
    borderRadius: "16px",
    padding: "40px",
    width: "100%",
    maxWidth: "380px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.08), 0 4px 24px rgba(0,0,0,0.06)",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "28px",
  },
  brand: {
    fontSize: "20px",
    fontWeight: 700,
    color: "#154618",
    letterSpacing: "-0.3px",
  },
  heading: {
    fontSize: "22px",
    fontWeight: 700,
    color: "#154618",
    margin: "0 0 6px",
    letterSpacing: "-0.3px",
  },
  sub: {
    fontSize: "14px",
    color: "#6b7280",
    margin: "0 0 28px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    fontSize: "15px",
    border: "1.5px solid #e2e8f0",
    borderRadius: "10px",
    outline: "none",
    boxSizing: "border-box",
    color: "#154618",
    background: "#fff",
    transition: "border-color 0.15s",
  },
  error: {
    fontSize: "13px",
    color: "#dc2626",
    margin: "0",
  },
  button: {
    padding: "13px",
    fontSize: "15px",
    fontWeight: 600,
    color: "#154618",
    background: "#a0d766",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    transition: "background 0.15s",
  },
  buttonDisabled: {
    background: "#d1e7b4",
    cursor: "not-allowed",
  },
};
