"use client";

import { useEffect, useRef, useState } from "react";
import "./document-upload.css";
import {
  CheckIcon,
  DocIcon,
  OverflowIcon,
  PencilIcon,
  PlusIcon,
  SendIcon,
  TrashIcon,
  XIcon,
  statusIcon,
} from "./_components/icons";

// Ported from taxfix-no-onboarding.html (vanilla JS prototype) into React
// state. Behavior is intentionally 1:1 with that file — see it for the
// original rationale comments this port carries forward.

type Status = "pending" | "confirmed" | "dismissed";

interface DocEntry {
  value: number;
  formatted: string;
  source: string;
  docId: number;
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

const INITIAL_ITEMS: Record<string, Item> = {
  employment: newItem("Employment income", "Salary, wages — from your P60 or payslips"),
  property: newItem("Property income", "Rent from letting a property"),
  savings: newItem("Savings interest", "Interest from banks and building societies"),
  selfEmployment: newItem("Self-employment income", "Freelance, contracting or gig work"),
  dividends: newItem("Dividend income", "Shares and funds"),
  capitalGains: newItem("Capital gains", "Sold shares, crypto, property or other assets"),
  foreignIncome: newItem("Foreign income", "Income or gains from outside the UK"),
  pension: newItem("Pension contributions", "Payments into a pension, via employer or yourself"),
  charity: newItem("Charity donations", "Gift Aid donations to charity"),
  studentLoan: newItem("Student loan repayments", "Repayments deducted via PAYE or made directly"),
  benefits: newItem("Benefits received", "Child Benefit, State Pension, JSA and similar"),
};

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

interface FollowUp {
  text: string;
  chips: { label: string; reply: string }[];
}
interface SampleDoc {
  itemKey: string;
  file: string;
  org: string;
  label: string;
  value: string;
  aiLine: string;
  matched: string;
  extraResolves?: { key: string; value: string; source: string }[];
  followUp?: FollowUp;
}

const SAMPLE_DOCS: SampleDoc[] = [
  {
    itemKey: "employment",
    file: "p60_VantageRetail.pdf",
    org: "Vantage Retail Ltd",
    label: "P60 2024–25",
    value: "£52,000.00",
    aiLine:
      "Read your P60: gross pay of £52,000.00 for the tax year, with £9,200.00 tax already deducted. It also shows pension contributions of £1,200.00 and student loan repayments of £1,050.00 through your employer — I've logged both.",
    matched: "Matched to Employment income",
    extraResolves: [
      { key: "pension", value: "£1,200.00", source: "P60 2024–25 — Vantage Retail Ltd" },
      { key: "studentLoan", value: "£1,050.00", source: "P60 2024–25 — Vantage Retail Ltd" },
    ],
  },
  {
    itemKey: "property",
    file: "letting_statement_AshbyRd.pdf",
    org: "14 Ashby Road",
    label: "Letting statement",
    value: "£9,600.00",
    aiLine: "Read your letting statement for 14 Ashby Road: rental income of £9,600.00 for the year.",
    matched: "Matched to Property income",
    followUp: {
      text: "Do you own this property jointly with someone else?",
      chips: [
        { label: "No, just me", reply: "Got it — I'll count all of it as yours." },
        { label: "Yes, jointly", reply: "Noted. I'll flag this for your accountant to confirm the split." },
      ],
    },
  },
  {
    itemKey: "savings",
    file: "interest_certificate_Northbrook.pdf",
    org: "Northbrook Bank",
    label: "Interest certificate",
    value: "£740.00",
    aiLine: "Read your interest certificate from Northbrook Bank: savings interest of £740.00 for the year.",
    matched: "Matched to Savings interest",
  },
];

const MORTGAGE_DOC: SampleDoc = {
  itemKey: "propertyExpenses",
  file: "mortgage_statement_AshbyRd.pdf",
  org: "Northbrook Bank",
  label: "Mortgage interest statement",
  value: "£2,150.00",
  aiLine: "Read your mortgage interest statement for 14 Ashby Road: £2,150.00 of mortgage interest paid this year.",
  matched: "Matched to Property expenses",
};

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

interface ChatMessage {
  id: number;
  from: "assist" | "user";
  attach?: string;
  text: string;
  result?: string;
  chips?: { label: string; reply: string }[];
  chipsDisabled?: boolean;
  isExpenseQuestion?: boolean;
}

export default function Home() {
  const [items, setItems] = useState<Record<string, Item>>(INITIAL_ITEMS);
  const [expenseKeys, setExpenseKeys] = useState<string[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [expandedDocs, setExpandedDocs] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [editingManualKey, setEditingManualKey] = useState<string | null>(null);
  const [manualDraft, setManualDraft] = useState("");
  const [sampleIndex, setSampleIndex] = useState(0);
  const [sampleDocs, setSampleDocs] = useState<SampleDoc[]>(SAMPLE_DOCS);
  const [dropzoneLoading, setDropzoneLoading] = useState(false);
  const [dropzoneDone, setDropzoneDone] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dropzoneHint, setDropzoneHint] = useState(false);
  const [mortgagePromptActive, setMortgagePromptActive] = useState(false);
  const [pendingFollowUp, setPendingFollowUp] = useState<
    { itemKey: string; value: string; source: string; docId: number } | null
  >(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [composeValue, setComposeValue] = useState("");
  const [expenseSelected, setExpenseSelected] = useState<Set<string>>(new Set());
  const [expenseLocked, setExpenseLocked] = useState(false);

  const docIdRef = useRef(0);
  const msgIdRef = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);

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

  function addDocEntry(key: string, formattedValue: string, source: string, docId: number) {
    setItems((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        docEntries: [
          ...prev[key].docEntries,
          { value: parseMoney(formattedValue), formatted: formattedValue, source, docId },
        ],
      },
    }));
  }

  function addSampleDoc() {
    if (sampleIndex >= sampleDocs.length) return;
    setDropzoneLoading(true);
    const doc = sampleDocs[sampleIndex];
    setTimeout(() => {
      setDropzoneLoading(false);
      const nextIndex = sampleIndex + 1;
      setSampleIndex(nextIndex);
      docIdRef.current += 1;
      const docId = docIdRef.current;
      setDocuments((prev) => [...prev, { id: docId, label: doc.label, org: doc.org, source: `${doc.label} — ${doc.org}` }]);

      if (nextIndex >= sampleDocs.length) setDropzoneDone(true);

      addMsg({ from: "assist", attach: doc.file, text: doc.aiLine, result: doc.matched });

      if (doc.followUp) {
        setPendingFollowUp({ itemKey: doc.itemKey, value: doc.value, source: `${doc.label} — ${doc.org}`, docId });
        setTimeout(() => {
          addMsg({ from: "assist", text: doc.followUp!.text, chips: doc.followUp!.chips });
        }, 350);
      } else {
        addDocEntry(doc.itemKey, doc.value, `${doc.label} — ${doc.org}`, docId);
      }

      if (doc.extraResolves) {
        doc.extraResolves.forEach((f) => addDocEntry(f.key, f.value, f.source, docId));
      }
    }, 800);
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

  function answerChip(chipIdx: number) {
    if (!pendingFollowUp) return;
    const doc = sampleDocs.find((d) => d.followUp && d.itemKey === pendingFollowUp.itemKey);
    if (!doc || !doc.followUp) return;
    const chip = doc.followUp.chips[chipIdx];

    setMessages((prev) => {
      const idx = prev.map((m) => !!m.chips).lastIndexOf(true);
      if (idx === -1) return prev;
      return prev.map((m, i) => (i === idx ? { ...m, chipsDisabled: true } : m));
    });
    addMsg({ from: "user", text: chip.label });
    setTimeout(() => addMsg({ from: "assist", text: chip.reply }), 300);
    addDocEntry(pendingFollowUp.itemKey, pendingFollowUp.value, pendingFollowUp.source, pendingFollowUp.docId);
    const wasProperty = pendingFollowUp.itemKey === "property";
    setPendingFollowUp(null);
    if (wasProperty) setTimeout(() => addExpenseQuestion(), 700);
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
        setSampleDocs((prev) => [...prev, MORTGAGE_DOC]);
        setDropzoneDone(false);
        setMortgagePromptActive(true);
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
    return (
      <div className="pic-entry doc" key={idx}>
        <span className="pic-entry-icon" style={{ display: "flex" }}>
          <DocIcon />
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
      <header className="header">
        <span className="logo">taxfix</span>
        <span className="logo-note">Prototype — document upload only, no onboarding questionnaire</span>
        <button className="reset-link" onClick={() => window.location.reload()}>
          ↺ Reset prototype
        </button>
      </header>

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
              onClick={dropzoneDone ? undefined : addSampleDoc}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (!dropzoneDone) addSampleDoc();
              }}
              style={{ cursor: dropzoneDone ? "default" : "pointer" }}
            >
              {dropzoneLoading ? (
                <div className="dz-loading">
                  <div className="spinner" />
                  <span>Reading document…</span>
                </div>
              ) : (
                <div className="dz-idle">
                  <div className="dz-title">
                    {dropzoneDone ? "That's every sample document" : "Drag a document here, or click to add one"}
                  </div>
                  <div className="dz-sub">
                    {dropzoneDone
                      ? "In the real product, you could keep adding more here."
                      : mortgagePromptActive
                        ? "We'll match it to the right category automatically"
                        : "PDF, JPG or PNG — add as many as you have, any order"}
                  </div>
                  {!dropzoneDone && (
                    <div className="dz-proto">
                      {mortgagePromptActive
                        ? "Prototype: click anywhere here to add the mortgage interest statement"
                        : "Prototype: click anywhere here to add the next sample document"}
                    </div>
                  )}
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
                      <button key={i} className="msg-chip" disabled={m.chipsDisabled} onClick={() => answerChip(i)}>
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
