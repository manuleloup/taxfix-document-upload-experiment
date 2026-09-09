import { NextResponse } from "next/server";
import { LLM_CONFIG, classifyDocument } from "@/app/_lib/llm";
import { isValidDocId, isValidSessionId, putDocument } from "@/app/_lib/document-store";
import { sniffMediaType } from "@/app/_lib/file-type";
import { MOCK_DOCUMENTS } from "./mock-documents";

/** Set CLASSIFY_MOCK=1 in .env to click through the flow with no API key
 *  and no spend. Which canned document you get is chosen by the `n` the
 *  client sends (its current upload count), so the sequence is deterministic
 *  and a page reload starts again from the first. */
const MOCK = process.env.CLASSIFY_MOCK === "1";

/** Testing escape hatch: keep the figures from a file the model judged not to
 *  be an issued record. For specimen-stamped fixtures during development —
 *  never set in anything resembling production. */
const ALLOW_UNVERIFIED = process.env.ALLOW_UNVERIFIED_DOCUMENTS === "1";

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  const sessionId = form.get("sessionId");
  const docId = Number(form.get("docId"));

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  // The client allocates the document id before uploading, so the stored
  // file lands under the same id the Tax picture and chat use to refer to it.
  if (!isValidSessionId(sessionId) || !isValidDocId(docId)) {
    return NextResponse.json({ error: "Missing or invalid sessionId/docId" }, { status: 400 });
  }

  // The file's own bytes decide what it is. file.type is client-controlled and
  // the extension is meaningless, so neither is consulted — and this runs
  // before the store write, so an unrecognised file never lands on disk or
  // reaches the model.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mediaType = sniffMediaType(bytes);
  if (!mediaType) {
    console.warn(`[classify] rejected ${file.name}: content is not PDF/JPEG/PNG/WebP/GIF` +
      (file.type ? ` (client claimed ${file.type})` : ""));
    return NextResponse.json(
      { error: "That file isn't a PDF, JPEG, PNG, WebP or GIF." },
      { status: 400 }
    );
  }

  const base64 = Buffer.from(bytes).toString("base64");

  // Kept for the rest of the session so /api/chat can re-read the original
  // if a question needs more than the extracted summary. Failing to store is
  // survivable — classification still works, chat just answers without it.
  try {
    await putDocument(sessionId, docId, { base64, mediaType, filename: file.name });
  } catch (err) {
    console.warn(`[classify] could not store ${file.name}:`, err);
  }

  // Mock short-circuits after the file-type gate and the store write, so both
  // still behave normally, but before any spend. The delay stands in for real
  // latency so the reading state is actually visible.
  if (MOCK) {
    const n = Number(new URL(request.url).searchParams.get("n") ?? 0);
    const mock = MOCK_DOCUMENTS[(Number.isFinite(n) ? Math.max(0, n) : 0) % MOCK_DOCUMENTS.length];
    await new Promise((r) => setTimeout(r, 700));
    console.log(`[classify:mock] ${file.name} → ${mock.documentLabel || "unresolved"}`);
    return NextResponse.json(mock);
  }

  try {
    const started = Date.now();
    const result = await classifyDocument({ base64, mediaType });

    // The model reports whether the file looks like an issued record; nothing
    // is discarded on the strength of it. The figures travel with the flag so
    // the person can be shown what was read and decide whether to use it —
    // this is a judgement about origin, not a security control, and the one
    // control here (the magic-byte sniff above) has no override at all.
    //
    // ALLOW_UNVERIFIED_DOCUMENTS=1 is the blunter dev version: it declares the
    // file verified so no question is asked, for clicking through fixtures
    // that print "SPECIMEN" without answering a chip every time.
    if (!result.issuedRecord) {
      if (ALLOW_UNVERIFIED) {
        console.warn(`[classify] ${file.name} → not an issued record, forced through (ALLOW_UNVERIFIED_DOCUMENTS=1)`);
        return NextResponse.json({ ...result, issuedRecord: true });
      }
      console.log(`[classify] ${file.name} → not an issued record, ${result.resolvedFields.length} field(s) offered for override`);
    }

    console.log(
      `[classify] ${file.name} → ${result.documentLabel || "unresolved"} ` +
        `(${result.resolvedFields.length} field(s)) ` +
        `${LLM_CONFIG.model}/${LLM_CONFIG.effort} in ${Date.now() - started}ms`
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[classify]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
