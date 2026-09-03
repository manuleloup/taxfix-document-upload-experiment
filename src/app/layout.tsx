import type { Metadata } from "next";
import "./globals.css";
import "./typography.css";
import "./ds.css";
import Header from "./_components/header";

// Type is the real licensed ABC ROM (bundled in docs/brand/, served from
// public/fonts/) — declared via @font-face in globals.css. No stand-ins.

export const metadata: Metadata = {
  title: "Taxfix — Document Upload Onboarding",
  description:
    "Experiment: document-upload onboarding flow with an AI-guided tax picture.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <Header />
        {children}
      </body>
    </html>
  );
}
