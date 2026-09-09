"use client";

import { useEffect, useRef, useState } from "react";
import "./document-upload.css";
import {
  CheckIcon,
  CircleCheckIcon,
  DocIcon,
  LowConfidenceIcon,
  PencilIcon,
  PlusIcon,
  SendIcon,
  TrashIcon,
  statusIcon,
} from "../_components/icons";
import {
  CONFIDENCE_HIGH,
  CONFIDENCE_LOW,
  ITEM_META,
  isTriggeredKey,
  isOverlapKey,
  type ClassifyResult,
  type ItemKey,
  type ManualProposal,
  type OverlapCandidate,
  type OverlapExisting,
  type OverlapVerdict,
  type ResolvedField,
} from "../_lib/classify";
import { ACCEPT_ATTRIBUTE } from "../_lib/file-type";
import Dialog from "../_components/dialog";

// Originally ported from taxfix-no-onboarding.html (a scripted wireframe).
// Upload is now real: a dropped/selected file is sent to /api/classify and
// the response drives the tax picture — see handleFileUpload below. Chat
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
  return ITEM_META[key].name;
}

const INITIAL_ITEMS: Record<string, Item> = Object.fromEntries(
  Object.entries(ITEM_META).map(([key, { name, hint }]) => [key, newItem(name, hint)])
);

// Which rows sit above each group's own "Show more", and in what order.
// This split is editorial — the categories most people have — so it is
// written out here rather than derived from ITEM_META's group field, which
// says where a category belongs, not how prominent it is.
const INCOME_PRIMARY = ["employment", "property", "savings"];
const INCOME_SECONDARY = ["selfEmployment", "dividends", "otherIncome", "capitalGains", "foreignIncome"];
const TAX_PAID_KEYS = ["incomeTaxDeducted"];
const DEDUCTION_PRIMARY = ["pension", "studentLoan"];
const DEDUCTION_SECONDARY = ["charity", "benefits"];

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
/** True when any document-sourced figure in this row was read at less than
 *  full confidence. Manual entries are excluded: a figure a person typed is
 *  theirs, and the gate's "Yes, that's right" already commits at 1. */
function hasLowConfidenceEntry(item: Item): boolean {
  return item.docEntries.some((e) => e.confidence < CONFIDENCE_HIGH);
}
function itemTotal(item: Item): string {
  const sum =
    item.docEntries.reduce((s, e) => s + e.value, 0) + (item.manualEntry ? item.manualEntry.value : 0);
  return formatMoney(sum);
}

/** Empty until the real destinations exist: Nick's Calendly isn't set up
 *  yet, and there is no pricing route in this app (the pricing page lives on
 *  the marketing site). An <a> with no href renders inert, which is honest —
 *  better than navigating somewhere that isn't there. */
const BOOK_CALL_URL = "";
const PRICING_URL = "";

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
  /** False when the model didn't think this was an original issued record
   *  and the person chose to use it anyway. Lives on the document, not on
   *  each figure: it's one fact about the file. */
  issuedRecord: boolean;
  // The rest is what chat sends as this document's written summary, so a
  // question can usually be answered without re-reading the original file.
  taxYear: string | null;
  description: string;
  fields: { label: string; value: string }[];
}

interface ChipOption {
  label: string;
  reply: string;
  /** "manual" = open the manual editor instead of committing the pending
   *  value. "document" = commit nothing and invite a clearer document. */
  action?: "manual" | "document";
  /** Set on the chips of an overlap question; routes to answerOverlap, which
   *  builds its own reply from whatever it ends up committing. */
  overlapAnswer?: "additional" | "duplicate";
  /** Set on the chips of a document-origin question; routes to answerOrigin. */
  originAnswer?: "use" | "other";
  /** Set on the chips offering a figure the person mentioned in chat. */
  proposalAnswer?: "add" | "adjust";
}

/** A figure held back pending the person's answer on whether it's additional
 *  income or money already counted. */
interface HeldOverlap {
  itemKey: ItemKey;
  value: string;
  /** The reading confidence from classification, carried through unchanged:
   *  the question answered was whether the money is additional, not how well
   *  the figure was read. Recorded on the entry, not shown in the row. */
  confidence: number;
  source: string;
  docId: number;
  /** Documents whose figures this one appears to duplicate. */
  becauseOfDocIds: number[];
  /** Which record the model judged the fuller one. "new" means this figure
   *  should replace what's already counted rather than be dropped. */
  preferred: "existing" | "new";
  reason: string;
}

/** A figure that was left out of the position because it duplicated an
 *  earlier document. Recorded so that deleting the document it duplicated
 *  can point out that the figure may now be needed. */
interface Suppression {
  /** The document the left-out figure came from. */
  docId: number;
  docLabel: string;
  itemKey: ItemKey;
  value: string;
  becauseOfDocIds: number[];
}

/** "a, b and c" */
function humanList(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
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
  /** Set on a grouped "is this additional?" question. Its held figures live
   *  in pendingOverlaps under this message's id, so two documents can each
   *  hold their own question without one clobbering the other. */
  isOverlapQuestion?: boolean;
  /** Set on "use it anyway?" for a file the model didn't judge to be an
   *  original. Held figures live in pendingOrigins under this message's id. */
  isOriginQuestion?: boolean;
  /** Set on an offer to add a figure the person stated in conversation. The
   *  offer itself lives in pendingProposals under this message's id. */
  isProposalQuestion?: boolean;
  /** Set only on real free-text exchanges. The scripted status lines, chip
   *  questions and upload confirmations that also live in this log are UI
   *  narration, not conversation, and aren't sent to the model as history. */
  conversational?: boolean;
}

