// The only file that knows which LLM vendor we use.
//
// Everything else (routes, prompts, context assembly) is provider-neutral,
// so moving to Vertex AI / Azure — which the UK-hosting requirement in
// ONBOARDING-EXPERIMENT-FLOW.md may force — means rewriting this file and
// nothing else.

import Anthropic from "@anthropic-ai/sdk";
import { UNRESOLVED_RESULT, type ClassifyResult } from "./classify";
import { CLASSIFY_PROMPT, CLASSIFY_SYSTEM } from "./prompts";

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY

/** Tunable without a code change — see .env.example.
 *  Model and effort are per-request parameters, not account settings.
 *  Set CLASSIFY_EFFORT=none for models that reject the parameter (Haiku 4.5
 *  returns a 400 for it). */
const MODEL = process.env.CLASSIFY_MODEL || "claude-sonnet-5";
const EFFORT = process.env.CLASSIFY_EFFORT || "low";
const EFFORT_PARAM =
  EFFORT === "none"
    ? {}
    : { output_config: { effort: EFFORT as "low" | "medium" | "high" | "xhigh" | "max" } };

export type DocumentInput = {
  base64: string;
  /** "application/pdf" or an image/* type. */
  mediaType: string;
};

/** Reads one document and returns the structured extraction, or
 *  UNRESOLVED_RESULT if the model's reply couldn't be parsed. */
export async function classifyDocument(doc: DocumentInput): Promise<ClassifyResult> {
  const isPdf = doc.mediaType === "application/pdf";

  const docBlock = isPdf
    ? {
        type: "document" as const,
        source: { type: "base64" as const, media_type: "application/pdf" as const, data: doc.base64 },
      }
    : {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: doc.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: doc.base64,
        },
      };

  // No beta header: base64 PDF input is generally available. Passing `betas`
  // to this non-beta method would send it as an unknown body field and the
  // API would reject the request.
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: CLASSIFY_SYSTEM,
    ...EFFORT_PARAM,
    messages: [{ role: "user", content: [docBlock, { type: "text", text: CLASSIFY_PROMPT }] }],
  });

  const block = msg.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("No text block in model response");
  }

  const raw = block.text
    .trim()
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "");

  try {
    return JSON.parse(raw) as ClassifyResult;
  } catch {
    // Model returned something that isn't JSON — degrade rather than throw.
    return UNRESOLVED_RESULT;
  }
}

export const LLM_CONFIG = { model: MODEL, effort: EFFORT };
