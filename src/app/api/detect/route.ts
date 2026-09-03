import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const ai = new Anthropic(); // reads ANTHROPIC_API_KEY from env

const SYSTEM = `You are a document classifier for a UK tax filing service.
A taxpayer has just uploaded a file as part of their annual Self Assessment return.`;

const PROMPT = `Examine this document and return ONLY a valid JSON object — no markdown, no explanation — with exactly these fields:

{
  "type": <one of: "P60", "P45", "P11D", "payslip", "rental_income_statement", "rental_expense_receipt", "mortgage_statement", "bank_statement", "invoice", "other">,
  "category": <one of: "paye_employment", "rental_income", "self_employment", "other">,
  "confidence": <number 0.0–1.0>,
  "description": <1-2 sentence description>,
  "tax_year": <"2023-24" style if visible, else null>,
  "key_figure": <main monetary figure e.g. "£45,234.00" if visible, else null>
}`;

const FALLBACK_RESULT = {
  type: "other",
  category: "other",
  confidence: 0,
  description: "Could not identify document",
  tax_year: null,
  key_figure: null,
};

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const isPdf = file.type === "application/pdf";
  const isImage = file.type.startsWith("image/");

  if (!isPdf && !isImage) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}` },
      { status: 400 }
    );
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  const docBlock = isPdf
    ? {
        type: "document" as const,
        source: {
          type: "base64" as const,
          media_type: "application/pdf" as const,
          data: base64,
        },
      }
    : {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: base64,
        },
      };

  try {
    const msg = await ai.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: SYSTEM,
      messages: [{ role: "user", content: [docBlock, { type: "text", text: PROMPT }] }],
      // Include PDF beta flag — harmless for non-PDF calls; needed on some model versions
      betas: ["pdfs-2024-09-25"],
    } as Anthropic.MessageCreateParamsNonStreaming);

    const block = msg.content[0];
    if (block.type !== "text") {
      throw new Error("Unexpected response content type from model");
    }

    const raw = block.text
      .trim()
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "");
    const result = JSON.parse(raw);

    console.log(
      `[detect] ${file.name} → ${result.type} (${result.category}, ${Math.round(result.confidence * 100)}%)`
    );
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof SyntaxError) {
      // Model returned non-JSON — fall back gracefully
      return NextResponse.json(FALLBACK_RESULT);
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[detect]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
