# Internationalization review notes

## What ships today

| Locale | UI strings | FLACC scale wording | Status |
|---|---|---|---|
| en | English | English (published instrument wording) | Reference locale |
| fr | French | **French — pre-existing translation, provenance/validation unverified** | See "French scale wording" below |
| es, pt, de, it, ar, hi, zh-CN | Translated | **English** (deliberate fallback) | Machine-assisted, no human/native review yet |

Every locale must cover the same base keys as `en`. Run `npm run i18n:check`
to verify parity — plural categories are validated per each locale's CLDR
plural rules (e.g. Arabic ships `zero/one/two/few/many/other`).

## FLACC scale wording — why new locales show English

FLACC is a licensed clinical instrument. The University of Michigan licensing
page describes commercial/authorized-academic terms with **officially English
wording**; translation is managed by the licensee. Until wording rights are
confirmed, Owly does **not** ship machine-translated scale text as if it were
validated clinical wording:

- `flacc.*` (score descriptors) and `band.*` (score bands) are English in
  `es/pt/de/it/ar/hi/zh-CN`.
- A note (`observe.scaleNote`) is shown above the descriptors in non-EN
  locales explaining the wording stays English pending a licensed translation.
- The scale text carries `lang="en"`/`lang="fr"` attributes so screen readers
  pronounce it in the right language, and `dir` is handled for RTL locales.

**French exception.** The `fr` locale predates this audit and already ships
French scale descriptors. That wording is *not* one of the licensed
translations we have evidence for — its provenance is unverified. It is kept
because removing it would regress existing French-speaking users, but it is
explicitly flagged here as **unvalidated clinical wording** and must be
replaced or validated by the instrument licensor before any claims are made.

## Known gaps

- No locale has been reviewed by a native speaker or clinician. Treat UI
  translations outside EN/FR as draft quality.
- PDF report chrome (`report.pdf.*`) is localized in all 9 locales, with
  per-script fonts (Noto Sans Arabic / Devanagari / SC subsets) embedded
  only when the content needs them.
- Arabic UI is RTL (`<html dir="rtl">`); visual checks of every RTL screen
  are tracked in the accessibility evidence document.
