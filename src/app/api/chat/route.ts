import { NextResponse } from "next/server";
import { LLM_CONFIG, MAX_TOOL_CALLS, chatReply, type ChatTurn } from "@/app/_lib/llm";
import { getDocument, isValidDocId, isValidSessionId } from "@/app/_lib/document-store";
import type { ChatDocumentSummary, ChatPositionLine } from "@/app/_lib/prompts";

/** Same switch /api/classify uses — keeps the whole flow clickable with no
 *  API key and no spend. See .env.example. */
const MOCK = process.env.CLASSIFY_MOCK === "1";

/** Nothing is kept between requests: the browser sends the conversation, the
 *  document summaries and the current Tax Position each time. The only
 *  server-side state is the uploaded files themselves, which the browser
 *  refers to by id rather than resending — see _lib/document-store.ts. */
interface ChatBody {
  sessionId?: unknown;
  message?: unknown;
  history?: unknown;
  documents?: unknown;
  position?: unknown;
}

function parseHistory(value: unknown): ChatTurn[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((turn): ChatTurn[] => {
    const role = (turn as ChatTurn)?.role;
    const text = (turn as ChatTurn)?.text;
    if ((role !== "user" && role !== "assistant") || typeof text !== "string" || !text.trim()) {
      return [];
    }
    return [{ role, text }];
  });
}

function parseDocuments(value: unknown): ChatDocumentSummary[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((doc): ChatDocumentSummary[] => {
    const d = doc as ChatDocumentSummary;
    if (!isValidDocId(d?.docId)) return [];
    return [
      {
        docId: d.docId,
        label: String(d.label ?? ""),
        org: String(d.org ?? ""),
        taxYear: typeof d.taxYear === "string" ? d.taxYear : null,
        description: String(d.description ?? ""),
        fields: Array.isArray(d.fields)
          ? d.fields.map((f) => ({ label: String(f?.label ?? ""), value: String(f?.value ?? "") }))
          : [],
      },
    ];
  });
}

function parsePosition(value: unknown): ChatPositionLine[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((line): ChatPositionLine[] => {
    const l = line as ChatPositionLine;
    if (typeof l?.name !== "string") return [];
    const status =
      l.status === "confirmed" || l.status === "dismissed" || l.status === "pending"
        ? l.status
        : "pending";
    return [{ name: l.name, status, total: typeof l.total === "string" ? l.total : null }];
  });
}

export async function POST(request: Request) {
  let body: ChatBody;
  try {
    body = (await request.json()) as ChatBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sessionId, message } = body;
  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "No message" }, { status: 400 });
  }
  if (!isValidSessionId(sessionId)) {
    return NextResponse.json({ error: "Missing or invalid sessionId" }, { status: 400 });
  }

  const documents = parseDocuments(body.documents);

  if (MOCK) {
    await new Promise((r) => setTimeout(r, 700));
    console.log(`[chat:mock] "${message.slice(0, 60)}"`);
    return NextResponse.json({
      reply:
        "I've noted that and will flag it for your accountant to check. (Mock mode — set CLASSIFY_MOCK=0 for a real answer.)",
    });
  }

  try {
    const started = Date.now();
    const reply = await chatReply({
      message,
      history: parseHistory(body.history),
      documents,
      position: parsePosition(body.position),
      // The document list the browser just sent is the authority on what
      // exists: an id the client didn't list — a deleted document, or one
      // the model invented — is simply not available. That way removing a
      // document takes effect immediately, with nothing to clean up.
      loadDocument: async (docId) => {
        if (!documents.some((d) => d.docId === docId)) return null;
        return getDocument(sessionId, docId);
      },
    });

    console.log(
      `[chat] "${message.slice(0, 60)}" → ${reply.length} chars ` +
        `(${documents.length} doc(s) in context, ≤${MAX_TOOL_CALLS} re-reads) ` +
        `${LLM_CONFIG.model}/${LLM_CONFIG.effort} in ${Date.now() - started}ms`
    );
    return NextResponse.json({ reply });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[chat]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
