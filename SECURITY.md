# Security policy

## Scope

Owly is an offline-first, local-only application: all data lives in
IndexedDB on the user's device, no account, no server, no telemetry.
There is no backend receiving journal records. The meaningful security surfaces are the device and browser profile, the static hosting origin and its update channel, third-party dependencies, exported files, the JSON import path, and the service worker.

## Reporting a vulnerability

Open a private security advisory on GitHub (Security → Report a
vulnerability) rather than a public issue. If that is unavailable, open
an issue describing the impact without including a proof-of-concept that
exfiltrates data.

Please include: affected version/commit, reproduction steps, and what
data or flow is at risk.

## Scope and limitations

The absence of a journal API does **not** eliminate risks from a compromised static host, malicious browser extensions, lost devices, unsafe backup sharing, or vulnerabilities in dependencies. Use an HTTPS origin and a trusted device. There is no guaranteed recovery if local browser storage is cleared without a backup.

## Threat model

- **PIN lock** is a screen lock, not encryption — it deters casual
  snooping; it does not protect against device forensics. Browser-level
  storage is not encrypted at rest by the app.
- **Import path**: `importAll` validates structure before writing and
  commits inside one IndexedDB transaction — a malformed file cannot
  partially destroy data. Files are parsed locally; nothing is uploaded.
- **Service worker** precaches only first-party assets from the same
  origin; there are no runtime third-party fetches.
- **PDF fonts** are vendored, not fetched from a CDN.
