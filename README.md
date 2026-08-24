# Taxfix Document Upload Experiment

A self-contained HTML prototype for the Taxfix **Step 1 — Upload your documents** screen.

## What it is

An interactive mockup exploring how to guide users through document collection before calculating their tax bill. It's built from three named components — see [PAGE-COMPONENTS.md](PAGE-COMPONENTS.md) for their full definitions (purpose, what each should/shouldn't contain, how they relate). Each is marked in `taxfix-step1.html` with a `data-component` attribute, so they can be found and referred to unambiguously in code:

- **Document Checklist** (`data-component="document-checklist"`) — income-source groups (PAYE employment, Rental income) with per-document line items and checkboxes, so users know exactly what to upload. Its Upload Target sub-component (`data-component="upload-target"`) is the single drop zone at the bottom that accepts any document and routes it to the right category automatically
- **Tax Position** (`data-component="tax-position"`), *"Your Tax Position so far"* — a live, visually distinct summary of income, deductions found, and estimated tax due, occupying the top of the sidebar
- **Accountant Panel** (`data-component="accountant-panel"`) — dedicated accountant card (photo, credentials, bio) with "Send a message" and "Schedule a call" CTAs, sitting below the Tax Position

Layout is a 3:2 column split (Document Checklist : sidebar).

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