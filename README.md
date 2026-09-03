# Taxfix Document Upload Experiment

Document-upload onboarding experiment for Taxfix: collect documents instead
of a questionnaire, build a tax picture live via an AI-guided chat, and hand
it to an accountant for review. See `other_resources/` (gitignored, local
only) for the underlying hypothesis, flow, and stack decisions.

## Current build (this branch)

A Next.js (App Router, TypeScript) rebuild, replacing the earlier static
HTML/Express prototype. Layout and flow reference:
`taxfix-no-onboarding.html`.

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

## Earlier prototype (superseded)

`taxfix-step1.html` is the original self-contained static HTML mockup
(accordion checklist, drag-and-drop upload, accountant sidebar) — open it
directly in a browser, no build step needed. Kept for reference; the active
build going forward is the Next.js app above.
