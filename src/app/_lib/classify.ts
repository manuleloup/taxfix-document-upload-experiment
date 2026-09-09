// Shared between the /api/classify route (server) and the upload page
// (client) — single source of truth for the item-key enum, confidence
// handling, and the fixed follow-up question table.

export type ItemKey =
  | "employment"
  | "property"
  | "savings"
  | "selfEmployment"
  | "dividends"
  | "otherIncome"
  | "capitalGains"
  | "foreignIncome"
  | "incomeTaxDeducted"
  | "pension"
  | "charity"
  | "studentLoan"
  | "benefits"
  | "propertyExpenses"
  | "selfEmploymentExpenses"
  | "benefitsInKind"
  | "limitedCompanyDirector";

/** Which block of the Tax picture a category belongs to.
 *
 *  "triggered" is not a place on the page so much as a rule: those rows are
 *  not rendered at all until a document or an answer puts something in them.
 *  It replaces the old hand-kept EXPENSE_KEYS list — lazy reveal was never
 *  really about expenses, it was about categories most people don't have. */
export type ItemGroup = "income" | "taxPaid" | "deductions" | "triggered";

// Single source of truth for item name/hint/group — used to build the upload
// page's INITIAL_ITEMS and its group lists, and, via ITEM_KEY_LIST in
// prompts.ts, to tell the model what each key means.
//
// Every key belongs here, including the triggered ones. They were once left
// out because their rows are only *shown* once something needs them, but that
// also kept them out of the prompt's category list — so a document carrying a
// cost had no valid destination and the model put it under income instead
// (seen with a mortgage interest statement and a letting agent's deducted
// fee). Lazy display is a display concern; it is never a reason to hide a
// category from the model.
export const ITEM_META: Record<ItemKey, { name: string; hint: string; group: ItemGroup }> = {
  employment: { name: "Employment income", hint: "Salary, wages — from your P60 or payslips", group: "income" },
  property: { name: "Property income", hint: "Rent from letting a property", group: "income" },
  savings: { name: "Savings interest", hint: "Interest from banks and building societies", group: "income" },
  selfEmployment: { name: "Self-employment income", hint: "Freelance, contracting or gig work", group: "income" },
  dividends: { name: "Dividend income", hint: "Shares and funds", group: "income" },
  otherIncome: {
    name: "Other income",
    hint: "Casual income, tips, commissions, anything else",
    group: "income",
  },
  capitalGains: { name: "Capital gains", hint: "Sold shares, crypto, property or other assets", group: "income" },
  foreignIncome: { name: "Foreign income", hint: "Income or gains from outside the UK", group: "income" },
  incomeTaxDeducted: {
    name: "Income tax already deducted",
    hint: "PAYE tax withheld — from your P60, P45 or payslips",
    group: "taxPaid",
  },
  pension: {
    name: "Pension contributions",
    hint: "Payments into a pension, via employer or yourself",
    group: "deductions",
  },
  charity: { name: "Charity donations", hint: "Gift Aid donations to charity", group: "deductions" },
  studentLoan: {
    name: "Student loan repayments",
    hint: "Repayments deducted via PAYE or made directly",
    group: "deductions",
  },
  benefits: {
    name: "Benefits received",
    hint: "Child Benefit, State Pension, JSA and similar",
    group: "deductions",
  },
  propertyExpenses: {
    name: "Property expenses",
    hint: "Costs of letting — mortgage interest, repairs, agent fees",
    group: "triggered",
  },
  selfEmploymentExpenses: {
    name: "Self-employment expenses",
    hint: "Costs of your freelance, contracting or gig work",
    group: "triggered",
  },
  benefitsInKind: {
    name: "Benefits in kind (P11D)",
    hint: "Company car, private medical insurance and similar employer-provided benefits",
    group: "triggered",
  },
  limitedCompanyDirector: {
    name: "Limited company director",
    hint: "Director's loan account, or dividends from your own company",
    group: "triggered",
  },
};

/** Every category key, in ITEM_META order. Exported so the chat tool's
 *  schema can constrain itself to exactly these — the model can't name a
 *  category that doesn't exist. */
export const ITEM_KEYS = Object.keys(ITEM_META) as ItemKey[];
const KEYS = ITEM_KEYS;

export function keysInGroup(group: ItemGroup): ItemKey[] {
  return KEYS.filter((k) => ITEM_META[k].group === group);
}

/** Categories whose rows appear only once a document or an answer puts
 *  something in them. Derived from the group rather than hand-listed, so a
 *  new triggered category needs no second edit here. */
export const TRIGGERED_KEYS: ItemKey[] = keysInGroup("triggered");

export function isTriggeredKey(key: ItemKey): boolean {
  return ITEM_META[key].group === "triggered";
}

