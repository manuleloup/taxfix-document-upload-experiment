# Taxfix Document Upload Experiment

Document-upload onboarding experiment for Taxfix: collect documents instead
of a questionnaire, build a tax picture live via an AI-guided chat, and hand
it to an accountant for review. See `other_resources/` (gitignored, local
only) for the underlying hypothesis, flow, and stack decisions.

## Current build (this branch)

A Next.js (App Router, TypeScript) rebuild, replacing the earlier static
HTML/Express prototype.

- `src/app/` — pages and layouts
- Styling target: Taxfix's real component library (`@taxfix/ds-components`)
  rather than hand-rolled CSS — see `other_resources/DESIGN-SYSTEM.md` for
  access details and current blockers (npm auth to Taxfix's private
  registry isn't set up on this machine yet).
- `server.js` (legacy) — the original Express + Claude document-detection
  backend, kept for reference while that logic is ported to a Next.js route
  handler. Run it standalone via `npm run legacy:server` if needed.

```
npm install
npm run dev      # Next.js app, http://localhost:3000
npm run build    # production build
```

## About the two HTML reference files

Neither of these is the UI to ship — both are wireframes that inform what
gets built, not the target visual design.

- **`taxfix-no-onboarding.html`** — the current flow/structure reference.
  Its layout, interaction patterns, and copy are what the Next.js app is
  being rebuilt from (see `src/app/page.tsx`), but its visual styling is a
  placeholder (generic palette, IBM Plex Sans) standing in until real
  Taxfix branded components (`@taxfix/ds-components`) are available.
- **`taxfix-step1.html`** — an older, superseded prototype. Kept for
  history only; not a reference for the current build.
