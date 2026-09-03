// Icon set.
//
// The ones marked "real" are the design's own exports from public/icons/,
// inlined here and standardised: `fill="currentColor"` with the exported
// fill-opacity stripped, so colour comes from the surrounding token (row
// state drives it — brand green when resolved, muted when pending, disabled
// when removed). Each keeps its own exported viewBox; `size` scales it.
//
// The ones marked "approximated" have no export yet and are still
// hand-drawn — see the note at the bottom for what's outstanding.

type IconProps = { size?: number };

/* ── real: circle-check.svg ─────────────────────────────────────────────── */
export function CircleCheckIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 3.5C6.40625 3.5 3.5 6.40625 3.5 10C3.5 13.5938 6.40625 16.5 10 16.5C13.5938 16.5 16.5 13.5938 16.5 10C16.5 6.40625 13.5938 3.5 10 3.5ZM10 18C5.59375 18 2 14.4062 2 10C2 5.59375 5.59375 2 10 2C14.4062 2 18 5.59375 18 10C18 14.4062 14.4062 18 10 18ZM13.0312 8L12.625 8.65625L10.125 12.6562L9.90625 13H9.125L8.90625 12.7188C7.71875 11.125 7.0625 10.2812 6.9375 10.0938L8.15625 9.21875C8.375 9.53125 8.8125 10.0938 9.4375 10.9375C10.9688 8.46875 11.75 7.25 11.75 7.21875L13.0312 8Z"
        fill="currentColor"
      />
    </svg>
  );
}

/* ── real: circle-question.svg ──────────────────────────────────────────── */
export function CircleQuestionIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M18.125 10C18.125 5.50781 14.4922 1.875 10 1.875C5.50781 1.875 1.875 5.50781 1.875 10C1.875 14.4922 5.50781 18.125 10 18.125C14.4922 18.125 18.125 14.4922 18.125 10ZM0 10C0 4.49219 4.49219 0 10 0C15.5078 0 20 4.49219 20 10C20 15.5078 15.5078 20 10 20C4.49219 20 0 15.5078 0 10ZM10 6.875C9.29688 6.875 8.75 7.42188 8.75 8.125H6.875C6.875 6.40625 8.28125 5 10 5C11.7188 5 13.125 6.40625 13.125 8.125C13.125 9.49219 12.3438 10.3906 11.6406 10.8594C11.4062 11.0156 11.1328 11.1719 10.9375 11.25V12.1094H9.0625V9.92188C9.10156 9.88281 9.17969 9.88281 9.21875 9.88281C9.6875 9.72656 10.1172 9.60938 10.5469 9.33594C10.9766 9.0625 11.25 8.67188 11.25 8.125C11.25 7.42188 10.7031 6.875 10 6.875ZM9.0625 13.4375H10.9375V15.3125H9.0625V13.4375Z"
        fill="currentColor"
      />
    </svg>
  );
}

/* ── real: file-lines-document.svg ──────────────────────────────────────── */
export function DocIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M5.5 3.5V16.5H14.5V8.5H9.5V3.5H5.5ZM11 4.125V7H13.875L11 4.125ZM11 2L16 7V18H4V2H11ZM7.75 10H13V11.5H7V10H7.75ZM7.75 13H13V14.5H7V13H7.75Z"
        fill="currentColor"
      />
    </svg>
  );
}

/* ── real: pen-to-square.svg ────────────────────────────────────────────── */
export function PencilIcon({ size = 12 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M4.71094 6.67969L4.57422 7.67578L5.57031 7.53906L8.30469 4.80469C8.01172 4.51172 7.73828 4.23828 7.44531 3.94531L4.71094 6.67969ZM8.53906 3.71094L8.96875 4.14062L9.82812 3.28125L8.96875 2.42188L8.10938 3.28125L8.53906 3.71094ZM11.1562 3.28125L10.4922 3.94531L6 8.4375C4.88672 8.57422 4.04688 8.69141 3.5 8.75C3.57812 8.20312 3.67578 7.38281 3.8125 6.25L8.30469 1.75781L8.96875 1.09375C9.16406 1.28906 10.1992 2.32422 11.1562 3.28125ZM1.46875 2.5H5.375V3.4375H1.9375V10.3125H8.8125V6.875H9.75V11.25H1V2.5H1.46875Z"
        fill="currentColor"
      />
    </svg>
  );
}

/* ── real: trash-outline.svg ────────────────────────────────────────────── */
export function TrashIcon({ size = 12 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M7.5625 0.9375L8.03125 2.1875H10.375V3.125H1.625V2.1875H3.96875L4.4375 0.9375H7.5625ZM2.25 4.0625H3.1875V10.3125H8.8125V4.0625H9.75V11.25H2.25V4.0625ZM5.375 5.46875V9.375H4.4375V5H5.375V5.46875ZM7.5625 5.46875V9.375H6.625V5H7.5625V5.46875Z"
        fill="currentColor"
      />
    </svg>
  );
}

/* ── real: plus.svg ─────────────────────────────────────────────────────── */
export function PlusIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7.75 0.75V6.25H14V7.75H7.75V14H6.25V7.75H0V6.25H6.25V0H7.75V0.75Z" fill="currentColor" />
    </svg>
  );
}

/* ── real: chevron-down.svg ─────────────────────────────────────────────── */
export function ChevronDownIcon({ size = 13 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 12" fill="none" aria-hidden="true">
      <path
        d="M6.37109 10.3984H6.39844L5.93359 9.93359L0.464844 4.46484L0 4L0.929688 3.07031L1.39453 3.53516L6.39844 8.53906L11.4023 3.53516L11.8672 3.07031L12.7695 4L12.3047 4.46484L6.83594 9.93359L6.37109 10.3984Z"
        fill="currentColor"
      />
    </svg>
  );
}

/* ── approximated: no export yet (see note below) ───────────────────────── */

export function CheckIcon({ size = 13 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function XIcon({ size = 11 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function OverflowIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

export function SendIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

export function LowConfidenceIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 9v4" />
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" />
    </svg>
  );
}

// Row status glyph: unresolved rows get circle-question, resolved and removed
// rows both get circle-check — colour carries the difference.
export function statusIcon(status: "pending" | "confirmed" | "dismissed") {
  if (status === "pending") return <CircleQuestionIcon />;
  return <CircleCheckIcon />;
}

// STILL HAND-DRAWN — exports needed to finish the set:
//   check           (tick in "Matched to …" and the save-value button)
//   xmark           ("Remove section" in the row menu)
//   ellipsis        (the row's more-options button)
//   paper-plane     (chat send)
//   triangle-exclamation (the "worth a check" flag on medium-confidence rows)
