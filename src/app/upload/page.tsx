"use client";

import { useEffect, useRef, useState } from "react";
import "./document-upload.css";
import {
  CheckIcon,
  CircleCheckIcon,
  DocIcon,
  LowConfidenceIcon,
  ChevronDownIcon,
  PencilIcon,
  PlusIcon,
  SendIcon,
  TrashIcon,
  XIcon,
  statusIcon,
} from "../_components/icons";
import {
  CONFIDENCE_LOW,
  FOLLOW_UP_TABLE,
  ITEM_META,
  confidenceTier,
  type ClassifyResult,
  type ItemKey,
  type TriggerCode,
} from "../_lib/classify";
import Dialog from "../_components/dialog";

// Originally ported from taxfix-no-onboarding.html (a scripted wireframe).
// Upload is now real: a dropped/selected file is sent to /api/classify and
// the response drives the Tax Picture — see handleFileUpload below. Chat
// rendering, manual-entry editing, dismiss/reactivate, the expense-chip
// flow, and submit-for-review are otherwise unchanged from that port.

type Status = "pending" | "confirmed" | "dismissed";

interface DocEntry {
  value: number;
  formatted: string;
  source: string;
  docId: number;
  confidence: number;
}
interface ManualEntry {
  value: number;
  formatted: string;
}
interface Item {
  name: string;
  hint: string;
  dismissed: boolean;
  docEntries: DocEntry[];
  manualEntry: ManualEntry | null;
}

function newItem(name: string, hint: string): Item {
  return { name, hint, dismissed: false, docEntries: [], manualEntry: null };
}

function itemName(key: ItemKey): string {
  if (key === "propertyExpenses") return "Property expenses";
  return ITEM_META[key].name;
}

const INITIAL_ITEMS: Record<string, Item> = Object.fromEntries(
  Object.entries(ITEM_META).map(([key, { name, hint }]) => [key, newItem(name, hint)])
);

const INCOME_KEYS = [
  "employment",
  "property",
  "savings",
  "selfEmployment",
  "dividends",
  "capitalGains",
  "foreignIncome",
];
const DEDUCTION_KEYS = ["pension", "charity", "studentLoan", "benefits"];
const EXPENSES_EMPTY_TEXT =
  "Nothing yet — this fills in once you've told us about costs tied to an income source, like a property or self-employed work.";

/** Content hash of a dropped file, used to spot a file that has already been
 *  added this session. Matches on bytes, never the filename: a renamed copy
 *  is still the same document, and two unrelated documents can share a name.
 *
 *  Returns null when hashing isn't possible — crypto.subtle only exists in a
 *  secure context, so it's absent if the dev server is opened over plain HTTP
 *  on a LAN address rather than localhost. Callers then just skip the check
 *  and upload as normal, rather than blocking the upload outright. */