export type ConfidenceTier = "high" | "medium" | "low";
export const CONFIDENCE_HIGH = 0.85;
export const CONFIDENCE_LOW = 0.5;

export function confidenceTier(c: number): ConfidenceTier {
  if (c >= CONFIDENCE_HIGH) return "high";
  if (c >= CONFIDENCE_LOW) return "medium";
  return "low";
}

export interface ResolvedField {
  key: ItemKey;
  /** Formatted "£1,234.56" — matches the parseMoney/formatMoney format already in use. */
  value: string;
  /** 0..1 */
  confidence: number;
  /** Short: "gross pay", "student loan repayments via employer" */
  label: string;
}

export interface ClassifyResult {
  documentLabel: string;
  org: string;
  taxYear: string | null;
  /** Model-authored 1-sentence chat summary. */
  description: string;
  /** 0..n — 0 for evidence-only docs (e.g. an unclear bank statement). */
  resolvedFields: ResolvedField[];
  /** Whether the file shows the marks of a record issued by a named
   *  organisation. The model only reports this; /api/classify decides what
   *  to do about it, so the policy can be relaxed for testing without
   *  re-tuning a prompt. */
  issuedRecord: boolean;
  /** true = couldn't classify this file at all. */
  unresolved: boolean;
}

/** A figure the person stated in conversation, which the chat has offered to
 *  add. Nothing commits from this alone: it is put to them for confirmation,
 *  and confirming runs the same manual-entry path as typing it in by hand. */
export interface ManualProposal {
  itemKey: ItemKey;
  /** As the model read it back, "£400.00" style. */
  value: string;
  /** A short quote or paraphrase of what they said, e.g. "renting my spare
   *  room" — shown so the offer is traceable to their own words. */
  source: string;
}

// ── Overlap between documents ─────────────────────────────────────────────
// The same money can legitimately appear on more than one document from the
// same employer and tax year: a P60 is cumulative for the year, a P45 runs to
// the leaving date, and a year-end payslip carries year-to-date figures. Add
// both and the income is counted twice.
//
// Deliberately limited to the three categories where this actually happens.
// Everything else commits exactly as before, and this says nothing about the
// same document scanned twice to different bytes — that's the content-hash
// check in the upload page.
// incomeTaxDeducted belongs here for the same reason as employment: PAYE tax
// on a P60 is cumulative for the year, and the same tax appears again on a
// payslip's year-to-date column and on a P45. Leaving it out would let a
// taxpayer claim the same tax as paid twice.
export const OVERLAP_KEYS: ItemKey[] = [
  "employment",
  "incomeTaxDeducted",
  "pension",
  "studentLoan",
];

export function isOverlapKey(key: ItemKey): boolean {
  return OVERLAP_KEYS.includes(key);
}

/** A figure from the newly-read document that needs judging. */
export interface OverlapCandidate {
  key: ItemKey;
  value: string;
  label: string;
}

/** One already-committed figure the new document might be duplicating. */
export interface OverlapExisting {
  key: ItemKey;
  formatted: string;
  docLabel: string;
  org: string;
  taxYear: string | null;
  description: string;
}

export interface OverlapRequestBody {
  newDoc: { label: string; org: string; taxYear: string | null; description: string };
  candidates: OverlapCandidate[];
  existing: OverlapExisting[];
}

/** The model's judgement about one candidate. `confidence` is how sure it is
 *  of *this judgement* — not how clearly a figure was read off the page. */
export interface OverlapVerdict {
  key: ItemKey;
  /** true = this figure is money already counted elsewhere. */
  overlaps: boolean;
  /** 0..1 */
  confidence: number;
  /** Which of the two records is the fuller account of this figure. Only
   *  consulted when `overlaps` is true: it decides which one survives, so
   *  that a P60 arriving after a P45 supersedes it instead of being thrown
   *  away for arriving second. */
  preferred: "existing" | "new";
  /** One short sentence, shown to the person. */
  reason: string;
}

/** Used when the check fails or its reply can't be parsed. Zero confidence,
 *  so every candidate routes to the confirm chip — nothing is silently added
 *  and nothing is silently dropped. */
export function unresolvedVerdicts(candidates: OverlapCandidate[]): OverlapVerdict[] {
  return candidates.map((c) => ({
    key: c.key,
    overlaps: false,
    confidence: 0,
    // Keeping what is already counted is the conservative default: it
    // changes nothing the person hasn't already seen.
    preferred: "existing",
    reason: "I couldn't check this against your other documents.",
  }));
}

export const UNRESOLVED_RESULT: ClassifyResult = {
  documentLabel: "",
  org: "",
  taxYear: null,
  description: "Couldn't read that document clearly — try a clearer scan or photo.",
  resolvedFields: [],
  // Unreadable, which is a different thing from not being an issued record —
  // don't tell someone their document looks fake because a parse failed.
  issuedRecord: true,
  unresolved: true,
};
