# Colour System

The palette used in `taxfix-step1.html`, and the rule for when each colour is allowed to appear. Source: production `taxfix.com` CSS, cross-checked against the canonical Taxfix design-system export — both agree on every value below.

---

## Tokens

All colours are CSS custom properties defined once in `:root` (light) and re-defined under `@media (prefers-color-scheme: dark)` / `[data-theme="dark"]`. Change a value in one place and every usage updates.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--green` | `#ADEE68` | `#3BB96C` | Primary action fill (buttons, active progress step) |
| `--green-h` | `#CEF5A4` | `#4ECF80` | Hover state for `--green` |
| `--green-bg` | `#ECFFC7` | `#0C2318` | Lightest green tint (success backgrounds) |
| `--green-br` | `#CEF5A4` | `#194A2F` | Border on green-tinted elements |
| `--green-dark` | `#36893B` | `#36893B` (unchanged) | Text/icon on light surfaces — "done", detected values, success |
| `--green-text` | `#154618` | `#154618` (unchanged) | Text on top of `--green` fill (e.g. primary button label) |
| `--lilac` | `#BC73F2` | `#CE8AF5` | Accountant Panel accent |
| `--lilac-dark` | `#604587` | `#CE8AF5` (= `--lilac`) | Text/icon on lilac-tinted surfaces |
| `--lilac-bg` | `#F6EBFE` | `#241531` | Accountant Panel card background |
| `--lilac-br` | `#DBB9F3` | `#4A2E63` | Accountant Panel card border |
| `--blue` | `#668CFF` | `#7B96F9` | Reserved — not yet assigned to a surface |
| `--blue-bg` | `#E8F0FF` | `#0E1535` | Reserved |
| `--blue-br` | `#B6C5F3` | `#1D2E60` | Reserved |
| `--amber` | `#F8A21A` | `#FBBF24` | Reserved — not yet assigned to a surface |
| `--amber-bg` | `#FFEFD3` | `#1C1408` | Reserved |
| `--amber-br` | `#F8C677` | `#3D2A00` | Reserved |

Neutrals (`--bg`, `--surface`, `--surface-2`, `--border`, `--border-soft`, `--text`, `--muted`, `--dim`) carry everything else — page background, cards, borders, body copy — and are intentionally left off this list since they aren't brand colour, just the stone/grey scale from the wireframe pass.

---

## Application rule

Two colours are in active use. Each is reserved for one job, not spread across the page:

- **Green** — the single "this is happening / this succeeded" colour. Progress bar's active step, the primary "Hand over for review" button, done-checkmarks, success toasts, detected-value text. Nowhere else.
- **Lilac** — the Accountant Panel's identity colour, and *only* the Accountant Panel's. Card background, border, credential badge, text-link hovers inside that one component. It does not appear on the Tax Position or the Document Checklist, by design — those stay neutral so they don't visually compete with the panel that's supposed to feel distinct ([PAGE-COMPONENTS.md](PAGE-COMPONENTS.md)).
- **Blue and amber** are defined as tokens (validated against the same production source) but not wired into any component yet. Reach for them — not a new hex value — the next time a component needs a third accent.

Before adding a new colour anywhere: check whether green or lilac already covers the intent. If it's decoration rather than signal (an icon just to differentiate a row, a border for visual interest), that's a sign it should stay on the neutral scale, not reach for a token.

---

## Known quirk

The two dark-mode contexts (`prefers-color-scheme: dark` vs `[data-theme="dark"]`) use slightly different base greys — `--bg` is `#0E1410` in one and `#0C1017` in the other, and `--surface`/`--surface-2` differ similarly. That predates this colour pass and wasn't touched; every brand colour (green/blue/amber/lilac) is identical between the two.
