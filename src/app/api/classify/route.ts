import { NextResponse } from "next/server";
import { LLM_CONFIG, classifyDocument } from "@/app/_lib/llm";
import { MOCK_DOCUMENTS } from "./mock-documents";

/** Set CLASSIFY_MOCK=1 in .env to click through the flow with no API key
 *  and no spend. Which canned document you get is chosen by the `n` the
 *  client sends (its current upload count), so the sequence is deterministic
 *  and a page reload starts again from the first. */
const MOCK = process.env.CLASSIFY_MOCK === "1";

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const isPdf = file.type === "application/pdf";
  const isImage = file.type.startsWith("image/");
  if (!isPdf && !isImage) {
    return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 400 });
  }

  // Mock short-circuits after the file-type gate, so that still behaves
  // normally, but before any spend. The delay stands in for real latency so
  // the reading state is actually visible.
  if (MOCK) {
    const n = Number(new URL(request.url).searchParams.get("n") ?? 0);
    const mock = MOCK_DOCUMENTS[(Number.isFinite(n) ? Math.max(0, n) : 0) % MOCK_DOCUMENTS.length];
    await new Promise((r) => setTimeout(r, 700));
    console.log(`[classify:mock] ${file.name} → ${mock.documentLabel || "unresolved"}`);
    return NextResponse.json(mock);
  }

  try {
    const started = Date.now();
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const result = await classifyDocument({ base64, mediaType: file.type });

    console.log(
      `[classify] ${file.name} → ${result.documentLabel || "unresolved"} ` +
        `(${result.resolvedFields.length} field(s), trigger: ${result.trigger}) ` +
        `${LLM_CONFIG.model}/${LLM_CONFIG.effort} in ${Date.now() - started}ms`
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[classify]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
