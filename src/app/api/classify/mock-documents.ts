import type { ClassifyResult } from "@/app/_lib/classify";

// Canned classifier responses for CLASSIFY_MOCK=1. Each upload returns the
// next one, cycling. Between them they exercise every state the real
// endpoint can produce, so the flow can be reviewed without an API key:
//
//   1. P60           — multi-field, all high confidence
//   2. Letting stmt  — a trigger, so the value waits on a follow-up question
//                      (answering it also kicks off the property-expense chain)
//   3. Interest cert — single field, high confidence
//   4. Payslip       — one low-confidence field, so the "does that look
//                      right?" confirm gate fires instead of auto-committing
//   5. Receipt photo — medium confidence, commits but flags "worth a check"
//   6. Blurry photo  — unresolved: nothing added, graceful message only
export const MOCK_DOCUMENTS: ClassifyResult[] = [
  {
    documentLabel: "P60 2024–25",
    org: "Vantage Retail Ltd",
    taxYear: "2024-25",
    description:
      "Read your P60: gross pay of £52,000.00 for the tax year, with £9,200.00 tax already deducted. It also shows pension contributions of £1,200.00 and student loan repayments of £1,050.00 through your employer — I've logged both.",
    resolvedFields: [
      { key: "employment", value: "£52,000.00", confidence: 0.97, label: "gross pay" },
      { key: "pension", value: "£1,200.00", confidence: 0.93, label: "pension contributions" },
      { key: "studentLoan", value: "£1,050.00", confidence: 0.91, label: "student loan repayments" },
    ],
    trigger: "none",
    followUpItemKey: null,
    unresolved: false,
  },
  {
    documentLabel: "Letting statement",
    org: "14 Ashby Road",
    taxYear: "2024-25",
    description: "Read your letting statement for 14 Ashby Road: rental income of £9,600.00 for the year.",
    resolvedFields: [{ key: "property", value: "£9,600.00", confidence: 0.95, label: "rental income" }],
    trigger: "joint_ownership",
    followUpItemKey: "property",
    unresolved: false,
  },
  {
    documentLabel: "Interest certificate",
    org: "Northbrook Bank",
    taxYear: "2024-25",
    description: "Read your interest certificate from Northbrook Bank: savings interest of £740.00 for the year.",
    resolvedFields: [{ key: "savings", value: "£740.00", confidence: 0.96, label: "savings interest" }],
    trigger: "none",
    followUpItemKey: null,
    unresolved: false,
  },
  {
    documentLabel: "Payslip — March",
    org: "Vantage Retail Ltd",
    taxYear: "2024-25",
    description:
      "This looks like a single month's payslip rather than a year-end summary, and the year-to-date figure is partly cut off — I've read it as £4,180.00 but it's worth a check.",
    resolvedFields: [{ key: "employment", value: "£4,180.00", confidence: 0.34, label: "year-to-date pay" }],
    trigger: "none",
    followUpItemKey: null,
    unresolved: false,
  },
  {
    documentLabel: "Charity receipt",
    org: "Shelter",
    taxYear: "2024-25",
    description:
      "Read a Gift Aid receipt from Shelter for £240.00. The date is faint, so I've assumed it falls in this tax year.",
    resolvedFields: [{ key: "charity", value: "£240.00", confidence: 0.71, label: "Gift Aid donation" }],
    trigger: "none",
    followUpItemKey: null,
    unresolved: false,
  },
  {
    documentLabel: "",
    org: "",
    taxYear: null,
    description: "That photo is too blurry to read — try a flatter, better-lit shot or the original PDF.",
    resolvedFields: [],
    trigger: "none",
    followUpItemKey: null,
    unresolved: true,
  },
];