/** A figure the model couldn't read cleanly, waiting on "does that look
 *  right?". The only thing that holds one of these now — trigger-sourced
 *  questions are gone, so there is no second producer to clobber it. */
interface PendingFollowUp {
  itemKey: ItemKey;
  value: string;
  source: string;
  docId: number;
  /** Whether this figure's document itemised its own property costs, so the
   *  property-cost question isn't asked about costs already supplied. */
  docHadPropertyExpenses: boolean;
}

export default function UploadPage() {
  const [items, setItems] = useState<Record<string, Item>>(INITIAL_ITEMS);
  // Categories in the "triggered" group that something has since put a
  // figure into, in the order they were revealed.
  const [revealedKeys, setRevealedKeys] = useState<string[]>([]);
  // One flag per collapsible group. Kept separate so expanding Income
  // leaves Deductions & reliefs exactly as it was, and so a category
  // revealing itself mid-session disturbs neither.
  const [incomeExpanded, setIncomeExpanded] = useState(false);
  const [deductionsExpanded, setDeductionsExpanded] = useState(false);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [expandedDocs, setExpandedDocs] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [editingManualKey, setEditingManualKey] = useState<string | null>(null);
  const [manualDraft, setManualDraft] = useState("");
  const [dropzoneLoading, setDropzoneLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dropzoneHint, setDropzoneHint] = useState(false);
  const [pendingFollowUp, setPendingFollowUp] = useState<PendingFollowUp | null>(null);
  // Keyed by the id of the question message holding them, so concurrent
  // questions don't overwrite each other the way pendingFollowUp's single
  // slot does.
  const [pendingOverlaps, setPendingOverlaps] = useState<Record<number, HeldOverlap[]>>({});
  // Figures read off a file the model didn't judge to be an original,
  // waiting on "use it anyway?". Keyed by question message, same as above.
  const [pendingOrigins, setPendingOrigins] = useState<
    Record<number, { fields: ResolvedField[]; result: ClassifyResult; source: string; docId: number }>
  >({});
  // Figures the chat offered to add, waiting on the person. Nothing is
  // committed while one sits here.
  const [pendingProposals, setPendingProposals] = useState<Record<number, ManualProposal>>({});
  const [suppressions, setSuppressions] = useState<Suppression[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Freezing is a presentation state, not a data mutation: nothing is
  // destroyed, and "Edit your tax picture" returns to the editable view with
  // everything intact.
  const [frozen, setFrozen] = useState(false);
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

  const GROUPS: {
    label: string;
    primary: string[];
    secondary: string[];
    expanded: boolean;
    toggle?: () => void;
  }[] = [
    {
      label: "Income",
      primary: INCOME_PRIMARY,
      secondary: INCOME_SECONDARY,
      expanded: incomeExpanded,
      toggle: () => setIncomeExpanded((v) => !v),
    },
    { label: "Tax already paid", primary: TAX_PAID_KEYS, secondary: [], expanded: false },
    {
      label: "Deductions & reliefs",
      primary: DEDUCTION_PRIMARY,
      secondary: DEDUCTION_SECONDARY,
      expanded: deductionsExpanded,
      toggle: () => setDeductionsExpanded((v) => !v),
    },
    // Renders only once something has been filed under one of these.
    { label: "Also included", primary: revealedKeys, secondary: [], expanded: false },
  ];

  /** Rows actually on screen right now. The footer counts against this, not
   *  against every category that exists: a category still folded away behind
   *  "Show more", or one never revealed, would otherwise read as work
   *  outstanding when there is nothing there to do. */
  const visibleKeys = GROUPS.flatMap((g) => [...g.primary, ...(g.expanded ? g.secondary : [])]);

  /** What the chat model is told about, which is not the same list. A group
   *  folded shut is a UI state, not a fact about the return — the model
   *  should still answer "what's left?" with the categories behind it. An
   *  unrevealed triggered category is different: nothing has suggested the
   *  person has one, so naming it would invent a gap. */
  const positionKeys = [
    ...INCOME_PRIMARY,
    ...INCOME_SECONDARY,
    ...TAX_PAID_KEYS,
    ...DEDUCTION_PRIMARY,
    ...DEDUCTION_SECONDARY,
    ...revealedKeys,
  ];
  const resolvedCount = visibleKeys.filter((k) => itemStatus(items[k]) !== "pending").length;
  /** Every row either group could show, ignoring what is folded away — the
   *  frozen view has no "Show more", so a confirmed row hidden behind one
   *  still belongs in it. */
  const allGroupKeys = GROUPS.flatMap((g) => [...g.primary, ...g.secondary]);
  const confirmedCount = allGroupKeys.filter((k) => itemStatus(items[k]) === "confirmed").length;
  const pendingCount = visibleKeys.filter((k) => itemStatus(items[k]) === "pending").length;

  /** Returns the new message's id, so a question can file the state it holds
   *  against the message the person will answer on. */
  function addMsg(msg: Omit<ChatMessage, "id">): number {
    msgIdRef.current += 1;
    const id = msgIdRef.current;
    setMessages((prev) => [...prev, { id, chipsDisabled: false, ...msg }]);
    return id;
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

  // The position and document list as they stand *now*. handleFiles awaits
  // each upload in turn, so values captured from render are stale for every
  // file after the first — and the overlap check has to see entries the
  // previous file just committed. A classify fetch always separates one
  // file's check from the next, so this mirror is current by the time it's
  // read.
  const itemsRef = useRef(items);
  const documentsRef = useRef(documents);
  useEffect(() => {
    itemsRef.current = items;
    documentsRef.current = documents;
  }, [items, documents]);

  useEffect(() => {
    if (editingManualKey && manualInputRef.current) {
      manualInputRef.current.focus();
      manualInputRef.current.select();
    }
  }, [editingManualKey]);


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

  /** Puts a category on screen so a figure committed into it is actually
   *  seen. A row can be hidden two ways: a triggered category hasn't been
   *  revealed yet, or a secondary one is folded behind its group's "Show
   *  more". Either way, filing a figure into a row nobody can see reads as
   *  nothing having happened — the chat says "Matched to Dividend income"
   *  and the page doesn't move, footer included. */
  function revealCategory(key: ItemKey) {
    if (isTriggeredKey(key)) {
      setRevealedKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
      return;
    }
    if (INCOME_SECONDARY.includes(key)) setIncomeExpanded(true);
    else if (DEDUCTION_SECONDARY.includes(key)) setDeductionsExpanded(true);
  }

  /** Commits a resolved field. Every category has a row in INITIAL_ITEMS,
   *  but a triggered row stays hidden until something belongs in it — so a
   *  mortgage-interest statement arriving before the expense-chip flow ran,
   *  or a P11D landing in benefitsInKind, reveals the row itself. */
  function applyResolvedField(key: ItemKey, value: string, confidence: number, source: string, docId: number) {
    revealCategory(key);
    addDocEntry(key, value, source, docId, confidence);
  }

  /** Committed, document-sourced entries in this category that could be the
   *  same money: same tax year, or either year not stated. Manual entries are
   *  excluded — there's no document behind them to reason about. */
  function matchingEntries(key: ItemKey, taxYear: string | null) {
    const item = itemsRef.current[key];
    if (!item) return [];
    return item.docEntries.flatMap((entry) => {
      const doc = documentsRef.current.find((d) => d.id === entry.docId);
      if (!doc) return [];
      const yearsCouldMatch = !doc.taxYear || !taxYear || doc.taxYear === taxYear;
      return yearsCouldMatch ? [{ entry, doc }] : [];
    });
  }

  function existingFor(key: ItemKey, taxYear: string | null): OverlapExisting[] {
    return matchingEntries(key, taxYear).map(({ entry, doc }) => ({
      key,
      formatted: entry.formatted,
      docLabel: doc.label,
      org: doc.org,
      taxYear: doc.taxYear,
      description: doc.description,
    }));
  }

  /** Judges figures that might duplicate an earlier document, then either
   *  commits them, leaves them out with an explanation, or holds them for one
   *  grouped question. */
  async function resolveOverlaps(
    fields: ResolvedField[],
    result: ClassifyResult,
    source: string,
    docId: number
  ) {
    const candidates: OverlapCandidate[] = fields.map((f) => ({
      key: f.key,
      value: f.value,
      label: f.label,
    }));
    const existing = fields.flatMap((f) => existingFor(f.key, result.taxYear));
    const docLabel = result.documentLabel || "document";

    setChatLoading(true);
    let verdicts: OverlapVerdict[];
    try {
      const res = await fetch("/api/overlap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newDoc: {
            label: result.documentLabel,
            org: result.org,
            taxYear: result.taxYear,
            description: result.description,
          },
          candidates,
          existing,
        }),
      });
      if (!res.ok) throw new Error(`Overlap check failed (${res.status})`);
      const data: { verdicts?: OverlapVerdict[] } = await res.json();
      if (!Array.isArray(data.verdicts)) throw new Error("No verdicts");
      verdicts = data.verdicts;
    } catch {
      // Couldn't check — ask rather than guess in either direction.
      verdicts = candidates.map((c) => ({
        key: c.key,
        overlaps: false,
        confidence: 0,
        preferred: "existing" as const,
        reason: "I couldn't check this against your other documents.",
      }));
    } finally {
      setChatLoading(false);
    }

    const held: HeldOverlap[] = [];

    for (const field of fields) {
      const verdict = verdicts.find((v) => v.key === field.key);
      const becauseOfDocIds = [...new Set(matchingEntries(field.key, result.taxYear).map(({ doc }) => doc.id))];
      // CONFIDENCE_HIGH is the product's existing "confident enough" bar; a
      // judgement below it always goes to the person.
      const confident = !!verdict && verdict.confidence >= CONFIDENCE_HIGH;

      if (confident && verdict.overlaps) {
        if (verdict.preferred === "new") {
          // The new document is the fuller record — a P60 after a P45 — so it
          // takes the place of what's counted rather than being dropped for
          // arriving second. Still exactly one figure either way.
          const replaced = replaceOverlappingEntries(field, source, docId, becauseOfDocIds);
          addMsg({
            from: "assist",
            text:
              `I've replaced ${replaced || "the earlier figure"} with the ${field.value} for ` +
              `${itemName(field.key).toLowerCase()} from this document — ${verdict.reason}`,
          });
          continue;
        }
        // Left out, said plainly, no confirm step. Reversible by hand on the
        // row, which is also how a wrong call here gets corrected.
        setSuppressions((prev) => [
          ...prev,
          { docId, docLabel, itemKey: field.key, value: field.value, becauseOfDocIds },
        ]);
        addMsg({
          from: "assist",
          text:
            `I've left the ${field.value} for ${itemName(field.key).toLowerCase()} out of your picture — ` +
            `${verdict.reason} If you think it's separate, you can add it by hand on that row.`,
        });
        continue;
      }

      if (confident && !verdict.overlaps) {
        // Genuinely additional — a second employer, say. Today's behaviour.
        applyResolvedField(field.key, field.value, field.confidence, source, docId);
        continue;
      }

      held.push({
        itemKey: field.key,
        value: field.value,
        confidence: field.confidence,
        source,
        docId,
        becauseOfDocIds,
        preferred: verdict?.preferred ?? "existing",
        reason: verdict?.reason ?? "",
      });
    }

    if (held.length === 0) return;

    // One question for the whole document: the held figures are uncertain for
    // the same underlying reason, so asking about each separately would be
    // three ways of asking the same thing.
    const listed = humanList(held.map((h) => `${h.value} for ${itemName(h.itemKey).toLowerCase()}`));
    const reasons = [...new Set(held.map((h) => h.reason).filter(Boolean))].join(" ");
    const msgId = addMsg({
      from: "assist",
      isOverlapQuestion: true,
      text:
        `This ${docLabel} gives ${listed}, which may be money already counted from a document you've added. ` +
        `${reasons} Is it additional, or the same money?`,
      chips: [
        { label: "It's additional", reply: "", overlapAnswer: "additional" },
        { label: "Already counted", reply: "", overlapAnswer: "duplicate" },
      ],
    });
    setPendingOverlaps((prev) => ({ ...prev, [msgId]: held }));
  }

  /** Swaps the figures a document duplicated for the new document's own,
   *  keeping exactly one. Returns a description of what was displaced, for
   *  the chat line — "I've left X out" is the wrong sentence when it's the
   *  earlier figure that went. */
  function replaceOverlappingEntries(
    field: { key: ItemKey; value: string; confidence: number },
    source: string,
    docId: number,
    becauseOfDocIds: number[]
  ): string {
    const displaced = (itemsRef.current[field.key]?.docEntries ?? []).filter((e) =>
      becauseOfDocIds.includes(e.docId)
    );

    // Recorded against the document that displaced them, so removing the
    // newer record points out that the older figure may be needed again.
    setSuppressions((prev) => [
      ...prev,
      ...displaced.map((e) => ({
        docId: e.docId,
        docLabel: documentsRef.current.find((d) => d.id === e.docId)?.label ?? "an earlier document",
        itemKey: field.key,
        value: e.formatted,
        becauseOfDocIds: [docId],
      })),
    ]);

    setItems((prev) => ({
      ...prev,
      [field.key]: {
        ...prev[field.key],
        docEntries: prev[field.key].docEntries.filter((e) => !becauseOfDocIds.includes(e.docId)),
      },
    }));
    applyResolvedField(field.key, field.value, field.confidence, source, docId);

    return humanList(
      displaced.map(
        (e) =>
          `the ${e.formatted} from ${
            documentsRef.current.find((d) => d.id === e.docId)?.label ?? "an earlier document"
          }`
      )
    );
  }

  /** Answers an offer to add a figure from conversation. Adding runs the same
   *  commit a typed value runs; adjusting opens the same pre-filled field the
   *  confidence gate's "Correct the figure" opens. Neither is a new kind of
   *  entry — the chat is a second way into the existing one. */
  function answerProposal(msgId: number, chip: ChipOption) {
    const proposal = pendingProposals[msgId];
    if (!proposal) return;

    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, chipsDisabled: true } : m)));
    addMsg({ from: "user", text: chip.label });
    setPendingProposals((prev) => {
      const next = { ...prev };
      delete next[msgId];
      return next;
    });

    if (chip.proposalAnswer === "adjust") {
      startEditManual(proposal.itemKey, String(parseMoney(proposal.value)));
      setTimeout(
        () =>
          addMsg({
            from: "assist",
            text: `Sure — set ${itemName(proposal.itemKey).toLowerCase()} to whatever it should be.`,
          }),
        300
      );
      return;
    }

    const added = commitManualValue(proposal.itemKey, proposal.value);
    setTimeout(
      () =>
        addMsg({
          from: "assist",
          text: added
            ? `Added ${proposal.value} to ${itemName(proposal.itemKey).toLowerCase()}, marked as added by you.`
            : "I couldn't read that as an amount — add it on the row and it'll go straight in.",
        }),
      300
    );
  }

  function answerOverlap(msgId: number, chip: ChipOption) {
    const held = pendingOverlaps[msgId];
    if (!held) return;

    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, chipsDisabled: true } : m)));
    addMsg({ from: "user", text: chip.label });
    setPendingOverlaps((prev) => {
      const next = { ...prev };
      delete next[msgId];
      return next;
    });

    const listed = humanList(held.map((h) => `${h.value} for ${itemName(h.itemKey).toLowerCase()}`));

    if (chip.overlapAnswer === "additional") {
      for (const h of held) {
        // Keeps the reading confidence rather than forcing 1: the question
        // answered was whether the money is additional, not whether the
        // figure was read correctly.
        applyResolvedField(h.itemKey, h.value, h.confidence, h.source, h.docId);
      }
      setTimeout(() => addMsg({ from: "assist", text: `Thanks — I've added ${listed} to your picture.` }), 300);
      return;
    }

    // "Already counted" doesn't mean "discard the new one": whichever record
    // is the fuller account of the figure is the one kept.
    const supersedes = held.filter((h) => h.preferred === "new");
    const dropped = held.filter((h) => h.preferred !== "new");

    const replacedText = supersedes
      .map((h) =>
        replaceOverlappingEntries(
          { key: h.itemKey, value: h.value, confidence: h.confidence },
          h.source,
          h.docId,
          h.becauseOfDocIds
        )
      )
      .filter(Boolean);

    setSuppressions((prev) => [
      ...prev,
      ...dropped.map((h) => ({
        docId: h.docId,
        docLabel: documentsRef.current.find((d) => d.id === h.docId)?.label ?? "that document",
        itemKey: h.itemKey,
        value: h.value,
        becauseOfDocIds: h.becauseOfDocIds,
      })),
    ]);

    const sentences: string[] = [];
    if (dropped.length) {
      sentences.push(
        `I've left ${humanList(
          dropped.map((h) => `${h.value} for ${itemName(h.itemKey).toLowerCase()}`)
        )} out`
      );
    }
    if (supersedes.length) {
      sentences.push(
        `I've kept ${humanList(
          supersedes.map((h) => `${h.value} for ${itemName(h.itemKey).toLowerCase()}`)
        )} from this document instead of ${humanList(replacedText) || "the earlier figure"}`
      );
    }
    setTimeout(
      () =>
        addMsg({
          from: "assist",
          text: `Got it — ${humanList(sentences)}, so nothing gets counted twice.`,
        }),
      300
    );
  }

  async function handleFileUpload(file: File) {
    setDropzoneLoading(true);

    // A byte-identical re-upload is a no-op: no classify call (so no spend),
    // no second row, and nothing added to the Tax picture twice. Only exact
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
    // under the same id this document keeps in the Tax picture and in chat.
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
        issuedRecord: result.issuedRecord,
        taxYear: result.taxYear,
        description: result.description,
        fields: result.resolvedFields.map((f) => ({ label: f.label, value: f.value })),
      },
    ]);
    // Registered only once the document is actually on the list, so a failed
    // or unreadable upload doesn't block a retry of the same file.
    if (hash) docHashesRef.current.set(hash, label);

    // A file the model didn't judge to be an original still gets read, and
    // what it read is still shown — the person decides whether to use it,
    // rather than being handed a dead end. Nothing commits until they do.
    if (!result.issuedRecord) {
      addMsg({ from: "assist", attach: file.name, text: result.description });
      const msgId = addMsg({
        from: "assist",
        isOriginQuestion: true,
        text:
          `I don't think this is an original ${label.toLowerCase()}${result.org ? ` from ${result.org}` : ""} — ` +
          `it doesn't carry the marks of an issued record, so I've left it out of your picture for now. ` +
          `I did read ${humanList(result.resolvedFields.map((f) => `${f.value} for ${itemName(f.key).toLowerCase()}`))}. Use it anyway?`,
        chips: [
          { label: "Use it anyway", reply: "", originAnswer: "use" },
          { label: "I'll upload something else", reply: "", originAnswer: "other" },
        ],
      });
      setPendingOrigins((prev) => ({
        ...prev,
        [msgId]: { fields: result.resolvedFields, result, source, docId },
      }));
      return;
    }

    const matchedNames = result.resolvedFields.map((f) => itemName(f.key)).join(", ");
    addMsg({ from: "assist", attach: file.name, text: result.description, result: `Matched to ${matchedNames}` });

    await processResolvedFields(result.resolvedFields, result, source, docId);
  }

  /** Answers "use it anyway?" for a file the model didn't judge to be an
   *  original. Using it runs the identical pipeline a trusted document runs,
   *  so the confidence gate and the overlap check still apply — the override
   *  is about origin, and says nothing about whether a figure was read well
   *  or already counted. The entries stay tagged via the document's
   *  issuedRecord flag. */
  async function answerOrigin(msgId: number, chip: ChipOption) {
    const held = pendingOrigins[msgId];
    if (!held) return;

    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, chipsDisabled: true } : m)));
    addMsg({ from: "user", text: chip.label });
    setPendingOrigins((prev) => {
      const next = { ...prev };
      delete next[msgId];
      return next;
    });

    if (chip.originAnswer === "other") {
      // Same shape as the confidence gate's "I'll upload proof": commits
      // nothing, holds nothing, just points at the dropzone.
      setDropzoneHint(true);
      setTimeout(() => setDropzoneHint(false), 2400);
      setTimeout(
        () =>
          addMsg({
            from: "assist",
            text: "No problem — drop the original in on the left whenever you have it and I'll read that instead.",
          }),
        300
      );
      return;
    }

    setTimeout(
      () =>
        addMsg({
          from: "assist",
          text: "Added — I've marked those figures as not verified against an original, so your accountant can see where they came from.",
        }),
      300
    );
    await processResolvedFields(held.fields, held.result, held.source, held.docId);
  }

  /** Commits a document's figures: holds anything too unclear to trust,
   *  sends anything that might duplicate an earlier document to the overlap
   *  check, and commits the rest. Split out of handleFileUpload so the
   *  "use it anyway" override runs the identical pipeline rather than a
   *  parallel one that could drift from it. */
  async function processResolvedFields(
    fields: ResolvedField[],
    result: ClassifyResult,
    source: string,
    docId: number
  ) {
    // Figures that could be money already counted from an earlier document
    // are set aside and judged together, in one check, before anything is
    // committed.
    const overlapFields: ResolvedField[] = [];
    const plainFields: ResolvedField[] = [];
    for (const field of fields) {
      const couldOverlap =
        isOverlapKey(field.key) && matchingEntries(field.key, result.taxYear).length > 0;
      (couldOverlap ? overlapFields : plainFields).push(field);
    }

    // A statement that itemises its own costs has already answered the
    // property-cost question, so it isn't asked again.
    const docHadPropertyExpenses = fields.some((f) => f.key === "propertyExpenses");

    for (const field of plainFields) {
      if (field.confidence < CONFIDENCE_LOW) {
        // Too unclear to commit unasked — the one remaining thing that holds
        // a figure back on its own.
        setPendingFollowUp({
          itemKey: field.key,
          value: field.value,
          source,
          docId,
          docHadPropertyExpenses,
        });
        setTimeout(
          () =>
            addMsg({
              from: "assist",
              text: `This reads as ${field.value} for ${itemName(field.key).toLowerCase()} — does that look right?`,
              chips: [
                { label: "Yes, that's right", reply: "Thanks, noted." },
                {
                  label: "Correct the figure",
                  reply: "Sure — set it to what the document says.",
                  action: "manual",
                },
                {
                  label: "I'll upload proof",
                  reply: `No problem — I'll leave ${itemName(field.key).toLowerCase()} out for now. Drop a clearer document in on the left and I'll read it again.`,
                  action: "document",
                },
              ],
            }),
          350
        );
      } else {
        applyResolvedField(field.key, field.value, field.confidence, source, docId);
        maybeAskPropertyExpenses(field.key, docHadPropertyExpenses);
      }
    }

    if (overlapFields.length > 0) {
      await resolveOverlaps(overlapFields, result, source, docId);
    }
  }



  /** One document at a time. The picker can only offer one now that
   *  `multiple` is gone, but a drag-and-drop can still carry several — those
   *  take the first and say so plainly. Keeping it to one also means a
   *  document's questions get answered before the next arrives, rather than
   *  a batch burying them further up the log. */
  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    if (files.length > 1) {
      addMsg({
        from: "assist",
        text: "One document at a time for now — add the next once this one's processed.",
      });
    }

    await handleFileUpload(files[0]);
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

    // Figures left out because they duplicated *this* document may be needed
    // now that it's gone. Deliberately not re-evaluated — that's a later
    // piece of work — but a total that's quietly short with nothing
    // explaining it would be worse than saying so.
    const orphaned = suppressions.filter((s) => s.becauseOfDocIds.includes(id) && s.docId !== id);
    setSuppressions((prev) => prev.filter((s) => s.docId !== id && !s.becauseOfDocIds.includes(id)));

    if (orphaned.length > 0) {
      const listed = humanList(
        orphaned.map((s) => `${s.value} for ${itemName(s.itemKey).toLowerCase()} from ${s.docLabel}`)
      );
      setTimeout(
        () =>
          addMsg({
            from: "assist",
            text:
              `One thing worth checking: I'd left ${listed} out because ${doc.label} already covered it. ` +
              `Now that it's gone, that may need to go back in — you can add it by hand on the row.`,
          }),
        350
      );
    }
  }

  /** `seed` pre-fills the field. The confidence gate passes the figure it
   *  questioned, so correcting a reading starts from that number rather than
   *  an empty box — there is nothing else on screen to copy it from. */
  function startEditManual(key: string, seed?: string) {
    setEditingManualKey(key);
    if (seed !== undefined) {
      setManualDraft(seed);
      return;
    }
    setManualDraft(items[key].manualEntry ? String(items[key].manualEntry!.value) : "");
  }
  /** The one place a person-supplied figure becomes a ManualEntry. Typing it
   *  into the row and confirming it from chat both land here, so there is one
   *  kind of manual entry rather than two — it reads "Added by you" either
   *  way, because either way it is. */
  function commitManualValue(key: string, raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return false;
    const amount = parseFloat(trimmed.replace(/[£,]/g, ""));
    if (isNaN(amount)) return false;
    // A chat proposal can name a category whose row isn't on screen yet;
    // typing can't, but revealing is harmless when it's already visible.
    revealCategory(key as ItemKey);
    setItems((prev) => ({
      ...prev,
      [key]: { ...prev[key], manualEntry: { value: amount, formatted: formatMoney(amount) } },
    }));
    return true;
  }

  function saveManualValue(key: string) {
    const raw = manualDraft;
    setEditingManualKey(null);
    commitManualValue(key, raw);
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

  function reactivate(key: string) {
    setItems((prev) => ({ ...prev, [key]: { ...prev[key], dismissed: false } }));
    addMsg({ from: "user", text: `Actually, add ${items[key].name.toLowerCase()} back` });
    setTimeout(
      () => addMsg({ from: "assist", text: `No problem — ${items[key].name.toLowerCase()} is back on your list.` }),
      300
    );
  }

  /** Answers the "does that look right?" gate — the only chip question left
   *  that holds a single figure. */
  function answerChip(msgId: number, chip: ChipOption) {
    if (!pendingFollowUp) return;
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, chipsDisabled: true } : m)));
    addMsg({ from: "user", text: chip.label });
    setTimeout(() => addMsg({ from: "assist", text: chip.reply }), 300);

    const followUp = pendingFollowUp;
    setPendingFollowUp(null);

    if (chip.action === "manual") {
      startEditManual(followUp.itemKey, String(parseMoney(followUp.value)));
      return;
    }

    if (chip.action === "document") {
      // Nothing commits. A second document can't confirm this figure by
      // itself — it produces its own, which the overlap check then weighs
      // against whatever is already counted — so the honest behaviour is to
      // leave this one out and read the next document properly. The pending
      // slot is already cleared above, so the next upload's gate is free.
      setDropzoneHint(true);
      setTimeout(() => setDropzoneHint(false), 2400);
      return;
    }

    // Confirmed by the person, so the figure is no longer a shaky reading.
    applyResolvedField(followUp.itemKey, followUp.value, 1, followUp.source, followUp.docId);
    maybeAskPropertyExpenses(followUp.itemKey, followUp.docHadPropertyExpenses);
  }

  /** Asks about property costs once a property income figure has actually
   *  landed — but not when the document already itemised those costs, which
   *  a letting agent's statement typically does. */
  function maybeAskPropertyExpenses(key: ItemKey, docHadPropertyExpenses: boolean) {
    if (key !== "property" || docHadPropertyExpenses) return;
    setTimeout(() => addExpenseQuestion(), 700);
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
      // The row already exists; narrow its hint to the costs they picked, so
      // it reads back what they told us rather than the generic examples.
      setItems((prev) => ({
        ...prev,
        propertyExpenses: { ...prev.propertyExpenses, hint: selected.join(" · ") },
      }));
      setRevealedKeys((prev) => (prev.includes("propertyExpenses") ? prev : [...prev, "propertyExpenses"]));

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

  /** What the model sees of the Tax picture: every line it should know
   *  about, whether or not it has a figure, so it can answer "what's left?"
   *  as well as "what's in?". */
  function positionLines() {
    return positionKeys.map((key) => {
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
      const data: { reply?: string; proposals?: ManualProposal[] } = await res.json();
      if (!data.reply?.trim()) throw new Error("Empty reply");
      addMsg({ from: "assist", text: data.reply, conversational: true });

      // Offers only. Each one is asked about; none commits on its own.
      for (const proposal of data.proposals ?? []) {
        if (!ITEM_META[proposal.itemKey]) continue;
        const msgId = addMsg({
          from: "assist",
          isProposalQuestion: true,
          text:
            `Sounds like ${proposal.value} for ${itemName(proposal.itemKey).toLowerCase()}` +
            `${proposal.source ? ` — ${proposal.source}` : ""}. Add that?`,
          chips: [
            { label: "Yes, add it", reply: "", proposalAnswer: "add" },
            { label: "Let me adjust", reply: "", proposalAnswer: "adjust" },
          ],
        });
        setPendingProposals((prev) => ({ ...prev, [msgId]: proposal }));
      }
    } catch {
      addMsg({
        from: "assist",
        text: "Something went wrong answering that — give it another go in a moment.",
      });
    } finally {
      setChatLoading(false);
    }
  }

  function freezePicture() {
    if (confirmedCount === 0) return;
    setFrozen(true);
    setEditingManualKey(null);
  }

  function renderDocEntryLine(entry: DocEntry, idx: number) {
    // Tagged per entry, not just per row: someone with a solid figure and a
    // shaky one needs to know which to go and check.
    const low = entry.confidence < CONFIDENCE_HIGH;
    return (
      <div className={`pic-entry doc ${low ? "low-confidence" : ""}`} key={idx}>
        <span className="pic-entry-icon" style={{ display: "flex" }}>
          {low ? <LowConfidenceIcon size={12} /> : <DocIcon size={12} />}
        </span>
        <span className="t-caption pic-entry-amount">{entry.formatted}</span>
        <span className="t-caption pic-entry-label">{entry.source}</span>
        {low && <span className="t-caption pic-conf-tag">Low confidence</span>}
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

  /** The frozen row: category, total, and the two real signals. No hint, no
   *  status glyph (everything shown is resolved by definition), no breakdown
   *  lines, and nothing clickable. */
  function renderFrozenRow(key: string) {
    const it = items[key];
    const lowConfidence = hasLowConfidenceEntry(it);
    return (
      <div className="pic-row frozen" key={key}>
        <div className="pic-info">
          <div className="t-body pic-name">{it.name}</div>
        </div>
        <div className="pic-spacer" />
        <div className="pic-action">
          <div className="pic-val-wrap">
            <div className="t-h5 pic-val">{itemTotal(it)}</div>
            {lowConfidence && <span className="t-caption pic-conf-tag">Low confidence</span>}
          </div>
        </div>
      </div>
    );
  }

  function renderRow(key: string) {
    const it = items[key];
    const status = itemStatus(it);
    const lowConfidence = status === "confirmed" && hasLowConfidenceEntry(it);

    let action: React.ReactNode;
    if (status === "dismissed") {
      action = (
        <button className="tf-iconbtn tf-iconbtn--small pic-toggle" title="Add this back" onClick={() => reactivate(key)}>
          <PlusIcon />
        </button>
      );
    } else {
      action = (
        <>
          {status === "confirmed" ? (
            <div className="pic-val-wrap">
              <div className="t-h5 pic-val">{itemTotal(it)}</div>
              {lowConfidence && <span className="t-caption pic-conf-tag">Low confidence</span>}
              {/* A populated row's slot is taken by its figure, so the action
                  goes underneath it rather than over it. Rendered always and
                  faded, so appearing on hover doesn't reflow the list. */}
              <button
                className="t-bodySmall pic-add-manual"
                onClick={(e) => {
                  e.stopPropagation();
                  startEditManual(key);
                }}
              >
                <PlusIcon />
                <span>Add value manually</span>
              </button>
            </div>
          ) : (
            /* "Pending" and the promoted action share one slot: the action sits
               over the label rather than beside it, so revealing it doesn't
               shift the row, and it stays keyboard-reachable because it is
               faded rather than removed. */
            <div className="pic-pending-slot">
              <div className="t-body pic-pending-label">Pending</div>
              <button
                className="t-bodySmall pic-add-manual pic-add-manual--overlay"
                onClick={(e) => {
                  e.stopPropagation();
                  startEditManual(key);
                }}
              >
                <PlusIcon />
                <span>Add value manually</span>
              </button>
            </div>
          )}
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
      <div className={`pic-row ${status} ${lowConfidence ? "low-confidence" : ""}`} key={key}>
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
            <h1 className="t-h3">Upload your documents to see your tax picture</h1>
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
                  <span className="t-body doc-row-name" title={d.label}>
                    {d.label}
                  </span>
                  <span className="t-bodySmall doc-row-org" title={d.org}>
                    {d.org}
                  </span>
                  {/* A property of the document, so stated once here rather
                      than repeated on every figure it produced. */}
                  {!d.issuedRecord && (
                    <span className="t-caption pic-origin-tag">Unconfirmed document</span>
                  )}
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
                accept={ACCEPT_ATTRIBUTE}
                hidden
                onChange={(e) => {
                  handleFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              {dropzoneLoading ? (
                <div className="dz-loading">
                  <div className="tf-spinner" />
                  <span>Reading document…</span>
                </div>
              ) : (
                <div className="dz-idle">
                  <div className="t-bodySmall dz-title">Drag a document here, or click to add one</div>
                  <div className="t-bodySmall dz-sub">PDF, JPG or PNG — one at a time, in any order</div>
                </div>
              )}
            </div>
          </div>

          <div className={`tf-card picture-card ${frozen ? "is-frozen" : ""}`}>
            <div className="picture-head">
              <div className="picture-title">
                <h2 className="t-h5">{frozen ? "Your tax picture" : "Your tax picture so far"}</h2>
                <span className="t-caption early-tag">Early access</span>
              </div>
              <p className="t-bodySmall">
                Every figure below comes from a document or a question you answered. This is an
                overview, not a final tax calculation.
              </p>
              {/* Global and unconditional — not a per-row signal, and
                  deliberately worded so it can't be read as one. */}
              <p className="t-bodySmall pic-review-note">
                None of this has been checked by an accountant yet — that happens once you finish.
              </p>
            </div>
            <div className="pic-groups">
              {GROUPS.map((group) => {
                // Frozen shows everything resolved, folded away or not, since
                // there is no "Show more" to open. A group with nothing
                // resolved in it isn't rendered at all.
                const rows = frozen
                  ? [...group.primary, ...group.secondary].filter(
                      (k) => itemStatus(items[k]) !== "pending"
                    )
                  : [...group.primary, ...(group.expanded ? group.secondary : [])];
                if (!rows.length) return null;
                return (
                  <div className="pic-group" key={group.label}>
                    <div className="t-overline pic-group-label">{group.label}</div>
                    <div className="pic-rows">
                      {rows.map((key) => (frozen ? renderFrozenRow(key) : renderRow(key)))}
                    </div>
                    {!frozen && group.secondary.length > 0 && (
                      <button className="t-caption pic-more-toggle" onClick={group.toggle}>
                        {group.expanded ? "Show less" : "Show more"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {frozen ? (
              <div className="frozen-foot">
                <button className="t-bodySmall frozen-edit" onClick={() => setFrozen(false)}>
                  Edit your tax picture
                </button>
                <p className="t-bodySmall frozen-note">
                  This is an overview built from what you&rsquo;ve shared — not a final number. Book
                  a free call with our team if you&rsquo;d like to talk through your options, no
                  obligation.
                </p>
                <div className="frozen-actions">
                  <a
                    className="tf-btn tf-btn--primary tf-btn--large t-button"
                    href={BOOK_CALL_URL || undefined}
                    target={BOOK_CALL_URL ? "_blank" : undefined}
                    rel={BOOK_CALL_URL ? "noreferrer" : undefined}
                  >
                    Book a free call
                  </a>
                  <a
                    className="tf-btn tf-btn--tertiary-outlined tf-btn--large t-button"
                    href={PRICING_URL || undefined}
                    target={PRICING_URL ? "_blank" : undefined}
                    rel={PRICING_URL ? "noreferrer" : undefined}
                  >
                    Explore pricing
                  </a>
                </div>
              </div>
            ) : (
              <div className="picture-footer">
                <div className="pf-left">
                  <span className="t-bodySmall pf-note">
                    {resolvedCount} of {visibleKeys.length} sorted
                  </span>
                  {pendingCount > 0 && confirmedCount > 0 && (
                    <span className="t-caption pf-hint">
                      Anything left blank won&rsquo;t show once you finish
                    </span>
                  )}
                </div>
                <button
                  className="tf-btn tf-btn--primary tf-btn--large t-button"
                  onClick={freezePicture}
                  disabled={confirmedCount === 0}
                  title={confirmedCount === 0 ? "Add a figure first — there's nothing to show yet" : undefined}
                >
                  Complete
                </button>
              </div>
            )}
          </div>
        </main>

        <aside className="tf-card tf-card--outlined convo-card">
          <div className="t-overline convo-title">Conversation</div>
          <div className="convo-log" ref={logRef}>
            {messages.map((m) => (
              <div className={`msg ${m.from}`} key={m.id}>
                {m.attach && (
                  <>
                    <div className="t-caption msg-attach" title={m.attach}>
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
                      <button
                        key={i}
                        className="tf-chip tf-chip--medium t-caption"
                        disabled={m.chipsDisabled}
                        onClick={() => {
                          if (m.isProposalQuestion) return answerProposal(m.id, c);
                          if (m.isOriginQuestion) return void answerOrigin(m.id, c);
                          if (m.isOverlapQuestion) return answerOverlap(m.id, c);
                          answerChip(m.id, c);
                        }}
                      >
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
            Anything it added to your tax picture will be removed too. This is the only way to take out a
            figure that came from a document, so nothing gets out of sync with what you uploaded.
          </p>
        </Dialog>
      )}
    </div>
  );
}
