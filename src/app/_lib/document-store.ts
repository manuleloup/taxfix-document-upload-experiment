// The only file that knows *where* uploaded documents are kept.
//
// Everything else asks for a document by (sessionId, docId) and gets bytes
// back, so replacing this with the real storage bucket — see
// DEPLOYMENT-NOTES.md at the repo root — means rewriting this file and
// nothing else. Same seam llm.ts gives us for the LLM vendor.
//
// ─────────────────────────────────────────────────────────────────────────
//  ⚠️  LOCAL-DEVELOPMENT STAND-IN — NOT A PRODUCTION DESIGN  ⚠️
//
//  This works *only* because the app currently runs as a single Node
//  process on one machine, so every request reaches the same filesystem.
//
//  It will NOT survive deployment to typical serverless hosting (Vercel
//  included): each request may land on a different short-lived instance
//  with its own ephemeral disk, so a document written while handling the
//  upload is very likely absent when a later chat request looks for it.
//  The failure is silent and data-dependent — get_document simply returns
//  "not found" and the model answers from summaries alone.
//
//  It is also unencrypted at rest, with no access control beyond an
//  unguessable folder name. Use sample/dummy paperwork while developing,
//  not real financial documents.
//
//  MUST be swapped for the real bucket before this runs anywhere beyond a
//  single developer's machine.
// ─────────────────────────────────────────────────────────────────────────

import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface StoredDocument {
  base64: string;
  /** "application/pdf" or an image/* type. */
  mediaType: string;
  filename: string;
}

/** Override to keep session folders somewhere you can inspect them.
 *  Defaults to the OS temp dir — outside the repo, so real documents can't
 *  be committed by accident, and swept by the OS as a backstop. */
const STORE_ROOT =
  process.env.DOCUMENT_STORE_DIR || path.join(os.tmpdir(), "taxfix-doc-upload-sessions");

/** A session's folder is deleted once it has been untouched this long, so
 *  test uploads don't accumulate on disk indefinitely. */
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
/** Sweeping walks the whole store, so don't do it on every single upload. */
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;

let lastSweep = 0;
let loggedRoot = false;

/** Session ids arrive from the browser and become a directory name, so they
 *  are checked against this before ever touching the filesystem — otherwise
 *  a crafted id like "../../etc" would escape the store. */
const SESSION_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

export function isValidSessionId(value: unknown): value is string {
  return typeof value === "string" && SESSION_ID_PATTERN.test(value);
}

export function isValidDocId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value < 1e6;
}

function sessionDir(sessionId: string): string {
  if (!isValidSessionId(sessionId)) throw new Error(`Invalid session id: ${sessionId}`);
  return path.join(STORE_ROOT, sessionId);
}

function docFile(sessionId: string, docId: number): string {
  if (!isValidDocId(docId)) throw new Error(`Invalid document id: ${docId}`);
  return path.join(sessionDir(sessionId), `${docId}.json`);
}

/** Keeps one uploaded document for the rest of the session. Bytes and
 *  content type travel together in one JSON file — the real bucket would
 *  store the object with its content-type as metadata instead. */
export async function putDocument(
  sessionId: string,
  docId: number,
  doc: StoredDocument
): Promise<void> {
  const file = docFile(sessionId, docId);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(doc), "utf8");

  if (!loggedRoot) {
    loggedRoot = true;
    console.log(`[document-store] session documents under ${STORE_ROOT}`);
  }

  void sweepStaleSessions();
}

/** Returns null for anything that isn't a readable document — unknown
 *  session, unknown id, a folder a serverless instance never saw. Callers
 *  treat all of those the same way: answer without the original file. */
export async function getDocument(
  sessionId: string,
  docId: number
): Promise<StoredDocument | null> {
  if (!isValidSessionId(sessionId) || !isValidDocId(docId)) return null;
  try {
    const raw = await readFile(docFile(sessionId, docId), "utf8");
    const doc = JSON.parse(raw) as StoredDocument;
    if (typeof doc?.base64 !== "string" || typeof doc?.mediaType !== "string") return null;
    return doc;
  } catch {
    return null;
  }
}

/** Best-effort, opportunistic cleanup: triggered by uploads rather than a
 *  timer, so it can't keep a process alive, and never allowed to fail one. */
async function sweepStaleSessions(): Promise<void> {
  const now = Date.now();
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;

  try {
    const entries = await readdir(STORE_ROOT, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(STORE_ROOT, entry.name);
      const info = await stat(dir);
      if (now - info.mtimeMs <= SESSION_TTL_MS) continue;
      await rm(dir, { recursive: true, force: true });
      console.log(`[document-store] swept stale session ${entry.name}`);
    }
  } catch {
    // Nothing to sweep, or the store isn't readable. Not worth reporting.
  }
}
