// Shared between the /api/classify route (server) and the upload page
// (client) — single source of truth for the item-key enum, confidence
// handling, and the fixed follow-up question table.

export type ItemKey =
  | "employment"
  | "property"
  | "savings"
  | "selfEmployment"
  | "dividends"
  | "capitalGains"
  | "foreignIncome"
  | "pension"
  | "charity"
  | "studentLoan"
  | "benefits"
  | "propertyExpenses";

// Single source of truth for item name/hint — used both to build the
// upload page's INITIAL_ITEMS and to tell the model what each key means.
// propertyExpenses is intentionally excluded: it's created lazily once the
// expense-question flow (or a resolved field targeting it) actually needs it.
export const ITEM_META: Record<Exclude<ItemKey, "propertyExpenses">, { name: string; hint: string }> = {
  employment: { name: "Employment income", hint: "Salary, wages — from your P60 or payslips" },
  property: { name: "Property income", hint: "Rent from letting a property" },
  savings: { name: "Savings interest", hint: "Interest from banks and building societies" },
  selfEmployment: { name: "Self-employment income", hint: "Freelance, contracting or gig work" },
  dividends: { name: "Dividend income", hint: "Shares and funds" },
  capitalGains: { name: "Capital gains", hint: "Sold shares, crypto, property or other assets" },
  foreignIncome: { name: "Foreign income", hint: "Income or gains from outside the UK" },
  pension: { name: "Pension contributions", hint: "Payments into a pension, via employer or yourself" },
  charity: { name: "Charity donations", hint: "Gift Aid donations to charity" },
  studentLoan: { name: "Student loan repayments", hint: "Repayments deducted via PAYE or made directly" },
  benefits: { name: "Benefits received", hint: "Child Benefit, State Pension, JSA and similar" },
};

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

export type TriggerCode =
  | "none"
  | "joint_ownership"
  | "self_employment_subtype"
  | "bank_statement_purpose"
  | "cis_arrears"
  | "capital_gains_asset_type";

export interface FollowUpQuestion {
  kind: "confirm" | "choice";
  itemKey: ItemKey;
  text: string;
  options: { label: string; reply: string }[];
}

// Fixed, hand-authored copy — the model only ever picks a TriggerCode, never
// writes user-facing question/option text itself. Keeps chip copy reviewed
// and away from anything advice-adjacent.
export const FOLLOW_UP_TABLE: Record<
  Exclude<TriggerCode, "none">,
  Omit<FollowUpQuestion, "itemKey">
> = {
  joint_ownership: {
    kind: "confirm",
    text: "Do you own this property jointly with someone else?",
    options: [
      { label: "No, just me", reply: "Got it — I'll count all of it as yours." },
      { label: "Yes, jointly", reply: "Noted. I'll flag this for your accountant to confirm the split." },
    ],
  },
  // Typed stubs — no demo document reaches these yet, but the mechanism
  // must not be hardcoded to a single trigger.
  self_employment_subtype: {
    kind: "choice",
    text: "What kind of self-employed work is this?",
    options: [
      { label: "Freelancer", reply: "Got it — freelance work noted." },
      { label: "CIS contractor", reply: "Got it — I'll flag this as CIS work." },
      { label: "Courier or driver", reply: "Got it — courier/platform work noted." },
      { label: "Other", reply: "Got it — noted as self-employment." },
    ],
  },
  bank_statement_purpose: {
    kind: "choice",
    text: "What does this statement cover?",
    options: [{ label: "Not sure yet", reply: "No problem — I'll flag it for your accountant to check." }],
  },
  cis_arrears: {
    kind: "confirm",
    text: "Are you behind on any tax returns or payments?",
    options: [
      { label: "No", reply: "Good to know." },
      { label: "Yes", reply: "Thanks for flagging that — your accountant will follow up." },
    ],
  },
  capital_gains_asset_type: {
    kind: "choice",
    text: "What did you sell?",
    options: [{ label: "Not sure yet", reply: "No problem — I'll flag it for your accountant to check." }],
  },
};

export interface ClassifyResult {
  documentLabel: string;
  org: string;
  taxYear: string | null;
  /** Model-authored 1-sentence chat summary. */
  description: string;
  /** 0..n — 0 for evidence-only docs (e.g. an unclear bank statement). */
  resolvedFields: ResolvedField[];
  trigger: TriggerCode;
  followUpItemKey: ItemKey | null;
  /** true = couldn't classify this file at all. */
  unresolved: boolean;
}

export const UNRESOLVED_RESULT: ClassifyResult = {
  documentLabel: "",
  org: "",
  taxYear: null,
  description: "Couldn't read that document clearly — try a clearer scan or photo.",
  resolvedFields: [],
  trigger: "none",
  followUpItemKey: null,
  unresolved: true,
};
