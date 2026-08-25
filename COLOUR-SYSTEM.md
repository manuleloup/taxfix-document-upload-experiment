# Colour System

The palette used in `taxfix-step1.html`, and the rule for when each colour is allowed to appear. Source: production `taxfix.com` CSS, cross-checked against the canonical Taxfix design-system export — both agree on every value below.

This doc has two layers:
- **[Tokens](#tokens)** — the small set actually wired into the CSS today.
- **[Full source palette](#full-source-palette)** — everything from the design-system export, including colours this project doesn't use yet. Kept here so nobody has to re-derive them later.

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

## Full source palette

The complete palette from the canonical design-system export, exactly as extracted — every family, all nine functional steps, every accent. Most of this isn't wired into the project's CSS yet (see [Tokens](#tokens) above for what is); it's kept here as the full lookup so the next colour we need doesn't require re-deriving it from a screenshot again.

Where a swatch is defined as black/white at a given opacity rather than a flat hex (common in the Neutral, Text, Graphics, and Common groups), both the raw value and the effective hex *when placed over a white background* are given — the raw value is the authoritative one and will look different over a non-white surface.

### Functional — 9-step ramps

Each row is: Background light → Background → Main → Light → Primary action → Secondary action → Hover → Pressed → Contrast.

| Family | Bg light | Background | Main | Light | Primary action | Secondary action | Hover | Pressed | Contrast |
|---|---|---|---|---|---|---|---|---|---|
| **Primary** (green) | `#ECFFC7` | `#CEF5A4` | `#154618` | `#36893B` | `#A0D766` | `#A9D481` 40% (`#DDEECD`) | `#A9D481` 20% (`#EEF6E6`) | `#A9D481` 40% (`#DDEECD`) | `#154618` |
| **Secondary** (indigo) | `#E8F0FF` | `#B6C5F3` | `#4C4991` | `#668CFF` | `#C6D2F6` | `#C6D2F6` 40% (`#E8EDFB`) | `#C6D2F6` 20% (`#F4F6FD`) | `#C6D2F6` 40% (`#E8EDFB`) | `#4C4991` |
| **Success** | identical to Primary — same underlying token, reused | | | | | | | | |
| **Error** (coral) | `#FEEBE7` | `#F5A894` | `#912003` | `#FB5E36` | `#FBB3A2` | `#FBB3A2` 40% (`#FDE1DA`) | `#FBB3A2` 20% (`#FEF0EC`) | `#FBB3A2` 40% (`#FDE1DA`) | `#912003` |
| **Neutral** | `#F9F7F5` | `#F2EFED` | black 80% (`#3D3C3B`) | black 65% (`#616060`) | `#DCD8D2` | `#DCD8D2` 50% (`#EEECE9`) | `#DCD8D2` 25% (`#F6F5F4`) | `#DCD8D2` 50% (`#EEECE9`) | black 80% (`#3D3C3B`) |

### Accent (preferred — reach for these first)

| Family | Background light | Background | Main | Light |
|---|---|---|---|---|
| **Accent 1** (beige/black) | `#FDF8F2` | `#EAE0D7` | `#0C0B0A` | `#9A9288` |
| **Accent 2** = `--lilac` | `#F6EBFE` | `#DBB9F3` | `#604587` | `#BC73F2` |
| **Accent 3** = `--amber` | `#FFEFD3` | `#F8C677` | `#66541A` | `#F8A21A` |

### Supplementary Accent (only if 1–3 don't fit)

| Family | Background light | Background | Main | Light |
|---|---|---|---|---|
| **4** (magenta) | `#FFF0F6` | `#FEB9D6` | `#9D2054` | `#F53183` |
| **5** (teal) | `#D9F7E9` | `#96E4BE` | `#0D6359` | `#04A491` |
| **6** (slate) | `#F2F5F7` | `#BDCCD6` | `#415562` | `#758E9F` |
| **7** (yellow) | `#FDF9D3` | `#EFE272` | `#5C5200` | `#FDE200` |
| **8** (terracotta) | `#FCF6F2` | `#ECD3C1` | `#824417` | `#CE7B40` |

### System — Text

| Role | Value | Effective on white |
|---|---|---|
| Title | `#0C0B0A` | — |
| Primary | black 80% | `#3D3C3B` |
| Secondary | black 65% | `#616060` |
| Disabled | black 50% | `#868585` |
| Contrast text | `#FFFFFF` | — |

### System — Grey

| Role | Value | Effective on white |
|---|---|---|
| Background | `#FFFFFF` | — |
| Surface 1 | `#F2EFED` | — |
| Surface 2 | `#F9F7F5` | — |
| Surface 3 | white, outline only | — |
| Divider | black 12% | `#E2E2E2` |
| Divider contrast | white 16% | effectively invisible on white |

**Graphics** (a separate grey scale within the same group):

| Role | Value | Effective on white |
|---|---|---|
| Graphics 1 | `#0C0B0A` | — |
| Graphics 2 | `#96928E` | — |
| Graphics 3 | `#E4E1DD` | — |
| Graphics 90% | black 90% | `#242323` |
| Graphics 70% | black 70% | `#555454` |
| Graphics 40% | black 30% (as exported — not a typo, the source file's "40%" swatch is drawn at 0.3 opacity) | `#B6B6B6` |
| Graphics 10% | black 10% | `#E7E7E7` |

**Gradients** (down/up/right/left): white fading to transparent — used as fade-out overlays, not flat colours. No hex applies.

### System — Common

| Role | Value | Effective on white |
|---|---|---|
| Active | `#A0D766` 20% | `#ECF7E0` |
| Hover | black 10% | `#E7E7E7` |
| Pressed | black 20% | `#CECECE` |
| Disabled 1 | `#E4E1DD` | — |
| Disabled 2 | `#F2EFED` | — |
| Handle | white | — |

---

## Known quirk

The two dark-mode contexts (`prefers-color-scheme: dark` vs `[data-theme="dark"]`) use slightly different base greys — `--bg` is `#0E1410` in one and `#0C1017` in the other, and `--surface`/`--surface-2` differ similarly. That predates this colour pass and wasn't touched; every brand colour (green/blue/amber/lilac) is identical between the two.
