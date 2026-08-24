# Page Components

Definitions for the three main components of the document upload page, so they can be named, referred to and built independently.

The "should contain" lists are working proposals. Individual items still need reviewing and confirming.

---

## How the three relate

One sentence for the whole page: **your tax profile determines which documents are expected, the documents you provide build your tax position, and an accountant checks it before anything is filed.**

That gives four named things, one of which is data rather than UI:

| | Thing | Type | Changes as you work? |
|---|---|---|---|
| 0 | **Tax Profile** | Data, set by the questionnaire | Rarely |
| 1 | **Document Checklist** | Page component | Constantly |
| 2 | **Tax Position** | Page component | Constantly |
| 3 | **Accountant Panel** | Page component | Never |

The Document Checklist is the input side, the Tax Position is the output side, and the Accountant Panel sits outside that loop entirely.

---

## 1. Document Checklist

**Internal name:** Document Checklist
**Customer-facing label:** "Your documents"

### Purpose

Tell the user exactly what is expected of them, show what they have already provided, and accept new documents. It converts an open-ended request into a finite, personalised, visibly shrinking list.

### Description

A grouped list generated from the user's tax profile. Each group corresponds to something in the profile that carries document requirements: PAYE employment, rental property, and a standing catch-all. Within each group sit document line items, each marked as core, alternative or enriching, each showing its own state.

Every item accepts a document. The list has no sequence: any item can be satisfied at any time, and no item gates another.

### Role in the journey

This is where the user spends their time and effort. It is the task surface. It also carries the mechanic that drives the loop, since gap detection lives here: when a document arrives, this component is what tells the user what is now missing and why it matters.

### Should contain

- Groups derived from the profile, so two users see different lists
- Per-item state: expected, processing, received, corrected, not applicable, unreadable
- The alternative-document route on every core item
- A "does not apply to me" route on every item
- The catch-all group for anything unexpected
- A visible count of what is outstanding

### Must not do

- Enforce an order
- Block on any single item
- Display tax figures or calculated amounts. Extracted values may appear as confirmation that a document was read; anything derived belongs in the Tax Position

### Sub-component: Upload Target

Sitting inside the Checklist for now, and separable later. A single drop area that accepts anything and routes it to the right item without the user having to say what it is. Named separately from the start, because it is the part most likely to move or multiply once per-item upload is added.

### How it evolves

From the current hardcoded two-group accordion, to a profile-generated list, to one that reacts to what has arrived by re-stating what is missing.

---

## 2. Tax Position

**Internal name:** Tax Position
**Customer-facing label:** "Your tax position (so far)"

### Purpose

Show the user what their documents have produced. This is the reward surface and the reason to upload the next document.

### Description

A live view of the user's standing for the tax year, built from the documents provided. Three areas: what has been established (income, expenses, tax already paid), where that leaves them (the balance), and what has been spotted (deductions and opportunities). Every figure traces back to the document it came from.

### Role in the journey

This is the payoff. It should be the most prominent thing on the page after the task itself, and it should visibly move every time a document lands.

### Should contain

- Figures that appear and update as documents are processed
- The source of every figure, traceable back to an upload
- Confirmation state per figure: read from a document, calculated, assumed, confirmed by you, checked by an accountant
- The deductions and opportunities found, with magnitude shown and detail locked
- Its own sense of completeness, separate from the checklist's document count

### Must not do

- Show a figure it cannot defend from the documents provided
- Present anything unchecked as final
- Duplicate the checklist's job of telling the user what to upload next

### Differentiation from the Accountant Panel

The Position answers *where do I stand*. The Accountant Panel answers *who is looking after this*. The Position changes constantly and is unique to this user in this tax year. The Accountant Panel is static and says the same thing to everyone. They should not share visual treatment or sit in the same container.

### How it evolves

From placeholder rows, to figures that populate from uploads, to a full breakdown with provenance and a locked opportunities section. Likely the component that moves out of the sidebar entirely.

---

## 3. Accountant Panel

**Internal name:** Accountant Panel
**Customer-facing label:** "Your accountant"

### Purpose

Reassure the user that a qualified human checks everything before it reaches HMRC, and provide the route to that human.

### Description

A persistent, largely static element identifying the accountant who will review and file the return, with their credentials and a way to contact them. Its content does not depend on what the user has uploaded.

### Role in the journey

It underwrites the whole experience. The user is being asked to accept figures produced by software, and this component is the answer to the obvious objection. It is also where the paid proposition eventually lives, since the transition from unchecked to accountant-checked is what payment buys.

### Should contain

- A named, credentialled human
- A statement of what they do: check every figure, apply remaining deductions, file with HMRC
- A contact route

### Must not do

- Display tax figures or per-document status
- Imply the accountant has already reviewed anything, unless they have
- Compete with the Tax Position for prominence

### Boundary with the Tax Position

One place where the two components cooperate: the per-figure marker showing whether something has been accountant-checked. Proposal is that the marker lives in the Position, and this panel explains what it means. Otherwise the two will drift into saying the same thing twice.

### How it evolves

Static now, and likely the last to change. The eventual question is whether it stays constant or becomes responsive, appearing at the moment the user is looking at an unconfirmed figure.

---

## Quick reference

| Component | Answers | Owns | State |
|---|---|---|---|
| Document Checklist | What do you need from me? | Expectations, uploads, gaps | Dynamic |
| Tax Position | Where do I stand? | Figures, provenance, opportunities | Dynamic |
| Accountant Panel | Who is looking after this? | Assurance, contact | Static |

Note on the current build: the Accountant Panel sits at the top of the sidebar with the Tax Position beneath it. If the Position becomes the key piece of information on the page, that ordering works against it, and separating the two into distinct containers is likely the first structural move.
