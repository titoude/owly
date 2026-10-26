# Contributing to Owly

Thanks for helping. Owly exists for a population that gets very few free tools — every contribution matters.

## Ground rules

1. **Privacy is non-negotiable.** Owly is local-first. Any feature that sends data off the device needs an opt-in flag, a README section, and a good reason. PRs that add telemetry, analytics, or third-party calls will be rejected.
2. **Observations, not diagnosis.** Owly records what caregivers see. It must never present a FLACC score as a medical conclusion, and never add "risk prediction" or auto-diagnosis language.
3. **Caregivers are tired.** Design for 3 a.m.: large targets, few taps, calm colors, no account creation, no paywalls.
4. **FLACC wording is not public domain.** The English FLACC descriptors follow the published instrument (Merkel et al., 1997; rFLACC: Malviya et al., 2006). Redistribution/translation terms are being clarified (titoude/owly#3) — do not translate the scale wording (see README › Clinical scale and licensing). Keep its scoring semantics intact (0–2 per category, 0–10 total).

## Dev setup

```bash
npm ci --ignore-scripts   # frozen install
npm run dev
```

Checks before a PR:

```bash
npm run build   # typecheck + prod build
npm run lint    # oxlint
npx vitest run  # unit + integration tests
node e2e/smoke.mjs        # golden-path e2e (serve the build on :4173 first)
node e2e/full.mjs         # extended e2e: PDF, PIN, import/export, drafts
node e2e/keyboard.mjs     # keyboard navigation on the wizard
node e2e/features.mjs     # pain passport, on-screen report, print, night mode
node e2e/offline.mjs      # offline cold-reload + PDF bytes
node scripts/a11y/audit.mjs http://localhost:4173  # axe audit (0 violations gate)
```

## Conventions

- TypeScript strict; no `any` unless the type genuinely can't be expressed.
- All user-facing strings go through the locale files — all 9 locales (`src/locales/*.json`) must keep the same base key set; `node scripts/i18n-parity.mjs` enforces it. Note that plural-form keys legitimately differ per locale's CLDR rules (e.g. Arabic needs `_zero/_two/_few/_many`) — the checker accounts for that.
- Schema changes bump the Dexie version in `src/db.ts` with a migration — never silently reshape stored data.
- Numbers shown to people (PDF, on-screen report, passport, patterns) come from `src/summary.ts` — extend it rather than recomputing in a page.
- Colours go through the theme tokens in `src/index.css`; night mode re-points them, so a new colour utility may need a dark value there (the `night-*` audit scenarios will tell you).
- Tests: unit tests in `src/test/`, and if your change touches a user flow, update `e2e/smoke.mjs` (or `e2e/features.mjs` for the passport, report view and night mode).

## i18n

Every locale file must contain the same key set (`en.json` is the reference). New languages welcome: copy `en.json`, translate, register in `src/i18n.ts`, add to the language picker in `src/pages/Settings.tsx`. Do **not** translate the FLACC scale wording — licensing is being clarified (see README › Clinical scale and licensing); it ships in English on non-French locales on purpose.

## Good first issues

- Human review of the non-EN/FR UI translations (machine-assisted now)
- Real screen-reader pass (NVDA/VoiceOver/TalkBack) — see `docs/accessibility-evidence.md` for what's verified vs not
- More body-map granularity
- Smaller bundle / faster cold start
