# Taxfix Document Upload Experiment

A self-contained HTML prototype for the Taxfix **Step 1 — Upload your documents** screen.

## What it is

An interactive mockup exploring how to guide users through document collection before calculating their tax bill. It combines:

- **Accordion document checklist** — income-source groups (PAYE employment, Rental income) with per-document line items and checkboxes, so users know exactly what to upload
- **Drag-and-drop upload zone** — a single drop target at the bottom; any document can be dropped and the system matches it to the right category automatically
- **Accountant sidebar** — dedicated accountant card (photo, credentials, bio) with "Send a message" and "Schedule a call" CTAs, plus a live summary of income, deductions, and estimated tax due

## Design

Built to the Taxfix brand design system:

- **Typefaces**: DM Serif Display (headings) + Source Serif 4 (body) — stand-ins for the ROM typeface
- **Palette**: Ever-Green (`#ADEE68` lime / `#36893B` dark / `#154618` very dark), Effortless Lilac (`#BC73F2`), off-white neutrals
- **Theme-aware**: full light and dark mode via CSS custom properties

## Usage

Open `taxfix-step1.html` directly in a browser — no build step, no dependencies, no server needed. Everything is self-contained (fonts load from Google Fonts; the accountant photo is embedded as a base64 data URI).
