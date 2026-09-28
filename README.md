# 🦉 Owly

**A private, offline-first pain observation journal for children who can't say it hurts.**

Owly helps parents and caregivers of nonverbal children — severe autism, cerebral palsy, complex disabilities, or any child who can't self-report pain — record what they see, spot patterns, and walk into a doctor's appointment with evidence instead of a shrug.

Built for [Opethon](https://opethon.com/) — Accessibility & Inclusion track.

---

## The problem

A child who can't speak still feels pain. Parents of nonverbal kids learn to read grimaces, rocking, sudden stillness — but when the doctor asks *"how often? how bad? what helps?"*, all they have is memory and worry. Pain in this population is documented to be **under-recognized and under-treated**: caregivers report distress behaviors clinicians can't interpret, and every appointment starts from zero.

Commercial tools exist, but they're built for institutions. PainChek® — the leading clinical product — is licensed to facilities and clinicians; it does offer a parent-facing app, but only for infants aged 1–12 months ([PainChek Infant](https://www.painchek.com/use-cases/infant-for-parents/)).

Owly's difference is architectural, not clinical: local-first and offline, no account, no subscription — a journal for caregivers, not a diagnostic tool. We don't claim no other option exists; we claim this one is private by design and free.

## What Owly does

- **Guided observations** — [FLACC](https://en.wikipedia.org/wiki/FLACC_scale) scoring (Face, Legs, Activity, Cry, Consolability), a published observational instrument intended for patients who can't self-report
- **Personalized to your child** — individualized rFLACC descriptors ("how *your* child shows pain") shown right inside each scoring step
- **Baseline vs. episode** — record calm moments too, so "different from usual" is measurable
- **Body map, interventions, notes** — where it might hurt, what you tried, whether it helped
- **Pattern summaries** — time-of-day clusters and recurring areas to bring to a clinician
- **Doctor report PDF** — a clinician-ready report: communication cues, episode timeline with scores, patterns, and your questions. Generated 100% on-device.
- **Works offline** — installable PWA; all assets precached so previously-loaded installs work with no network, 9 languages (EN, FR, ES, PT, DE, IT, AR, HI, 中文)

## Privacy by architecture

Owly is **local-first**: every observation lives in IndexedDB on your device. No account, no server, no analytics, no cloud. Journal data is never transmitted — the only network traffic is same-origin asset fetches and service-worker update checks (verifiable in dev tools). All assets (including PDF fonts) are bundled and precached, so the app keeps working offline. Optional PIN lock, full JSON export/import, and one-tap total data deletion.

## Quick start

Requires **Node.js ^20.19 or ≥22.12** (Vite 8's requirement); built and tested on Node 24.

```bash
npm ci --ignore-scripts   # frozen install
npm run dev               # http://localhost:5173
```

Then press **"Load demo data"** in Settings (or on the onboarding screen) — you'll get *Léo*, a fictional 9-year-old with 3 weeks of realistic observations, so every feature is visible in 30 seconds.

### Production

```bash
npm run build      # → dist/
npm run preview    # serve the production build
```

`dist/` is fully static — host it on any static server (GitHub Pages, Netlify, a Raspberry Pi). No backend required, ever.

## Try the demo story

1. Load Léo's data → open **Patterns**: nearly all episodes cluster at night and point to the ears
2. Open **Report** → generate the PDF → that's the page you'd hand the pediatrician
3. Record a new observation yourself through the guided wizard

## Tech

- React 19 + TypeScript (strict) + Vite 8 + Tailwind v4
- Dexie (IndexedDB) — local-first storage
- pdf-lib — on-device PDF generation
- vite-plugin-pwa — offline, installable
- Vitest + Testing Library + fake-indexeddb (34 unit/integration tests)
- Playwright e2e against the production build: `npm run e2e` (9 golden-path scenarios), `npm run e2e:full` (41 scenarios: PDF download incl. chunk-failure recovery, PIN lock, import/export incl. cancel/reject paths, drafts, demo data…), `npm run e2e:keys` (17 keyboard checks: radio groups, skip link, dialog focus), `node e2e/offline.mjs` (offline cold reload + PDF bytes)
- axe-core accessibility audit over the full route/state manifest: `node scripts/a11y/audit.mjs` — 32 scenarios, 0 violations
- oxlint + `tsc -b` in CI
- i18next — 9 languages: English, French, Spanish, Portuguese, German, Italian, Arabic (RTL), Hindi, Simplified Chinese

## Project layout

```
src/
  flacc.ts         FLACC descriptors, bands, body zones, intervention types
  db.ts            Dexie schema (children, observations, settings)
  demo.ts          Seed data for "Léo" (demo child)
  report.ts        pdf-lib doctor report builder
  export.ts        JSON backup/restore/wipe
  pin.ts           SHA-256 PIN hashing for app lock
  pages/           Onboarding, Observe (8-step wizard), History, Patterns,
                   Report, Settings, RedFlags, ChildForm, LockScreen
  components/      FlaccPicker, BodyMap, ScoreBadge
  test/            unit + integration tests
e2e/smoke.mjs      golden-path e2e (playwright + system chrome)
```

## Roadmap (post-hackathon)

- Optional encrypted sync across a family's devices (still no server we run)
- FHIR export for EHR integration
- Sleep/feeds context fields
- Caregiver handoff mode (school nurses, respite care)

## Disclosure

Built with AI assistance (Devin / Cognition) — scaffolding, i18n, tests and docs are AI-generated; review status is tracked in `docs/`. The English FLACC descriptors follow the published instrument (Merkel et al., 1997); the individualized descriptors follow rFLACC (Malviya et al., 2006). See below for instrument licensing.

**Competition note:** this PR builds on a pre-existing repository for Opethon. Existing-repo and start-date eligibility are **unconfirmed** — verify with the organizers before counting this as a submission.

## Instrument licensing

FLACC is a published clinical instrument. Redistribution and translation terms vary by source:

- University of Michigan (instrument origin) describes commercial and authorized academic/research licenses, English-only official wording, licensee-managed translation: https://available-inventions.umich.edu/product/face-legs-activity-cry-consolability-observational-tool-as-a-measure-of-pain
- PhenX Toolkit describes the protocol as freely available for use: https://phenxtoolkit.org/protocols/view/860403

Owly ships the English wording in every locale **except French**, which carries a pre-existing French translation whose provenance and validation status are unverified — it is marked `lang="fr"` on screen and flagged for review (see `docs/i18n-review.md`). We do **not** claim the scale is public domain or that its translation is authorized. Whether a license already exists for this redistribution is **unknown — no licensor has been contacted**; machine-translated clinical wording is not shipped as a validated scale.

**Owly is an observation journal, not a medical device.** It records what caregivers observe — it does not diagnose. The red-flags screen is there for a reason: when in doubt, call a doctor.

## Third-party notices

- **Noto fonts** (Noto Sans Regular/Bold, Noto Sans Arabic, Noto Sans Devanagari, Noto Sans SC subset): vendored in `src/assets/fonts/` under the SIL Open Font License 1.1 (full text: `src/assets/fonts/OFL.txt`). The SC file is a subset limited to the official 8 105-character GB 18030 / Table of General Standard Chinese Characters scope plus ASCII and CJK punctuation, used so the PDF report can render CJK offline.
- The PDF report embeds these fonts so Arabic, Indic and CJK text render (shaped via fontkit) instead of being stripped. If a record contains a character no bundled font can draw (emoji, rare CJK extension-B…), generation aborts with a clear error naming the offending characters — the report is never produced with silent boxes, and the journal data is unaffected.
- Runtime libraries: pdf-lib (MIT), @pdf-lib/fontkit (MIT), bidi-js (MIT), regenerator-runtime (MIT, required at runtime by fontkit's Indic shaper), React/Dexie/i18next and friends per their package licenses; dev-time libraries: axe-core (MPL-2.0), Playwright (Apache-2.0).

## Docs

- [docs/demo-script.md](docs/demo-script.md) — 3-minute walkthrough
- [docs/privacy.md](docs/privacy.md) — what is stored where, honest limits
- [docs/accessibility-statement.md](docs/accessibility-statement.md) + [docs/accessibility-evidence.md](docs/accessibility-evidence.md) — what's verified vs not
- [docs/evidence-matrix.md](docs/evidence-matrix.md) — every claim mapped to its proof
- [docs/i18n-review.md](docs/i18n-review.md) — translation review status
- [CONTRIBUTING.md](CONTRIBUTING.md) · [SECURITY.md](SECURITY.md)

## License

MIT — see [LICENSE](LICENSE).
