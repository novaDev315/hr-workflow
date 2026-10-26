# HRFlow Pro design system

## Intent

HRFlow Pro is a calm, people-first admin system. It should feel trustworthy, warm, and composed rather than cold, glossy, or aggressively enterprise.

The live app should adapt this system for production use. Keep existing workflows, tables, and forms, but express them through this visual language.

## Core Principles

1. Lead with calm.
2. Prefer editorial hierarchy over heavy chrome.
3. Make admin work feel human and low-noise.
4. Use warmth and containment to build trust.
5. Keep data-dense pages readable; never sacrifice clarity for decoration.

## Color

- `Background`: `#f5f4ed`
- `Surface`: `rgba(250,249,245,0.96)`
- `Muted surface`: `rgba(240,238,230,0.94)`
- `Border`: `rgba(232,230,220,0.96)`
- `Primary accent`: `#c96442`
- `Primary strong`: `#7c3d28`
- `Accent alt`: `#e4eadc`
- `Ink`: `#141413`
- `Muted text`: `#5e5d59`

Semantic states should remain readable and distinct, but their backgrounds should be softened so they sit naturally inside the warm system.

## Typography

- Body/UI: a clean modern sans.
- Display/editorial headings: serif with high contrast and quiet authority.
- Monospace: use only for technical or numeric details.

Rules:

- Page titles and large section titles should use the editorial typeface.
- Dense tables, labels, and controls should remain in the sans family.
- Avoid overusing the serif on small utility labels.

## Surfaces and Layout

- Large surfaces are rounded, soft, and lightly inset by shadow.
- Borders should do more work than strong shadows.
- The app shell should feel framed and contained, not edge-to-edge.
- Navigation should feel quiet and stable.
- Hero sections should feel welcoming and warm, not promotional.
- Every page opens with a compact page header (`AdminHero`): serif title that is the page name, one short task-oriented line, actions right-aligned. Target 80–96px tall. Only Home uses a larger greeting.

## Components

- Cards: parchment-like surfaces, soft borders, restrained shadows.
- Buttons: rounded, substantial, and warm; outline buttons should still feel tactile.
- Inputs: soft white fields with warm borders and clear focus rings.
- Notices and badges: readable, but toned to match the calm system.
- Metric cards: concise, low-noise, with strong value hierarchy. The caption describes the value itself; no decorative borders or colored icon tiles; equal heights in a row.
- Tables (`AdminTable`): natural column widths with horizontal scroll and a soft edge shadow, never clipped. Dates, numbers and badges stay on one line; numeric columns are right-aligned with tabular numbers. Use `density="compact"` for dense registers.
- Status badges render readable labels ("On leave", never `ON_LEAVE`) in sentence case and never wrap.
- Confirm consequential actions (process payroll, mark as paid, delete) with `ConfirmDialog` showing what will happen.

## Voice

- Short, calm, practical.
- Prefer “review”, “prepare”, “keep current”, “people updates”, “support”.
- Avoid aggressive dashboard language and generic startup copy.
- Sentence case everywhere. Calm verbs: "Review", "Process payroll", "Mark as paid".
- Never show raw enums, codes, ISO dates or "day(s)". Use the shared formatters in `src/lib/format.ts` (formatMoney, formatDay, formatMonth, plural, formatStatus).
- Consistent nouns: "Leave" (not "Leaves"), "Payslips", "Policies".
- Error messages come from the server via `readableError()`; never show transport noise.

## Responsive

- Every page reflows at 390px with 16px gutters and no horizontal page scroll. Wide tables scroll inside their own frame.

## Production Adaptation Rules

- Do not copy the demo layout literally into the live app.
- Apply the system through theme, shell, and page chrome first.
- Preserve live forms, GraphQL flows, tables, and CRUD actions.
- Where needed, lightly upgrade top-of-page hero sections so the app clearly feels like HRFlow Pro.
