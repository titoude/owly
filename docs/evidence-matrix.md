# Evidence matrix

Every claim Owly makes, mapped to the artifact that backs it — and the
things we explicitly do **not** claim. This is the judge-facing honesty
doc: check anything.

## Verified claims

| Claim | Evidence | How to reproduce |
|---|---|---|
| Previously-loaded installs work offline | `e2e/offline.mjs` — reload with precache intact but network cut, then a PDF is generated and its bytes verified | `npm run preview`, `node e2e/offline.mjs` |
| No journal data transmitted | The app makes no API calls; only same-origin asset fetches and service-worker update checks occur. Exports/PDFs leave the device only if the user shares them | DevTools Network tab; `src/` has no fetch/XHR of user data |
| Local-first storage | Dexie/IndexedDB only; `src/export.ts` for the only IO path | `src/db.ts`, `src/export.ts` |
| Import can't half-destroy data | `importAll` validates before writing, commits in one transaction; unit tests fault-inject mid-tx | `npx vitest run` — store tests |
| Drafts are atomic with data | Drafts live in the `settings` store; replace/delete cleanup shares the mutation's transaction | `npx vitest run` — draft tests |
| Failed saves surface to the user | `role=alert` banners for journal/draft/report failures; e2e fault-injection covers quota/denied | `scripts/a11y/audit.mjs` states `draft-save-error` |
| Multilingual PDF (Arabic/Indic/CJK) | Vendored Noto fonts + fontkit shaping + bidi reordering; glyph-level assertions in `src/test/report.test.ts` | generate a report with mixed-script names |
| Unsupported characters never become silent boxes | `UnsupportedCharsError` → localized `role=alert`, PDF is not produced | rename a child with an emoji, generate report |
| Keyboard-operable wizard | `e2e/keyboard.mjs` — 17 assertions: radio groups, skip link, dialog focus entry/containment/Escape/restore | `npm run e2e:keys` |
| Automated a11y: 0 violations | `scripts/a11y/audit.mjs` — axe-core WCAG 2.2 A/AA + best-practice over the manifest | `node scripts/a11y/audit.mjs <url>` |
| 9 locales with key parity | `scripts/i18n-parity.mjs` — every locale has all keys | `node scripts/i18n-parity.mjs` |
| RTL works | `state:rtl` audit + `dir="rtl"` wiring + RTL-aligned PDF text | set language to العربية |
| PDF and on-screen report show the same numbers | Both read `summarize()` in `src/summary.ts`; unit tests cover periods, baselines, outcomes and the night rule; e2e checks the on-screen summary line | `npx vitest run src/test/summary.test.ts`, `npm run e2e:features` |
| On-screen report is an accessible equivalent of the PDF | Headings, captioned table with column and row headers, keyboard-scrollable region; audited by axe in light and night mode | `npm run e2e:features`; audit ids `route:/report/view`, `night-report-view` |
| Pain passport fits one A4 page and never lists medication | e2e prints it through Chromium and counts PDF pages; medication outcomes are filtered out in `Passport.tsx` | `npm run e2e:features` |
| Passport contact details are never stored | Contact lines render only in print media as blank lines; no field or storage exists for them | `src/pages/Passport.tsx` |
| Night mode keeps AA contrast | Seven main screens re-audited with `owly-theme=dark` (`night-*` ids); print always falls back to the light palette | `node scripts/a11y/audit.mjs`, `npm run e2e:features` |
| Works from a sub-path (live demo) | `OWLY_BASE=/owly/` build passes smoke, full and offline e2e when served under `/owly/` | `.github/workflows/pages.yml` |

## Explicitly not claimed

- **Screen-reader validated.** No NVDA/VoiceOver/TalkBack pass has been
  run; axe + keyboard checks are not a substitute.
- **Tagged/accessible PDF.** The PDF is a visual document; its PDF
  structure and AT behavior were not validated. The on-screen report is
  the accessible equivalent (same content, semantic HTML).
- **Clinically validated translations.** FLACC wording: English
  everywhere except French (pre-existing French text, validation
  unverified — see `docs/i18n-review.md`). UI strings are
  machine-assisted translations pending human review.
- **Encryption.** The PIN is a screen lock; data is not encrypted at
  rest. See `docs/privacy.md`.
- **Instrument redistribution rights.** FLACC wording follows the
  published instrument; redistribution and translation terms are being
  clarified (titoude/owly#3) and are not assumed.
- **Medical validation / real-user testing.** No caregivers or
  clinicians have evaluated the app; the demo data is fictional.

## Test status (2026-10-26)

`npm run build` clean · `npx vitest run` 44/44 · `e2e/smoke.mjs` 9/9 ·
`e2e/full.mjs` 44/44 · `e2e/keyboard.mjs` 17/17 · `e2e/features.mjs` 33/33 ·
`e2e/offline.mjs` 6/6 · `e2e/overflow-check.mjs` no overflow (5 widths × 3 locales × 7 routes) ·
a11y audit 43/43 PASS / 0 violations / 0 unverified.
The same e2e suites pass on an `OWLY_BASE=/owly/` build served from a sub-path.
`npm run lint` exits 0 with 11 warnings (style/purity hints, no errors). These are recorded results, not a promise that every future commit passes. The CI also runs typecheck, lint, localization parity, tests, the production build, browser flows, offline/PDF and the manifest-checked accessibility scan; see [the workflow](../.github/workflows/ci.yml) for the latest run.

Note on audit scope history: the baseline run covered 25 scenarios; the
release run covered 33; the current run covers 43 (adds `/passport`,
`/report/view`, `empty-passport` and seven `night-*` screens). The 8 states added in the release run (draft-resume, observe-edit,
draft-save-error, pdf-unsupported, storage-denied-boot, ls-denied-boot,
empty-patterns, fr-observe) have **no comparable baseline** — they were
introduced alongside the features they check.
