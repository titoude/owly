# Accessibility statement

Owly is designed for caregivers who are often exhausted, one-handed,
and working at arm's length in the dark. Accessibility is a core
requirement, not a compliance exercise.

## Status

**Automated checks**: 0 violations across the full route/state manifest
(`scripts/a11y/audit.mjs`, axe-core with WCAG 2.0/2.1/2.2 A+AA and
best-practice tags, 43 scenarios including seven screens in night mode —
see `docs/accessibility-evidence.md` for the audited scope and the limits
of what was verified).

**Alternatives and preferences**: the doctor report exists as a PDF *and*
as a semantic web page (headings, captioned data table, print); the pain
passport is plain HTML that prints on one page; night mode is a full
dark palette, re-audited for contrast, chosen in Settings or following
the device.

**Manual checks**: full keyboard traversal of the observation wizard is
e2e-tested (`e2e/keyboard.mjs` — roving radio groups, wraparound, skip link, dialog focus, tab
order); no page overflows horizontally from 320 px to 1440 px in English,
German and Arabic (`e2e/overflow-check.mjs`); focus is moved to each
wizard step heading on transition.

**Not yet verified**: a real screen-reader pass (NVDA/VoiceOver/
TalkBack), reduced-motion and 200–400 % zoom journeys, and tagged-PDF
accessibility of the generated PDF (the on-screen report is the
accessible equivalent). These are called out in
`docs/accessibility-evidence.md` — we do not claim them.

## Feedback

If Owly fails for you — a control you can't reach, a label that's
wrong in your language, a flow that's too many taps — please open an
issue. For this population, that is a bug, not a feature request.