async function fileContentHash(file: File): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null;
  try {
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

function parseMoney(str: string): number {
  return parseFloat(String(str).replace(/[£,]/g, "")) || 0;
}
function formatMoney(num: number): string {
  return `£${num.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function itemStatus(item: Item): Status {
  if (item.dismissed) return "dismissed";
  return item.docEntries.length > 0 || item.manualEntry ? "confirmed" : "pending";
}
function itemTotal(item: Item): string {
  const sum =
    item.docEntries.reduce((s, e) => s + e.value, 0) + (item.manualEntry ? item.manualEntry.value : 0);
  return formatMoney(sum);
}

const EXPENSE_OPTIONS = [
  "Mortgage interest",
  "Repairs or maintenance",
  "Landlord insurance",
  "Management fees",
  "Travel to the property",
];

interface DocumentRow {
  id: number;
  label: string;
  org: string;
  source: string;
  /** SHA-256 of the uploaded file, for spotting byte-identical re-uploads.
   *  "" when the browser couldn't hash it — see fileContentHash. */
  hash: string;
  // The rest is what chat sends as this document's written summary, so a
  // question can usually be answered without re-reading the original file.
  taxYear: string | null;
  description: string;
  fields: { label: string; value: string }[];
}

interface ChipOption {
  label: string;
  reply: string;
  /** "manual" = open the manual editor instead of committing the pending value. */
  action?: "manual";
}

interface ChatMessage {
  id: number;
  from: "assist" | "user";
  attach?: string;
  text: string;
  result?: string;
  chips?: ChipOption[];
  chipsDisabled?: boolean;
  isExpenseQuestion?: boolean;
  /** Set only on real free-text exchanges. The scripted status lines, chip
   *  questions and upload confirmations that also live in this log are UI
   *  narration, not conversation, and aren't sent to the model as history. */
  conversational?: boolean;
}

interface PendingFollowUp {
  itemKey: ItemKey;
  value: string;
  source: string;
  docId: number;
  confidence: number;
  /** true = this is the low-confidence "does that look right?" gate, not a real ambiguity question. */
  isConfidenceCheck: boolean;
}

export default function UploadPage() {
  const [items, setItems] = useState<Record<string, Item>>(INITIAL_ITEMS);
  const [expenseKeys, setExpenseKeys] = useState<string[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [expandedDocs, setExpandedDocs] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [editingManualKey, setEditingManualKey] = useState<string | null>(null);
  const [manualDraft, setManualDraft] = useState("");
  const [dropzoneLoading, setDropzoneLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [dropzoneHint, setDropzoneHint] = useState(false);
  const [pendingFollowUp, setPendingFollowUp] = useState<PendingFollowUp | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [submittedOpen, setSubmittedOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [composeValue, setComposeValue] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [expenseSelected, setExpenseSelected] = useState<Set<string>>(new Set());
  const [expenseLocked, setExpenseLocked] = useState(false);

  // Names the server-side folder holding this session's uploaded files, so
  // one browser session's documents stay separate from another's. Generated
  // lazily on first use rather than during render: it's only ever needed
  // from an event handler, and a value generated during SSR wouldn't match
  // the one the client generates. A reload starts a fresh session, which is
  // also when docIdRef restarts from 1.
  const sessionIdRef = useRef<string | null>(null);
  function sessionId(): string {
    if (!sessionIdRef.current) sessionIdRef.current = crypto.randomUUID();
    return sessionIdRef.current;
  }

  // hash → label of the document it belongs to. Mirrors the `hash` field on
  // the rows in `documents`, which stays the source of truth; this index
  // exists because handleFiles awaits each upload in turn, so a `documents`
  // value captured from render would still be stale on the next iteration —
  // two identical files in one drop would slip through. Updated in the two
  // places rows are added and removed.
  const docHashesRef = useRef<Map<string, string>>(new Map());

  const docIdRef = useRef(0);
  // Upload sequence number, sent to the classifier only so CLASSIFY_MOCK can
  // return a deterministic script. Resets on reload; ignored in real mode.
  const uploadSeqRef = useRef(0);
  const msgIdRef = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const GROUPS: { label: string; keys: string[]; empty?: string }[] = [
    { label: "Income", keys: INCOME_KEYS },
    { label: "Expenses", keys: expenseKeys, empty: EXPENSES_EMPTY_TEXT },
    { label: "Deductions & benefits", keys: DEDUCTION_KEYS },
  ];
  const allKeys = [...INCOME_KEYS, ...expenseKeys, ...DEDUCTION_KEYS];
  const resolvedCount = allKeys.filter((k) => itemStatus(items[k]) !== "pending").length;
  const unresolvedNames = allKeys
    .filter((k) => itemStatus(items[k]) === "pending")
    .map((k) => items[k].name);

  function addMsg(msg: Omit<ChatMessage, "id">) {
    msgIdRef.current += 1;
    const id = msgIdRef.current;
    setMessages((prev) => [...prev, { id, chipsDisabled: false, ...msg }]);
  }

  // Initial greeting — guarded against Strict Mode's double-invoked mount effect.
  const greeted = useRef(false);
  useEffect(() => {
    if (greeted.current) return;
    greeted.current = true;
    addMsg({
      from: "assist",
      text:
        "Drop your documents in on the left, in any order. I'll read them and build your picture as we go — I'll only ask you something if a document can't answer it on its own.",
    });
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, chatLoading]);

  useEffect(() => {
    if (editingManualKey && manualInputRef.current) {
      manualInputRef.current.focus();
      manualInputRef.current.select();
    }
  }, [editingManualKey]);

  // Close any open row overflow menu on an outside click.
  useEffect(() => {
    function handleWindowClick() {
      if (openMenu) setOpenMenu(null);
    }
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, [openMenu]);

  function addDocEntry(key: string, formattedValue: string, source: string, docId: number, confidence: number) {
    setItems((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        docEntries: [
          ...prev[key].docEntries,
          { value: parseMoney(formattedValue), formatted: formattedValue, source, docId, confidence },
        ],
      },
    }));
  }

  /** Commits a resolved field, lazily creating its item row if it doesn't exist yet
   *  (e.g. a mortgage-interest statement arriving before the expense-chip flow ran). */
  function applyResolvedField(key: ItemKey, value: string, confidence: number, source: string, docId: number) {
    setItems((prev) => {
      if (prev[key]) return prev;
      return { ...prev, [key]: newItem(itemName(key), "") };
    });
    if (key === "propertyExpenses") {
      setExpenseKeys((prev) => (prev.includes("propertyExpenses") ? prev : [...prev, "propertyExpenses"]));
    }
    addDocEntry(key, value, source, docId, confidence);
  }

  async function handleFileUpload(file: File) {
    setDropzoneLoading(true);

    // A byte-identical re-upload is a no-op: no classify call (so no spend),
    // no second row, and nothing added to the Tax Position twice. Only exact
    // duplicates are caught — the same document re-scanned to different bytes,
    // and the P60/P45/payslip overlap, are separate problems.
    const hash = await fileContentHash(file);
    const duplicateOf = hash ? docHashesRef.current.get(hash) : undefined;
    if (duplicateOf) {
      setDropzoneLoading(false);
      addMsg({
        from: "assist",
        attach: file.name,
        text: `That's the same file as ${duplicateOf}, which you've already added — I've left your picture as it is.`,
      });
      return;
    }

    // Allocated before the upload so the server can file the stored original
    // under the same id this document keeps in the Tax Position and in chat.
    // An unreadable document burns an id — harmless, they're internal.
    docIdRef.current += 1;
    const docId = docIdRef.current;

    let result: ClassifyResult;
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("sessionId", sessionId());
      form.append("docId", String(docId));
      const seq = uploadSeqRef.current++;
      const res = await fetch(`/api/classify?n=${seq}`, { method: "POST", body: form });
      if (!res.ok) {
        throw new Error(`Upload failed (${res.status})`);
      }
      result = await res.json();
    } catch {
      setDropzoneLoading(false);
      addMsg({ from: "assist", text: "Couldn't read that document clearly — try a clearer scan or photo." });
      return;
    }
    setDropzoneLoading(false);

    if (result.unresolved || result.resolvedFields.length === 0) {
      addMsg({ from: "assist", text: result.description || "Couldn't read that document clearly — try a clearer scan or photo." });
      return;
    }

    const label = result.documentLabel || file.name;
    const source = result.org ? `${label} — ${result.org}` : label;
    setDocuments((prev) => [
      ...prev,
      {
        id: docId,
        label,
        org: result.org,
        source,
        hash: hash ?? "",
        taxYear: result.taxYear,
        description: result.description,
        fields: result.resolvedFields.map((f) => ({ label: f.label, value: f.value })),
      },
    ]);
    // Registered only once the document is actually on the list, so a failed
    // or unreadable upload doesn't block a retry of the same file.
    if (hash) docHashesRef.current.set(hash, label);

    const matchedNames = result.resolvedFields.map((f) => itemName(f.key)).join(", ");
    addMsg({ from: "assist", attach: file.name, text: result.description, result: `Matched to ${matchedNames}` });

    // Only one gated question can be held at a time — fine for the demo
    // documents this pass targets; a document producing more than one
    // gated field at once isn't handled yet (deliberately deferred).
    for (const field of result.resolvedFields) {
      const isGated = result.trigger !== "none" && result.followUpItemKey === field.key;
      if (isGated) {
        const question = FOLLOW_UP_TABLE[result.trigger as Exclude<TriggerCode, "none">];
        setPendingFollowUp({
          itemKey: field.key,
          value: field.value,
          source,
          docId,
          confidence: field.confidence,
          isConfidenceCheck: false,
        });
        setTimeout(() => addMsg({ from: "assist", text: question.text, chips: question.options }), 350);
      } else if (field.confidence < CONFIDENCE_LOW) {
        setPendingFollowUp({
          itemKey: field.key,
          value: field.value,
          source,
          docId,
          confidence: field.confidence,
          isConfidenceCheck: true,
        });
        setTimeout(
          () =>
            addMsg({
              from: "assist",
              text: `This reads as ${field.value} for ${itemName(field.key).toLowerCase()} — does that look right?`,
              chips: [
                { label: "Yes, that's right", reply: "Thanks, noted." },
                { label: "Let me check it", reply: "No problem — take a look and adjust it.", action: "manual" },
              ],
            }),
          350
        );
      } else {
        applyResolvedField(field.key, field.value, field.confidence, source, docId);
      }
    }
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    for (let i = 0; i < files.length; i++) {
      setUploadProgress({ current: i + 1, total: files.length });
      await handleFileUpload(files[i]);
    }
    setUploadProgress(null);
  }

  function removeDocument(id: number) {
    const doc = documents.find((d) => d.id === id);
    if (!doc) return;
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    // Removing a document makes it uploadable again.
    if (doc.hash) docHashesRef.current.delete(doc.hash);
    setItems((prev) => {
      const next: Record<string, Item> = { ...prev };
      for (const key of Object.keys(next)) {
        next[key] = { ...next[key], docEntries: next[key].docEntries.filter((e) => e.docId !== id) };
      }
      return next;
    });
    addMsg({
      from: "assist",
      text: `Removed ${doc.label} — I've taken out anything it added to your picture. Document-sourced values can only be removed this way, so nothing gets out of sync with what you've actually uploaded.`,
    });
  }

  function startEditManual(key: string) {
    setOpenMenu(null);
    setEditingManualKey(key);
    setManualDraft(items[key].manualEntry ? String(items[key].manualEntry!.value) : "");
  }
  function saveManualValue(key: string) {
    const raw = manualDraft.trim();
    setEditingManualKey(null);
    if (!raw) return;
    const amount = parseFloat(raw.replace(/[£,]/g, ""));
    if (!isNaN(amount)) {
      setItems((prev) => ({
        ...prev,
        [key]: { ...prev[key], manualEntry: { value: amount, formatted: formatMoney(amount) } },
      }));
    }
  }
  function deleteManualEntry(key: string) {
    setItems((prev) => ({ ...prev, [key]: { ...prev[key], manualEntry: null } }));
  }

  function toggleExpand(key: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function dismiss(key: string) {
    setOpenMenu(null);
    setItems((prev) => ({ ...prev, [key]: { ...prev[key], dismissed: true } }));
    addMsg({ from: "user", text: `${items[key].name} doesn't apply to me` });
    setTimeout(
      () =>
        addMsg({
          from: "assist",
          text: `Got it — I'll leave ${items[key].name.toLowerCase()} out of your picture. Tap the + next to it any time if that changes.`,
        }),
      300
    );
  }
  function reactivate(key: string) {
    setItems((prev) => ({ ...prev, [key]: { ...prev[key], dismissed: false } }));
    addMsg({ from: "user", text: `Actually, add ${items[key].name.toLowerCase()} back` });
    setTimeout(
      () => addMsg({ from: "assist", text: `No problem — ${items[key].name.toLowerCase()} is back on your list.` }),
      300
    );
  }

  function answerChip(msgId: number, chip: ChipOption) {
    if (!pendingFollowUp) return;
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, chipsDisabled: true } : m)));
    addMsg({ from: "user", text: chip.label });
    setTimeout(() => addMsg({ from: "assist", text: chip.reply }), 300);

    const followUp = pendingFollowUp;
    setPendingFollowUp(null);

    if (chip.action === "manual") {
      startEditManual(followUp.itemKey);
      return;
    }

    const confidence = followUp.isConfidenceCheck ? 1 : followUp.confidence;
    applyResolvedField(followUp.itemKey, followUp.value, confidence, followUp.source, followUp.docId);
    if (followUp.itemKey === "property") setTimeout(() => addExpenseQuestion(), 700);
  }

  function addExpenseQuestion() {
    setExpenseSelected(new Set());
    setExpenseLocked(false);
    addMsg({
      from: "assist",
      isExpenseQuestion: true,
      text: "Any costs on this property — mortgage interest, repairs, insurance, management fees, or travel to the property?",
    });
  }
  function toggleExpenseChip(option: string) {
    setExpenseSelected((prev) => {
      const next = new Set(prev);
      if (next.has(option)) next.delete(option);
      else next.add(option);
      return next;
    });
  }
  function finishExpenseChips(none: boolean) {
    const selected = none ? [] : Array.from(expenseSelected);
    setExpenseLocked(true);

    if (none || selected.length === 0) {
      addMsg({ from: "user", text: "No costs to add" });
      setTimeout(() => addMsg({ from: "assist", text: "Got it — I'll leave property expenses out of your picture." }), 300);
      return;
    }

    addMsg({ from: "user", text: selected.join(", ") });
    setTimeout(() => {
      setItems((prev) =>
        prev.propertyExpenses ? prev : { ...prev, propertyExpenses: newItem("Property expenses", selected.join(" · ")) }
      );
      setExpenseKeys((prev) => (prev.includes("propertyExpenses") ? prev : [...prev, "propertyExpenses"]));

      let followText = `Noted — ${selected.join(", ").toLowerCase()}. `;
      if (selected.includes("Mortgage interest")) {
        followText +=
          "If you've got your mortgage interest statement, drop it into the upload area on the left and I'll match it automatically.";
        setDropzoneHint(true);
        setTimeout(() => setDropzoneHint(false), 2400);
      } else {
        followText += "Add any receipts for these to the upload area on the left whenever you have them.";
      }
      addMsg({ from: "assist", text: followText });
    }, 300);
  }

  /** What the model sees of the Tax Position: every line, whether or not it
   *  has a figure, so it can answer "what's left?" as well as "what's in?". */
  function positionLines() {
    return allKeys.map((key) => {
      const status = itemStatus(items[key]);
      return {
        name: items[key].name,
        status,
        total: status === "confirmed" ? itemTotal(items[key]) : null,
      };
    });
  }

  async function sendComposeMessage() {
    const text = composeValue.trim();
    if (!text || chatLoading) return;

    // Captured before the new turn is appended — it goes up as `message`.
    const history = messages
      .filter((m) => m.conversational)
      .map((m) => ({ role: m.from === "user" ? ("user" as const) : ("assistant" as const), text: m.text }));

    addMsg({ from: "user", text, conversational: true });
    setComposeValue("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId(),
          message: text,
          history,
          // Summaries only. The originals stay on the server, and the model
          // re-reads one by id via get_document if a question needs it.
          documents: documents.map((d) => ({
            docId: d.id,
            label: d.label,
            org: d.org,
            taxYear: d.taxYear,
            description: d.description,
            fields: d.fields,
          })),
          position: positionLines(),
        }),
      });
      if (!res.ok) throw new Error(`Chat failed (${res.status})`);
      const data: { reply?: string } = await res.json();
      if (!data.reply?.trim()) throw new Error("Empty reply");
      addMsg({ from: "assist", text: data.reply, conversational: true });
    } catch {
      addMsg({
        from: "assist",
        text: "Something went wrong answering that — give it another go in a moment.",
      });
    } finally {
      setChatLoading(false);
    }
  }

  function attemptFinish() {
    const unresolved = allKeys.filter((k) => itemStatus(items[k]) === "pending");
    if (unresolved.length === 0) {
      setFinishConfirmOpen(false);
      setSubmittedOpen(true);
      return;
    }
    setFinishConfirmOpen(true);
  }

  function renderDocEntryLine(entry: DocEntry, idx: number) {
    const tier = confidenceTier(entry.confidence);
    return (
      <div className={`pic-entry doc ${tier === "medium" ? "needs-check" : ""}`} key={idx}>
        <span className="pic-entry-icon" style={{ display: "flex" }}>
          {tier === "medium" ? <LowConfidenceIcon size={12} /> : <DocIcon size={12} />}
        </span>
        <span className="t-caption pic-entry-amount">{entry.formatted}</span>
        <span className="t-caption pic-entry-label">{entry.source}</span>
      </div>
    );
  }

  function renderManualLine(key: string) {
    const it = items[key];
    if (editingManualKey === key) {
      return (
        <div className="pic-entry manual editing" key="manual-editing">
          <span className="pic-entry-icon" style={{ display: "flex" }}>
            £
          </span>
          <input
            ref={manualInputRef}
            type="text"
            inputMode="decimal"
            className="pic-entry-input"
            value={manualDraft}
            placeholder="0.00"
            onChange={(e) => setManualDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveManualValue(key);
              if (e.key === "Escape") setEditingManualKey(null);
            }}
          />
          <button className="pic-entry-save" title="Save" onClick={() => saveManualValue(key)}>
            <CheckIcon />
          </button>
        </div>
      );
    }
    if (it.manualEntry) {
      return (
        <div className="pic-entry manual" key="manual">
          <button className="pic-entry-edit" title="Edit this value" onClick={() => startEditManual(key)}>
            <PencilIcon />
          </button>
          <span className="t-caption pic-entry-amount">{it.manualEntry.formatted}</span>
          <span className="t-caption pic-entry-label">Added by you</span>
          <button className="pic-entry-del" title="Delete this value" onClick={() => deleteManualEntry(key)}>
            <TrashIcon />
          </button>
        </div>
      );
    }
    return null;
  }

  function renderRow(key: string) {
    const it = items[key];
    const status = itemStatus(it);

    let action: React.ReactNode;
    if (status === "dismissed") {
      action = (
        <button className="tf-iconbtn tf-iconbtn--small pic-toggle" title="Add this back" onClick={() => reactivate(key)}>
          <PlusIcon />
        </button>
      );
    } else {
      const open = openMenu === key;
      action = (
        <>
          {status === "confirmed" ? (
            <div className="t-h5 pic-val">{itemTotal(it)}</div>
          ) : (
            <div className="t-body pic-pending-label">Pending</div>
          )}
          <div className="pic-overflow-wrap">
            <button
              className={`tf-iconbtn tf-iconbtn--small pic-overflow-btn ${open ? "open" : ""}`}
              title="More options"
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenu(open ? null : key);
              }}
            >
              <ChevronDownIcon />
            </button>
            <div className={`pic-overflow-menu ${open ? "open" : ""}`}>
              <button
                className="t-bodySmall pic-overflow-item"
                onClick={(e) => {
                  e.stopPropagation();
                  startEditManual(key);
                }}
              >
                <PlusIcon />
                <span>Add a value manually</span>
              </button>
              <button
                className="t-bodySmall pic-overflow-item"
                onClick={(e) => {
                  e.stopPropagation();
                  dismiss(key);
                }}
              >
                <XIcon />
                <span>Remove section</span>
              </button>
            </div>
          </div>
        </>
      );
    }

    let entriesHtml: React.ReactNode = null;
    if (status !== "dismissed") {
      const lines = it.docEntries.map((entry, idx) => renderDocEntryLine(entry, idx));
      const manualLine = renderManualLine(key);
      const allLines = manualLine ? [...lines, manualLine] : lines;
      if (allLines.length) {
        const expanded = expandedRows.has(key);
        const shown = expanded ? allLines : allLines.slice(0, 3);
        const rest = allLines.length - shown.length;
        entriesHtml = (
          <div className="pic-entries">
            {shown}
            {rest > 0 && (
              <button className="t-caption pic-more-toggle" onClick={() => toggleExpand(key)}>
                Show {rest} more
              </button>
            )}
            {expanded && allLines.length > 3 && (
              <button className="t-caption pic-more-toggle" onClick={() => toggleExpand(key)}>
                Show less
              </button>
            )}
          </div>
        );
      }
    }

    return (
      <div className={`pic-row ${status}`} key={key}>
        <div className="pic-icon">{statusIcon(status)}</div>
        <div className="pic-info">
          <div className="t-body pic-name">{it.name}</div>
          {status !== "dismissed" && <div className="t-caption pic-hint">{it.hint}</div>}
          {entriesHtml}
        </div>
        <div className="pic-spacer" />
        <div className="pic-action">{action}</div>
      </div>
    );
  }

  const shownDocs = expandedDocs ? documents : documents.slice(0, 3);
  const docsRest = documents.length - shownDocs.length;

  return (
    <div className="doc-upload-app">
      <div className="page">
        <main>
          <div className="main-intro">
            <h1 className="t-h3">Upload your documents to see your tax position</h1>
            <p className="t-body">
              Drop in whatever you have. We will work out what it tells us — and ask the odd quick question for
              anything a document cannot answer on its own.
            </p>
          </div>

          <div className="tf-card tf-card--filled docs-card">
            <div className="docs-head">
              <h2 className="t-h5">Your documents</h2>
              <span className="t-bodySmall t-muted docs-count">{documents.length} added</span>
            </div>
            <div className="docs-list">
              {shownDocs.map((d) => (
                <div className="doc-row" key={d.id}>
                  <DocIcon size={20} />
                  <span className="t-body doc-row-name">{d.label}</span>
                  <span className="t-bodySmall doc-row-org">{d.org}</span>
                  <button className="tf-iconbtn tf-iconbtn--small doc-row-del" title="Remove this document" onClick={() => setPendingDelete(d.id)}>
                    <TrashIcon />
                  </button>
                  <span className="doc-row-spacer" />
                  <span className="doc-row-check">
                    <CircleCheckIcon size={20} />
                  </span>
                </div>
              ))}
              {docsRest > 0 && (
                <button className="t-caption pic-more-toggle" onClick={() => setExpandedDocs(true)}>
                  Show {docsRest} more
                </button>
              )}
              {expandedDocs && documents.length > 3 && (
                <button className="t-caption pic-more-toggle" onClick={() => setExpandedDocs(false)}>
                  Show less
                </button>
              )}
            </div>
            <div
              className={`dropzone ${dragOver ? "drag" : ""} ${dropzoneHint ? "hint" : ""} ${dropzoneLoading ? "loading" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFiles(e.dataTransfer.files);
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/*"
                multiple
                hidden
                onChange={(e) => {
                  handleFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              {dropzoneLoading ? (
                <div className="dz-loading">
                  <div className="tf-spinner" />
                  <span>
                    Reading {uploadProgress && uploadProgress.total > 1 ? `${uploadProgress.current} of ${uploadProgress.total}` : "document"}
                    …
                  </span>
                </div>
              ) : (
                <div className="dz-idle">
                  <div className="t-bodySmall dz-title">Drag a document here, or click to add one</div>
                  <div className="t-bodySmall dz-sub">PDF, JPG or PNG — add as many as you have, any order</div>
                </div>
              )}
            </div>
          </div>

          <div className="tf-card picture-card">
            <div className="picture-head">
              <h2 className="t-h5">Your Tax Position so far</h2>
              <p className="t-bodySmall">Every figure below comes from a document you gave us, or a question you answered.</p>
            </div>
            <div className="pic-groups">
              {GROUPS.map((group) => (
                <div className="pic-group" key={group.label}>
                  <div className="t-overline pic-group-label">{group.label}</div>
                  {group.keys.length ? (
                    <div className="pic-rows">{group.keys.map((key) => renderRow(key))}</div>
                  ) : (
                    <div className="t-caption pic-group-empty">{group.empty}</div>
                  )}
                </div>
              ))}
            </div>
            <div className="picture-footer">
              <span className="t-bodySmall pf-note">
                {resolvedCount} of {allKeys.length} sorted
              </span>
              <button className="tf-btn tf-btn--primary tf-btn--large t-button" onClick={attemptFinish}>
                Submit for review
              </button>
            </div>
          </div>
        </main>

        <aside className="tf-card tf-card--outlined convo-card">
          <div className="t-overline convo-title">Conversation</div>
          <div className="convo-log" ref={logRef}>
            {messages.map((m) => (
              <div className={`msg ${m.from}`} key={m.id}>
                {m.attach && (
                  <>
                    <div className="t-caption msg-attach">
                      <DocIcon />
                      <span>{m.attach}</span>
                    </div>
                    <br />
                  </>
                )}
                <div className="t-bodySmall msg-bubble">
                  {m.text}
                  {m.result && (
                    <div className="t-caption msg-result">
                      <CheckIcon size={12} />
                      <span>{m.result}</span>
                    </div>
                  )}
                </div>
                {m.chips && (
                  <div className="msg-chips">
                    {m.chips.map((c, i) => (
                      <button key={i} className="tf-chip tf-chip--medium tf-chip--selectable t-caption" disabled={m.chipsDisabled} onClick={() => answerChip(m.id, c)}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                )}
                {m.isExpenseQuestion && (
                  <>
                    <div className="msg-chips">
                      {EXPENSE_OPTIONS.map((o) => (
                        <button
                          key={o}
                          className={`tf-chip tf-chip--medium tf-chip--selectable t-caption ${expenseSelected.has(o) ? "is-selected" : ""}`}
                          disabled={expenseLocked}
                          onClick={() => toggleExpenseChip(o)}
                        >
                          {o}
                        </button>
                      ))}
                      <button className="tf-chip tf-chip--medium tf-chip--selectable t-caption" disabled={expenseLocked} onClick={() => finishExpenseChips(true)}>
                        None of these
                      </button>
                    </div>
                    {expenseSelected.size > 0 && !expenseLocked && (
                      <div className="msg-chips">
                        <button className="tf-btn tf-btn--primary tf-btn--medium t-buttonSmall" onClick={() => finishExpenseChips(false)}>
                          Add these
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
            {chatLoading && (
              <div className="msg assist" aria-live="polite">
                <div className="msg-bubble msg-typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
          </div>
          <div className="compose">
            <input
              type="text"
              placeholder="Ask a question about your documents…"
              value={composeValue}
              disabled={chatLoading}
              onChange={(e) => setComposeValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendComposeMessage();
              }}
            />
            <button
              aria-label="Send"
              className="tf-iconbtn tf-iconbtn--medium"
              disabled={chatLoading}
              onClick={sendComposeMessage}
            >
              <SendIcon />
            </button>
          </div>
        </aside>
      </div>

      {finishConfirmOpen && (
        <Dialog
          title="A few things are still unresolved"
          onClose={() => setFinishConfirmOpen(false)}
          actions={
            <>
              <button
                className="tf-btn tf-btn--secondary tf-btn--medium t-buttonSmall"
                onClick={() => setFinishConfirmOpen(false)}
              >
                Go back
              </button>
              <button
                className="tf-btn tf-btn--primary tf-btn--medium t-buttonSmall"
                onClick={() => {
                  setFinishConfirmOpen(false);
                  setSubmittedOpen(true);
                }}
              >
                Continue anyway
              </button>
            </>
          }
        >
          <p className="t-bodySmall">
            You can still submit — your accountant will flag anything missing before filing.
          </p>
          <ul className="t-bodySmall tf-dialog-list">
            {unresolvedNames.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Dialog>
      )}

      {submittedOpen && (
        <Dialog
          title="Sent for review"
          onClose={() => setSubmittedOpen(false)}
          actions={
            <button
              className="tf-btn tf-btn--primary tf-btn--medium t-buttonSmall"
              onClick={() => setSubmittedOpen(false)}
            >
              Done
            </button>
          }
        >
          <p className="t-bodySmall">
            One of our accountants will check your documents and this conversation, then email you. In the
            real product this would take you through to your tax position summary.
          </p>
        </Dialog>
      )}

      {pendingDelete !== null && (
        <Dialog
          title="Remove this document?"
          onClose={() => setPendingDelete(null)}
          actions={
            <>
              <button
                className="tf-btn tf-btn--secondary tf-btn--medium t-buttonSmall"
                onClick={() => setPendingDelete(null)}
              >
                Keep it
              </button>
              <button
                className="tf-btn tf-btn--primary tf-btn--medium t-buttonSmall"
                onClick={() => {
                  removeDocument(pendingDelete);
                  setPendingDelete(null);
                }}
              >
                Remove
              </button>
            </>
          }
        >
          <p className="t-bodySmall">
            Anything it added to your tax position will be removed too. This is the only way to take out a
            figure that came from a document, so nothing gets out of sync with what you uploaded.
          </p>
        </Dialog>
      )}
    </div>
  );
}
