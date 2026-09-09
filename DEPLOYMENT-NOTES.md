# Deployment Notes — Local-Development Stand-ins

Tracked in git deliberately, unlike `other_resources/` (gitignored, personal
scratch). Anything that must change before this app runs anywhere beyond a
single developer's machine belongs here, not in a folder that never leaves
one laptop.

## 1. Document storage — `src/app/_lib/document-store.ts`

**What it does today.** Every uploaded document is written to a folder on
the local filesystem, one folder per session (`os.tmpdir()/taxfix-doc-upload-sessions/<sessionId>/<docId>.json`,
overridable via `DOCUMENT_STORE_DIR`). The chat feature's "re-read the
original document" tool call reads from this folder. Stale session folders
are swept after 12 hours.

**Why it works locally.** The app currently runs as a single Node process
on one machine, so every request — the upload, and every later chat message
— reaches the same disk.

**Why it will silently break on real hosting.** Most hosting (Vercel
included) runs the backend as short-lived, independent instances with their
own disk, not a shared one. A document written while handling the upload
request may simply not be there when a later chat request looks for it —
and the failure is silent: `getDocument()` returns `null`, the tool result
says "not available," and the model just answers from the summary instead.
Nothing crashes, so this would be easy to ship without noticing, especially
since it works perfectly in local testing every time.

**Also true today, not yet addressed:** documents are stored unencrypted at
rest, with no access control beyond an unguessable folder name. Fine for
sample/dummy documents during development; not acceptable for real
financial documents.

**What replacing it looks like.** `document-store.ts` is deliberately the
only file that knows *where* documents live — everything else asks for a
document by `(sessionId, docId)` and gets bytes back (the same seam
`_lib/llm.ts` gives the AI vendor choice). Swapping to real object storage
(a proper storage bucket, encrypted at rest, per-user rather than
per-anonymous-session) means rewriting this one file's `putDocument` /
`getDocument` / cleanup logic against the bucket's API, not touching the
chat route, the tool-use loop, or the upload flow.

## 2. Session identity — `sessionId` in `upload/page.tsx`

**What it does today.** A random ID (`crypto.randomUUID()`) is generated in
the browser the first time it's needed and held only in memory for that
page load. It is not tied to the email/name captured on the landing page,
not persisted, and not authenticated — it's just an unguessable handle used
to keep one visitor's documents separate from another's.

**Implication.** Reloading the page, or closing the tab, loses the session:
new random ID, empty document store, chat starts fresh. That matches the
"single-session only" open question already flagged in
`ONBOARDING-EXPERIMENT-FLOW.md` (see "Open decisions" — resumable session or
not). If a resumable session is wanted later, the session id needs to
become something durable (tied to the captured email, with real
authentication or at minimum a magic link), which is a bigger change than
the storage swap above — it touches identity, not just where bytes live.

## 3. Everything else stays stateless

The chat route (`api/chat/route.ts`) itself keeps no memory between
requests. The browser resends the running conversation, the document
summaries, and the current Tax Position on every message; the only
server-side state at all is the document bytes described in §1. This part
of the design has no serverless problem — it was built to survive that
from the start.

## Pre-deployment checklist

- [ ] Replace `document-store.ts`'s filesystem backing with real object
      storage (encrypted at rest), keeping its `(sessionId, docId) → bytes`
      interface unchanged for callers
- [ ] Decide whether sessions need to be resumable; if yes, redesign session
      identity around the captured email rather than a per-page-load random id
- [ ] Confirm encryption in transit and at rest before any real financial
      document touches this flow (see `ONBOARDING-EXPERIMENT-FLOW.md`,
      Consent/T&Cs section — not yet confirmed there either)
- [ ] Re-point the AI vendor in `_lib/llm.ts` if moving off Claude, per
      whatever region/vendor decision is actually made (treat
      `other_resources/STACK-OPTIONS.md` as historical framing only — it
      predates the Gemini direction and weighs Azure/AWS options that are no
      longer under consideration)
- [ ] Re-run the local-only assumptions above against whatever host is
      actually chosen — "not Vercel" doesn't automatically mean "safe";
      confirm the chosen host guarantees one long-lived process with
      persistent disk, or this file needs revisiting regardless of vendor
