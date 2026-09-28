# Contributing to Owly

Thanks for helping. Owly exists for a population that gets very few free tools — every contribution matters.

## Ground rules

1. **Privacy is non-negotiable.** Owly is local-first. Any feature that sends data off the device needs an opt-in flag, a README section, and a good reason. PRs that add telemetry, analytics, or third-party calls will be rejected.
2. **Observations, not diagnosis.** Owly records what caregivers see. It must never present a FLACC score as a medical conclusion, and never add "risk prediction" or auto-diagnosis language.
3. **Caregivers are tired.** Design for 3 a.m.: large targets, few taps, calm colors, no account creation, no paywalls.
4. **FLACC wording is not public domain.** The English FLACC descriptors follow the published instrument (Merkel et al., 1997; rFLACC: Malviya et al., 2006). Redistribution/translation rights are being verified with the licensor — do not translate the scale wording until that is confirmed (see README › Instrument licensing). Keep its scoring semantics intact (0–2 per category, 0–10 total).

## Dev setup

```bash
npm install
npm run dev
```

Checks before a PR:

```bash
npm run build   # typecheck + prod build
npm run lint    # oxlint
npx vitest run  # unit + integration tests
node e2e/smoke.mjs  # e2e against `npm run preview` on :4173
```

## Conventions

- TypeScript strict; no `any` unless the type genuinely can't be expressed.
- All user-facing strings go through `src/locales/{en,fr}.json` — PRs adding English-only strings will be asked to add French too (and vice versa).
- Schema changes bump the Dexie version in `src/db.ts` with a migration — never silently reshape stored data.
- Tests: unit tests in `src/test/`, and if your change touches a user flow, update `e2e/smoke.mjs`.

## i18n

Every locale file must contain the same key set. `src/locales/fr.json` is the reference for completeness — new languages welcome: copy `en.json`, translate, register in `src/i18n.ts`, add to the language picker in `src/pages/Settings.tsx`.

## Good first issues

- Additional languages (es, de, ar, …)
- Accessibility audit (axe / VoiceOver / keyboard-only flows)
- More body-map granularity
- Smaller bundle / faster cold start
