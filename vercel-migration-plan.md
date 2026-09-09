# Migration plan: local app → Vercel + Supabase

Written 8 September 2026, updated same day after feedback. Builds on `DEPLOYMENT-NOTES.md` (already tracked in the repo) and the doc-upload handoff from the `doc-upload-experiment` branch. Scope: hosting and storage only.

## Current status

Nothing is deployed yet. The app is still local-only, running on one machine with the filesystem document store described in `DEPLOYMENT-NOTES.md`. Vercel access hasn't been granted yet, and no Supabase project exists. Everything below is a plan to execute once access lands, not a description of anything already built.

## What's actually changing

Two things break on Vercel today: the filesystem document store, and the fact that email/name are captured into local component state and go nowhere. Everything else — the chat and classify API routes — is already stateless per request and needs no rework for serverless.

Supabase covers both gaps with one service: Postgres for structured data (leads, document metadata) and Supabase Storage for the document bytes themselves. This is additive to Vercel, not a replacement for it — the Next.js app still deploys to Vercel as normal; Supabase is the backing store the app talks to over its API.

## Data residency requirement: UK only

Flagged as a hard requirement — anything stored must sit on UK servers. Checked both platforms:

**Supabase** supports pinning a project's Postgres database and Storage to AWS `eu-west-2` (London) at project creation. This is a real, dedicated UK region, not a general "Europe" grouping — confirmed via [Supabase's regions documentation](https://supabase.com/docs/guides/platform/regions).

**Vercel** supports pinning serverless function execution to London (region code `lhr1`) via `vercel.json` or the project's Functions settings — confirmed via [Vercel's function region docs](https://vercel.com/docs/functions/configuring-functions/region). Two caveats worth knowing before relying on this:

- The default region for new projects is Washington, D.C. (`iad1`), not London — this has to be set explicitly, it doesn't happen automatically.
- On Vercel's Hobby plan, a project can only run in a single region; multi-region requires Pro. Single-region-London is fine here, just confirm which plan the org ends up on.
- Static assets (HTML/CSS/JS) are cached across Vercel's global CDN regardless of function region — that's normal CDN behaviour and shouldn't matter for a residency requirement aimed at *data* (documents, emails, names), but worth explicitly confirming with whoever owns the compliance requirement that "static asset caching" isn't in scope.

Net: both platforms can satisfy a UK-only requirement for actual data at rest and function execution, provided the region is set explicitly rather than left as default. Worth a final confirmation from Legal/Compliance on exact scope before relying on this reading.

## Decisions made this session

**Session identity — kept simple.** No resumable sessions. The upload flow is short enough that nothing needs to survive a page reload or a return visit; as soon as a document and an email exist, that's sufficient. The one thing that matters is being able to say "this person uploaded these files" — that just needs the email captured on the landing page to be attached to the session id already generated for the upload, at the point of upload. No separate `sessions` table, no durable identity, no auth.

**Duplicate emails — allowed, not deduplicated.** If the same email goes through the flow twice, that's a second lead entry, not a blocked or merged one. No uniqueness constraint on the `leads` table. Deduplication (if ever needed) is a separate, later decision — not part of this migration.

**Document retention — keep by default.** The current filesystem store sweeps sessions after 12 hours, but that's a stand-in behaviour, not a design goal — it exists to stop a developer's laptop from accumulating test files, not because 12 hours is the right retention window. For the real backend, the default should be to keep uploaded documents rather than delete them, since a lead's documents are more useful the longer they're retrievable. If keeping them turns out to be difficult or costly (storage cost, a legal retention limit, and so on), the fallback is to keep the lead's email and name indefinitely and let the documents themselves expire — but that's a fallback, not the starting design.

**Access control — no row-level security needed for this MVP.** This is a pure lead-generation tool with no end-user authentication; nobody signs in to view their own documents through this app, and anyone who converts goes through Taxfix's actual sign-up product afterwards. That means there's no "user A shouldn't see user B's rows" scenario within this app — the only client that ever talks to Supabase is the Vercel backend itself, using a service-role key never exposed to the browser. Row-level security policies matter once end users can authenticate and query their own data directly from the client; that isn't this. Worth revisiting only if that changes.

## Target architecture

- **Vercel**: Next.js app, API routes (`upload`, `classify`, `chat`), unchanged logic, function region pinned to `lhr1` (London)
- **Supabase Storage**: one bucket for uploaded documents, private (not public), project region pinned to `eu-west-2` (London), accessed only server-side via the service-role key
- **Supabase Postgres**: a `leads` table (email, name, submitted_at, session_id) linking each lead to the session id their uploads are stored under; document metadata can live here too if useful, though the bytes themselves belong in Storage

`document-store.ts` gets rewritten against Supabase Storage, keeping its existing `(sessionId, docId) → bytes` interface so the chat route and upload flow don't change elsewhere.

## Build sequence (runbook)

Written so someone unfamiliar with this specific app can follow it once Vercel access lands. Each step names the concrete action, not just the goal.

1. **Create the Supabase project.** From the Supabase dashboard: New Project → choose the org → set region to **London (eu-west-2)** explicitly at creation time (region can't be changed after the fact without migrating). Note the project URL and the service-role key (Project Settings → API) — the service-role key is a secret, never a client-side value.
2. **Create the Storage bucket.** Storage → New Bucket → mark it **private** (not public). This is where document bytes live.
3. **Create the `leads` table.** Table editor → New Table: `email` (text), `name` (text), `submitted_at` (timestamp, default now()), `session_id` (text). No unique constraint on `email` — duplicates are allowed by design (see above).
4. **Add Supabase credentials to Vercel.** Project Settings → Environment Variables on the Vercel side: the Supabase project URL and service-role key, scoped to server-side use only (never prefixed `NEXT_PUBLIC_`, which would ship it to the browser).
5. **Set the Vercel function region.** Either in the dashboard (Settings → Functions → Function Regions) or in `vercel.json`:
   ```json
   { "regions": ["lhr1"] }
   ```
6. **Rewrite `document-store.ts`** against the Supabase Storage upload/download API (`@supabase/supabase-js`'s `storage.from(bucket).upload/download`), keeping `putDocument(sessionId, docId, doc)` / `getDocument(sessionId, docId)` as the external interface. No other file should need to change — that's the seam the current code was deliberately built around.
7. **Wire the landing page's email/name fields** to actually submit — a new API route (or extending an existing one) that writes a row into `leads` with the session id already generated for that page load.
8. **Confirm encryption in transit and at rest** — Supabase Storage and Postgres encrypt at rest by default, and both Vercel and Supabase terminate TLS. Still worth an explicit confirmation against the consent copy in `ONBOARDING-EXPERIMENT-FLOW.md`, which flags this as "not yet confirmed" there.
9. **Re-verify the local-only assumptions.** Check for any other place in the codebase that assumes one long-lived process with persistent disk (other uses of `os.tmpdir()`, module-level in-memory state) beyond `document-store.ts` — the audit `DEPLOYMENT-NOTES.md` already calls for.
10. **Deploy to Vercel** and do a real end-to-end test: upload a sample document, confirm it's retrievable via the chat's re-read tool call from a *different* invocation (not just the same warm instance) — this is the actual failure mode being fixed, so it's the one thing worth deliberately testing for rather than assuming works because it worked locally.

## Verification before merging

Confirm the document-store rewrite is covered by tests at the integration-backend layer (real Supabase Storage against the interface, not a mocked client) rather than unit tests alone, since the whole point of the rewrite is verifying it survives across separate invocations — a mocked client wouldn't catch that. Confirm the `leads` table write path degrades sensibly (doesn't block the upload flow) if the write ever fails.
