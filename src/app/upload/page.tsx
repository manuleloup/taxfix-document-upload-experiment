"use client";

import { useEffect, useRef, useState } from "react";
import "./document-upload.css";
import {
  CheckIcon,
  DocIcon,
  LowConfidenceIcon,
  OverflowIcon,
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
  const [composeValue, setComposeValue] = useState("");
  const [expenseSelected, setExpenseSelected] = useState<Set<string>>(new Set());
  const [expenseLocked, setExpenseLocked] = useState(false);

  const docIdRef = useRef(0);
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
  }, [messages]);

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
    let result: ClassifyResult;
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/classify", { method: "POST", body: form });
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

    docIdRef.current += 1;
    const docId = docIdRef.current;
    const label = result.documentLabel || file.name;
    const source = result.org ? `${label} — ${result.org}` : label;
    setDocuments((prev) => [...prev, { id: docId, label, org: result.org, source }]);

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

  function sendComposeMessage() {
    const text = composeValue.trim();
    if (!text) return;
    addMsg({ from: "user", text });
    setComposeValue("");
    setTimeout(() => addMsg({ from: "assist", text: "Thanks — I've noted that and will flag it for your accountant to check." }), 300);
  }

  function attemptFinish() {
    const unresolved = allKeys.filter((k) => itemStatus(items[k]) === "pending");
    if (unresolved.length === 0) {
      setFinishConfirmOpen(false);
      addMsg({
        from: "assist",
        text: "Great — everything's sorted. In the real product this would take you through to your tax position summary.",
      });
      return;
    }
    setFinishConfirmOpen(true);
  }

  function renderDocEntryLine(entry: DocEntry, idx: number) {
    const tier = confidenceTier(entry.confidence);
    return (
      <div className={`pic-entry doc ${tier === "medium" ? "needs-check" : ""}`} key={idx}>
        <span className="pic-entry-icon" style={{ display: "flex" }}>
          {tier === "medium" ? <LowConfidenceIcon /> : <DocIcon />}
        </span>
        <span className="pic-entry-label">
          {entry.formatted} — {entry.source}
        </span>
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
          <span className="pic-entry-label">{it.manualEntry.formatted} — Entered by you</span>
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
        <button className="pic-toggle reactivate" title="Add this back" onClick={() => reactivate(key)}>
          <PlusIcon />
        </button>
      );
    } else {
      const open = openMenu === key;
      action = (
        <div className="pic-action-row">
          {status === "confirmed" && <div className="pic-val">{itemTotal(it)}</div>}
          <div className="pic-overflow-wrap">
            <button
              className={`pic-overflow-btn ${open ? "open" : ""}`}
              title="More options"
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenu(open ? null : key);
              }}
            >
              <OverflowIcon />
            </button>
            <div className={`pic-overflow-menu ${open ? "open" : ""}`}>
              <button
                className="pic-overflow-item"
                onClick={(e) => {
                  e.stopPropagation();
                  startEditManual(key);
                }}
              >
                <PlusIcon />
                <span>Add a value manually</span>
              </button>
              <button
                className="pic-overflow-item"
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
        </div>
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
              <button className="pic-more-toggle" onClick={() => toggleExpand(key)}>
                Show {rest} more
              </button>
            )}
            {expanded && allLines.length > 3 && (
              <button className="pic-more-toggle" onClick={() => toggleExpand(key)}>
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
        <div>
          <div className="pic-name">{it.name}</div>
          {status !== "dismissed" && <div className="pic-hint">{it.hint}</div>}
          {entriesHtml}
        </div>
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
            <h1>Upload your documents to see your tax position</h1>
            <p>
              Drop in whatever you have. We&rsquo;ll work out what it tells us — and ask you the odd quick question
              for anything a document can&rsquo;t answer on its own.
            </p>
          </div>

          <div className="docs-card">
            <div className="docs-head">
              <span className="docs-eyebrow">Your documents</span>
              <span className="docs-count">{documents.length} added</span>
            </div>
            <div className="docs-list">
              {shownDocs.map((d) => (
                <div className="doc-row" key={d.id}>
                  <DocIcon />
                  <span className="doc-row-name">{d.label}</span>
                  <span className="doc-row-org">{d.org}</span>
                  <span className="doc-row-check">
                    <CheckIcon />
                  </span>
                  <button className="doc-row-del" title="Remove this document" onClick={() => removeDocument(d.id)}>
                    <TrashIcon />
                  </button>
                </div>
              ))}
              {docsRest > 0 && (
                <button className="pic-more-toggle" onClick={() => setExpandedDocs(true)}>
                  Show {docsRest} more
                </button>
              )}
              {expandedDocs && documents.length > 3 && (
                <button className="pic-more-toggle" onClick={() => setExpandedDocs(false)}>
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
                  <div className="spinner" />
                  <span>
                    Reading {uploadProgress && uploadProgress.total > 1 ? `${uploadProgress.current} of ${uploadProgress.total}` : "document"}
                    …
                  </span>
                </div>
              ) : (
                <div className="dz-idle">
                  <div className="dz-title">Drag a document here, or click to add one</div>
                  <div className="dz-sub">PDF, JPG or PNG — add as many as you have, any order</div>
                </div>
              )}
            </div>
          </div>

          <div className="picture-card">
            <div className="picture-head">
              <h2>What we can see so far</h2>
              <p>Every figure below comes from a document you gave us, or a question you answered.</p>
            </div>
            <div>
              {GROUPS.map((group) => (
                <div className="pic-group" key={group.label}>
                  <div className="pic-group-label">{group.label}</div>
                  {group.keys.length ? (
                    group.keys.map((key) => renderRow(key))
                  ) : (
                    <div className="pic-group-empty">{group.empty}</div>
                  )}
                </div>
              ))}
            </div>
            <div className="picture-footer">
              <span className="pf-note">
                {resolvedCount} of {allKeys.length} sorted
              </span>
              <button className="btn-primary" onClick={attemptFinish}>
                Submit for review
              </button>
            </div>
            {finishConfirmOpen && (
              <div className="finish-confirm">
                <div className="finish-confirm-title">A few things are still unresolved:</div>
                <div className="finish-confirm-list">
                  {unresolvedNames.map((n) => (
                    <div key={n}>• {n}</div>
                  ))}
                </div>
                <div className="finish-confirm-row">
                  <button onClick={() => setFinishConfirmOpen(false)}>Go back</button>
                  <button
                    className="go"
                    onClick={() => {
                      setFinishConfirmOpen(false);
                      addMsg({
                        from: "assist",
                        text: "Okay — continuing with what you've given us so far. Your accountant will flag anything still missing before filing.",
                      });
                    }}
                  >
                    Continue anyway
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>

        <aside className="convo-card">
          <div className="convo-title">Conversation</div>
          <div className="convo-log" ref={logRef}>
            {messages.map((m) => (
              <div className={`msg ${m.from}`} key={m.id}>
                {m.attach && (
                  <>
                    <div className="msg-attach">
                      <DocIcon />
                      <span>{m.attach}</span>
                    </div>
                    <br />
                  </>
                )}
                <div className="msg-bubble">
                  {m.text}
                  {m.result && (
                    <div className="msg-result">
                      <CheckIcon size={12} />
                      <span>{m.result}</span>
                    </div>
                  )}
                </div>
                {m.chips && (
                  <div className="msg-chips">
                    {m.chips.map((c, i) => (
                      <button key={i} className="msg-chip" disabled={m.chipsDisabled} onClick={() => answerChip(m.id, c)}>
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
                          className={`msg-chip ${expenseSelected.has(o) ? "selected" : ""}`}
                          disabled={expenseLocked}
                          onClick={() => toggleExpenseChip(o)}
                        >
                          {o}
                        </button>
                      ))}
                      <button className="msg-chip msg-chip-none" disabled={expenseLocked} onClick={() => finishExpenseChips(true)}>
                        None of these
                      </button>
                    </div>
                    {expenseSelected.size > 0 && !expenseLocked && (
                      <div className="msg-chips">
                        <button className="msg-chip msg-chip-confirm" onClick={() => finishExpenseChips(false)}>
                          Add these
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="compose">
            <input
              type="text"
              placeholder="Ask a question about your documents…"
              value={composeValue}
              onChange={(e) => setComposeValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendComposeMessage();
              }}
            />
            <button aria-label="Send" onClick={sendComposeMessage}>
              <SendIcon />
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
