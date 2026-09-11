import { NextResponse } from "next/server";

// Overlap check is a fast text-only call but give it headroom.
export const maxDuration = 30;
import { LLM_CONFIG, checkOverlap } from "@/app/_lib/llm";
import { isOverlapKey, type OverlapRequestBody, type OverlapVerdict } from "@/app/_lib/classify";
import type { ItemKey } from "@/app/_lib/classify";

/** Same switch /api/classify uses — keeps the whole flow clickable with no
 *  API key and no spend. See .env.example. */
const MOCK = process.env.CLASSIFY_MOCK === "1";

function parseBody(value: unknown): OverlapRequestBody | null {
  const body = value as OverlapRequestBody;
  if (!body || typeof body !== "object") return null;
  if (!Array.isArray(body.candidates) || body.candidates.length === 0) return null;
  if (!Array.isArray(body.existing) || body.existing.length === 0) return null;

  const candidates = body.candidates.filter(
    (c) => c && isOverlapKey(c.key as ItemKey) && typeof c.value === "string"
  );
  if (candidates.length === 0) return null;

  return {
    newDoc: {
      label: String(body.newDoc?.label ?? ""),
      org: String(body.newDoc?.org ?? ""),
      taxYear: typeof body.newDoc?.taxYear === "string" ? body.newDoc.taxYear : null,
      description: String(body.newDoc?.description ?? ""),
    },
    candidates: candidates.map((c) => ({
      key: c.key,
      value: String(c.value),
      label: String(c.label ?? ""),
    })),
    existing: body.existing.map((e) => ({
      key: e.key,
      formatted: String(e.formatted ?? ""),
      docLabel: String(e.docLabel ?? ""),
      org: String(e.org ?? ""),
      taxYear: typeof e.taxYear === "string" ? e.taxYear : null,
      description: String(e.description ?? ""),
    })),
  };
}

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const body = parseBody(raw);
  if (!body) {
    return NextResponse.json(
      { error: "Need newDoc, at least one candidate in an overlap category, and at least one existing entry" },
      { status: 400 }
    );
  }

  // The canned scenario really is an overlap — mock document 4 is a payslip
  // carrying year-to-date pay from the same employer and year as the P60 in
  // mock document 1 — so a confident "overlaps" is the honest stand-in.
  if (MOCK) {
    await new Promise((r) => setTimeout(r, 600));
    const verdicts: OverlapVerdict[] = body.candidates.map((c) => ({
      key: c.key,
      overlaps: true,
      confidence: 0.93,
      preferred: "existing",
      reason: `This looks like the same ${c.label || "figure"} already covered by "${
        body.existing[0]?.docLabel || "an earlier document"
      }" for the same employer and tax year.`,
    }));
    console.log(`[overlap:mock] ${body.candidates.map((c) => c.key).join(", ")} → overlaps`);
    return NextResponse.json({ verdicts });
  }

  try {
    const started = Date.now();
    const verdicts = await checkOverlap(body);

    console.log(
      `[overlap] ${body.newDoc.label || "(unlabelled)"} vs ${body.existing.length} entry(s) → ` +
        verdicts.map((v) => `${v.key}:${v.overlaps ? "overlap" : "additional"}@${v.confidence}`).join(" ") +
        ` ${LLM_CONFIG.model}/${LLM_CONFIG.effort} in ${Date.now() - started}ms`
    );
    return NextResponse.json({ verdicts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[overlap]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
