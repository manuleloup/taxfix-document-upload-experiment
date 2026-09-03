import type { Metadata } from "next";
import { DM_Serif_Display, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Stand-ins for Taxfix's real, licensed fonts (ABC ROM / Circular Std
// Medium — see other_resources/DESIGN-SYSTEM.md) until @taxfix/ds-fonts
// is installable. DM Serif Display echoes ABC ROM's display-serif
// character for headings; Plus Jakarta Sans stands in for Circular
// Std's geometric-sans body text.
const headingFont = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-heading-stand-in",
});

const bodyFont = Plus_Jakarta_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-body-stand-in",
});

export const metadata: Metadata = {
  title: "Taxfix — Document Upload Onboarding",
  description:
    "Experiment: document-upload onboarding flow with an AI-guided tax picture.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${headingFont.variable} ${bodyFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
