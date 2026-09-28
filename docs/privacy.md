# Privacy

Owly's privacy model is architectural, not policy-based: there is no
server, no account, no analytics, no telemetry, and no third-party
network calls at runtime. You can verify this in browser dev tools —
the Network tab stays empty after assets are precached.

## What is stored, and where

| Data | Location | Leaves the device? |
|---|---|---|
| Children, observations, drafts, settings | IndexedDB (`owly` database) | Never |
| UI language | `localStorage` (`owly-lang`) | Never |
| Exported backups / PDF reports | Downloaded files you keep or share | Only if you share them |

## Honest limits

- **No encryption at rest.** IndexedDB content is protected only by
  your device's own security (OS user account, device encryption).
  The optional PIN is a screen lock, not encryption — anyone with
  developer tools or filesystem access can read the database.
- **Backups are plaintext JSON.** Anyone you send a backup to can read
  it. Treat exports like medical records.
- **PDF reports contain everything you choose to include** — child
  name, scores, notes. They are generated on-device; once downloaded,
  sharing is your decision.
- **Uninstalling or clearing site data deletes everything.** There is
  no cloud copy to restore from — keep backups.

## Deletion

Settings → *Delete all data* removes every child, observation, draft
and setting in a single transaction. Demo data removal is equally
complete.
