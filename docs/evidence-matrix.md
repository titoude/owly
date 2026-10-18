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

## Explicitly not claimed

- **Screen-reader validated.** No NVDA/VoiceOver/TalkBack pass has been
  run; axe + keyboard checks are not a substitute.
- **Tagged/accessible PDF.** The report is a visual document; its PDF
  structure and AT behavior were not validated.
- **Clinically validated translations.** FLACC wording: English
  everywhere except French (pre-existing French text, validation
  unverified — see `docs/i18n-review.md`). UI strings are
  machine-assisted translations pending human review.
- **Encryption.** The PIN is a screen lock; data is not encrypted at
  rest. See `docs/privacy.md`.
- **Instrument redistribution rights.** FLACC wording follows the
  published instrument; authorization status is documented in
  `README.md` › Instrument licensing — marked UNKNOWN, not assumed.
- **Medical validation / real-user testing.** No caregivers or
  clinicians have evaluated the app; the demo data is fictional.

## Test status (Opethon candidate, 2026-10-04)

`npm run build` clean · `npx vitest run` 38/38 · `e2e/smoke.mjs` 9/9 ·
`e2e/full.mjs` 44/44 · `e2e/keyboard.mjs` 17/17 · `e2e/offline.mjs` 6/6 ·
a11y audit 33/33 PASS / 0 violations / 0 unverified.
`npm run lint` exits 0 with 11 warnings (style/purity hints, no errors). These are recorded results, not a promise that every future commit passes. The CI also runs typecheck, lint, localization parity, tests, the production build, browser flows, offline/PDF and the manifest-checked accessibility scan; see [the workflow](../.github/workflows/ci.yml) for the latest run.

Note on audit scope history: the baseline run covered 25 scenarios; the
final run covers 33. The 8 added states (draft-resume, observe-edit,
draft-save-error, pdf-unsupported, storage-denied-boot, ls-denied-boot,
empty-patterns, fr-observe) have **no comparable baseline** — they were
introduced alongside the features they check.
