# Accessibility statement

Owly is designed for caregivers who are often exhausted, one-handed,
and working at arm's length in the dark. Accessibility is a core
requirement, not a compliance exercise.

## Status

**Automated checks**: 0 violations across the full route/state manifest
(`scripts/a11y/audit.mjs`, axe-core with WCAG 2.0/2.1/2.2 A+AA and
best-practice tags, 32 scenarios — see `docs/accessibility-evidence.md`
for the audited scope and the honest limits of what was verified).

**Manual checks**: full keyboard traversal of the observation wizard is
e2e-tested (`e2e/keyboard.mjs` — roving radio groups, wraparound, skip link, dialog focus, tab
order); nav labels are verified unclipped at 320 px in all 9 locales;
focus is moved to each wizard step heading on transition.

**Not yet verified**: a real screen-reader pass (NVDA/VoiceOver/
TalkBack), reduced-motion and 200–400 % zoom journeys, and tagged-PDF
accessibility of the generated report. These are called out in
`docs/accessibility-evidence.md` — we do not claim them.

## Feedback

If Owly fails for you — a control you can't reach, a label that's
wrong in your language, a flow that's too many taps — please open an
issue. For this population, that is a bug, not a feature request.
