# Taxfix Document Upload Experiment

A self-contained HTML prototype for the Taxfix **Step 1 — Upload your documents** screen.

## What it is

An interactive mockup exploring how to guide users through document collection before calculating their tax bill. It combines:

- **Accordion document checklist** — income-source groups (PAYE employment, Rental income) with per-document line items and checkboxes, so users know exactly what to upload
- **Drag-and-drop upload zone** — a single drop target at the bottom; any document can be dropped and the system matches it to the right category automatically
- **Accountant sidebar** — dedicated accountant card (photo, credentials, bio) with "Send a message" and "Schedule a call" CTAs, plus a live summary of income, deductions, and estimated tax due

## Design

Currently in a **grayscale wireframe stage** — UX/flow is being settled before brand polish goes back in:

- **Typefaces**: IBM Plex Sans (headings + body) — stand-in for the ROM typeface
- **Palette**: the Taxfix Ever-Green tones (and `--text`, which was tinted dark green) have been swapped for a neutral Tailwind **stone** grey scale, kept consistent across all `--green-*` CSS variables (so header badges, buttons, and the progress bar all shifted together); Effortless Lilac (`#BC73F2`) is untouched for now
- **Layout**: content area capped at `max-width: 1400px` and centered, so it doesn't stretch indefinitely on large desktops; the progress bar's steps are aligned to the same left edge as the main content
- **Theme-aware**: full light and dark mode via CSS custom properties

## Usage

Open `taxfix-step1.html` directly in a browser — no build step, no dependencies, no server needed. Everything is self-contained (fonts load from Google Fonts; the accountant photo is embedded as a base64 data URI).

## Next steps

This currently covers only the Step 1 upload screen, now in grayscale wireframe form. Further screens in the flow (Overview, UTR registration, Employment income, etc.) will be built out the same way — grayscale, no branding — so the UX gets settled before any visual polish.

A more fully-built structural reference for that fuller flow exists at [v0.app/gabrie-be/taxfix-prototype-structural-shadcn-no-branding](https://v0.app/gabrie-be/chat/taxfix-prototype-structural-shadcn-no-branding-mOaEOngwip3).
