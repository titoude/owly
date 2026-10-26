# Demo script (≈4 minutes)

Goal: show that a caregiver can go from a fresh install to a report a
pediatrician can read, entirely on-device.

## Setup

Serve the production build (`npm run preview`) and open it on a phone
viewport (~390 px) — Owly is designed for one-handed use. The first load
must be online so assets precache; after that, airplane mode works —
the point is that no network is needed once installed.

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
6. **Report PDF (30 s)** — Home or Patterns → "Prepare the report":
   pick the period, include notes and the clinician question, generate.
   The PDF has real pagination, the child's name and page numbers on
   every page, and renders Arabic/Hindi/Chinese names correctly. All
   on-device.
7. **Accessible report (15 s)** — Back on the Report page, "Read the
   report on screen": the same content and numbers as the PDF, as a web
   page with headings and a captioned table — the route for a clinician
   or parent who uses a screen reader or zoom. "Print or save as PDF"
   prints it on one page.
8. **Pain passport (30 s)** — Home → "Pain passport". This is the page
   for everyone who isn't the doctor: school, respite care, grandparents,
   the ER. How Léo shows pain (his own signs), what has helped (a quiet
   dark room 3/3, his weighted blanket 2/3), what to do, when to call
   emergency services. Print it: one A4 page, with blank contact lines
   that exist only on paper. It never lists medication — dosing stays
   between the family and the doctor.
9. **Night mode (10 s)** — Settings → Appearance → Night. Episodes happen
   at night; the screen shouldn't light up the room. Automatic follows
   the phone.
10. **Privacy (15 s)** — Settings: the privacy paragraph, JSON backup
   download, PIN lock (a screen lock — stated honestly, not
   encryption), and one-tap delete-all.

## What to say at the end

Everything you just saw ran with the network off. There is no account,
no server, no analytics — a child's pain journal never leaves the
device. The PDF is what a parent hands to a doctor; the pain passport
is what they hand to everyone else.
