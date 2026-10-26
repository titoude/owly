# Accessibility evidence

Scope statement, audit method, and the honest boundary between what was
machine-checked and what still needs a human with a screen reader.

## What was checked, and how

Automated audit: `scripts/a11y/audit.mjs` (axe-core 4.13.0 + Playwright/Chromium,
tags `wcag2a wcag2aa wcag21a wcag21aa wcag22aa best-practice`) against the
production build (`vite preview`). The audited scope is fixed by
`scripts/a11y/manifest.json` — every reachable route plus the interactive
states that a route crawl misses. Reports land in `a11y-audit/*/`.

Coverage (43 scenarios, all PASS — 0 violations):

- All 11 routes: `/` `/welcome` `/observe` `/history` `/patterns` `/report`
  `/report/view` `/passport` `/settings` `/redflags` `/child/new`
  (+ `/child/:id/edit`).
- Night mode: dashboard, observe, patterns, report, on-screen report,
  passport and settings re-audited with the dark palette (`night-*`).
- Empty pain passport (child with no signs or observations).
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

Keyboard: `e2e/keyboard.mjs` — 17 assertions covering the FLACC radio
groups (CUA contract: focus without selection, Arrow keys change
selection+focus, wraparound, Tab exits at the checked item), the
skip-to-content link (first Tab stop after a fresh load; activates
without disturbing the HashRouter route and focuses `<main>`), and the
import-preview dialog (focus enters on open, Tab is contained, Escape
dismisses and restores focus to the trigger).

Reflow: nav labels verified unclipped at 320×800 in all 9 locales; no
horizontal overflow on 7 routes at 320/390/768/1024/1440 px in en, de
and ar (`e2e/overflow-check.mjs`). The on-screen report's wide table
scrolls inside its own keyboard-focusable region.

Print: `e2e/features.mjs` prints the passport and the on-screen report
through Chromium — one A4 page each, app chrome hidden, light palette
even when night mode is on.

## Dispositions

- `color-contrast`: under axe ≤4.13 the whole rule **threw** on the
  theme's `oklch(… 0 none)` neutral tokens — `nodes:[]` meant
  "unevaluated", not "no issues" (verified on 4.10.3, 4.11.1, 4.13.0).
  Rather than special-casing the audit, the production theme now pins the
  neutral scale to equivalent sRGB hex values, so the rule evaluates the
  built CSS for real. Result: the only remaining `incomplete` nodes are
  genuine "needs manual review" cases — axe cannot resolve composite
  backgrounds (backdrop-blur nav, dialog backdrop) — and the flagged
  pairs measure ≥ 4.5:1 on inspection (teal-700/white ≈ 5.5:1,
  amber-800/white ≈ 6.5:1). A real sub-AA failure this surfaced —
  white-on-amber-600 (≈ 3.1:1) on the import confirmation — was raised to
  amber-800. The pre-fix baseline's contrast results are **noncomparable**:
  contrast was never evaluated there.
- The FLACC scale wording renders in English on non-EN/FR locales (clinical
  wording authorization is unconfirmed — see `docs/i18n-review.md`); those
  spans carry `lang`/`dir` so assistive tech pronounces them correctly.

## What this does NOT prove

- **No real screen-reader pass**: axe + keyboard checks do not equal NVDA/
  VoiceOver/TalkBack validation. A human AT pass remains outstanding.
- **No tagged-PDF claim**: the generated PDF is a visual document. PDF
  structure tags, reading order, and AT behavior in a PDF reader were not
  validated. The on-screen report (`/report/view`) carries the same
  content as semantic HTML and is the accessible route.
- **Zoom/reflow beyond nav labels**, reduced-motion, and live-region
  announcements are partially covered by manual checks, not exhaustively.
- Human usefulness/translation quality: not validated by machines. The FLACC
  wording review status is tracked in `docs/i18n-review.md`.
