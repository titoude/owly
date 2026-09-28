# Demo script (≈3 minutes)

Goal: show that a caregiver can go from "installed" to "a report a
pediatrician can read" entirely offline, in under a minute of taps.

## Setup

Serve the production build (`npm run preview`) and open it on a phone
viewport (~390 px) — Owly is designed for one-handed use. Airplane mode
optional but recommended: the point is that nothing needs a network.

## Walkthrough

1. **Onboarding (10 s)** — Welcome screen: "Explore the demo instead".
   One tap seeds *Léo*, a fictional 9-year-old nonverbal boy with three
   weeks of observations. A demo badge is visible on every page.
2. **Dashboard (10 s)** — Recent episodes, today's count, the
   "Start observation" action. Show it reads like a journal, not a
   medical console.
3. **Patterns (15 s)** — The demo data is shaped so the insight lands:
   episodes cluster at night and point to the ears. This is the
   "walk in with evidence" moment.
4. **Observe wizard (40 s)** — Start a new observation. Step through:
   context (baseline vs episode, when — now/minutes-ago/custom), the
   five FLACC categories with the child's personalized rFLACC
   descriptors under each choice, body zones, interventions, note.
   Mention: every radio group is a native keyboard-navigable group;
   a half-finished observation autosaves a draft that survives reload.
5. **History + edit (15 s)** — Open an existing observation from
   History, change only the note, save — original timestamps are kept.
   Show delete asks first.
6. **Report PDF (30 s)** — Settings → Report: pick the period, include
   notes and the clinician question, generate. The PDF has real
   pagination, the child's name and page numbers on every page, and
   renders Arabic/Hindi/Chinese names correctly. All on-device.
7. **Privacy (15 s)** — Settings: the privacy paragraph, JSON backup
   download, PIN lock (a screen lock — stated honestly, not
   encryption), and one-tap delete-all.

## What to say at the end

Everything you just saw ran with the network off. There is no account,
no server, no analytics — a child's pain journal never leaves the
device. The PDF is the artifact a parent hands to a doctor.
