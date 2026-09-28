# Accessibility evidence

Scope statement, audit method, and the honest boundary between what was
machine-checked and what still needs a human with a screen reader.

## What was checked, and how

Automated audit: `scripts/a11y/audit.mjs` (axe-core 4.10 + Playwright/Chromium,
tags `wcag2a wcag2aa wcag21a wcag21aa wcag22aa best-practice`) against the
production build (`vite preview`). The audited scope is fixed by
`scripts/a11y/manifest.json` — every reachable route plus the interactive
states that a route crawl misses. Reports land in `a11y-audit/*/`.

Coverage (32 scenarios, all PASS — 0 violations):

- All 9 routes: `/` `/welcome` `/observe` `/history` `/patterns` `/report`
  `/settings` `/redflags` `/child/new` (+ `/child/:id/edit`).
- All 8 observe wizard steps, audited live while advancing.
- States: child edit form, empty dashboard/history/patterns (zero
  observations — each audited separately), PIN lock screen, wrong-PIN
  error, inline delete confirmation, import replacement-preview dialog,
  French locale, Arabic (RTL) shell.
- New flows: draft resume/discard offer, observation edit mode, draft-save
  failure surfaced under fault injection (IndexedDB `put` →
  QuotaExceededError), unsupported-character PDF error, boot with
  IndexedDB+localStorage denied (recovery screen), boot with only
  localStorage denied (app still loads).

Keyboard: `e2e/keyboard.mjs` — 11 assertions on the FLACC radio groups
(focus without selection, ArrowDown/Up changes selection+focus, wraparound,
Tab exits the group at the checked item, Shift+Tab re-enters on it, Tab
reaches an interactive element). Follows the CUA radio-group contract.

Reflow: nav labels verified unclipped at 320×800 in all 9 locales.

## Dispositions

- `color-contrast` was `incomplete` on every page under axe-core 4.10.3
  because the whole rule **threw** on Tailwind v4's `oklch(… 0 none)`
  colors — `nodes:[]` meant "unevaluated", not "no issues". The harness
  now pins axe-core 4.13.0 (the official release line that parses
  oklch/oklab `none`) and surfaces each incomplete rule's error +
  errorNode. The old baseline's contrast results are **noncomparable** —
  contrast was never evaluated there; current runs evaluate it for real.
- The FLACC scale wording renders in English on non-EN/FR locales (clinical
  wording authorization is unconfirmed — see `docs/i18n-review.md`); those
  spans carry `lang`/`dir` so assistive tech pronounces them correctly.

## What this does NOT prove

- **No real screen-reader pass**: axe + keyboard checks do not equal NVDA/
  VoiceOver/TalkBack validation. A human AT pass remains outstanding.
- **No tagged-PDF claim**: the generated report is a visual document. PDF
  structure tags, reading order, and AT behavior in a PDF reader were not
  validated — the "accessibility" evidence here covers the web app only.
- **Zoom/reflow beyond nav labels**, reduced-motion, and live-region
  announcements are partially covered by manual checks, not exhaustively.
- Human usefulness/translation quality: not validated by machines. The FLACC
  wording review status is tracked in `docs/i18n-review.md`.
