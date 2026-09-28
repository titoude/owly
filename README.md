# 🦉 Owly

**A private, offline-first pain observation journal for children who can't say it hurts.**

Owly helps parents and caregivers of nonverbal children — severe autism, cerebral palsy, complex disabilities, or any child who can't self-report pain — record what they see, spot patterns, and walk into a doctor's appointment with evidence instead of a shrug.

Built for [Opethon](https://opethon.com/) — Accessibility & Inclusion track.

---

## The problem

A child who can't speak still feels pain. Parents of nonverbal kids learn to read grimaces, rocking, sudden stillness — but when the doctor asks *"how often? how bad? what helps?"*, all they have is memory and worry. Pain in this population is documented to be **under-recognized and under-treated**: caregivers report distress behaviors clinicians can't interpret, and every appointment starts from zero.

Commercial tools exist, but they're built for institutions. PainChek® — the leading clinical product — is licensed to facilities and clinicians; it does offer a parent-facing app, but only for infants aged 1–12 months ([PainChek Infant](https://www.painchek.com/use-cases/infant-for-parents/)). For families of older nonverbal children, there is still no simple, private caregiver journal.

Owly's difference is architectural, not clinical: local-first and offline, no account, no subscription, no data leaves the device — a journal for caregivers, not a diagnostic tool.

## What Owly does

- **60-second observations** — guided [FLACC](https://en.wikipedia.org/wiki/FLACC_scale) scoring (Face, Legs, Activity, Cry, Consolability), a validated clinical instrument designed exactly for patients who can't self-report
- **Personalized to your child** — individualized rFLACC descriptors ("how *your* child shows pain") shown right inside each scoring step
- **Baseline vs. episode** — record calm moments too, so "different from usual" is measurable
- **Body map, interventions, notes** — where it might hurt, what you tried, whether it helped
- **Pattern detection** — time-of-day clusters, recurring areas, which interventions actually work
- **One-page doctor PDF** — a clinician-ready report: communication cues, episode timeline with scores, patterns, and your questions. Generated 100% on-device.
- **Works offline, everywhere** — installable PWA, English & French

## Privacy by architecture

Owly is **local-first**: every observation lives in IndexedDB on your device. No account, no server, no analytics, no cloud. The app makes zero network requests at runtime — you can verify this in dev tools. Optional PIN lock, full JSON export/import, and one-tap total data deletion. For a health journal about a child, this seemed like the only acceptable design.

## Quick start

Requires **Node.js ≥ 20** (built and tested on 22).

```bash
npm install
npm run dev        # http://localhost:5173
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
3. Record a new observation yourself: ~40 seconds, five taps

## Tech

- React 19 + TypeScript (strict) + Vite 8 + Tailwind v4
- Dexie (IndexedDB) — local-first storage
- pdf-lib — on-device PDF generation
- vite-plugin-pwa — offline, installable
- Vitest + Testing Library + fake-indexeddb (13 unit/integration tests)
- Playwright e2e against the production build: `npm run e2e` (9 golden-path scenarios) and `npm run e2e:full` (15 exhaustive scenarios: PDF download, PIN lock, FR/EN switch, JSON export…)
- oxlint + `tsc -b` in CI
- i18next — English & French

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

Built with AI assistance (Devin / Cognition) — scaffolding, i18n, tests and docs were AI-generated and human-reviewed. The English FLACC descriptors follow the published instrument (Merkel et al., 1997); the individualized descriptors follow rFLACC (Malviya et al., 2006). See below for instrument licensing.

## Instrument licensing

FLACC is a published clinical instrument. Redistribution and translation terms vary by source:

- University of Michigan (instrument origin) describes commercial and authorized academic/research licenses, English-only official wording, licensee-managed translation: https://available-inventions.umich.edu/product/face-legs-activity-cry-consolability-observational-tool-as-a-measure-of-pain
- PhenX Toolkit describes the protocol as freely available for use: https://phenxtoolkit.org/protocols/view/860403

Owly ships the English wording only and does **not** claim the scale is public domain or that its translation is authorized. Whether a license already exists for this redistribution is being confirmed; machine-translated clinical wording is not shipped as a validated scale.

**Owly is an observation journal, not a medical device.** It records what caregivers observe — it does not diagnose. The red-flags screen is there for a reason: when in doubt, call a doctor.

## License

MIT — see [LICENSE](LICENSE).
