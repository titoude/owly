// Observation-wizard drafts, stored as rows in the Dexie settings table
// (UI state, not journal data — exports remain the durable record).
//
// Drafts live in IndexedDB on purpose: deleting them must be atomic with
// the data changes that invalidate them. localStorage cannot join a Dexie
// transaction, so a draft cleared "after import succeeds" could survive a
// crash between the two — or be lost while the import half-failed.
//
// Invariants the flows depend on:
// - a confirmed replacement import wipes ALL drafts inside the same
//   transaction: restored children may reuse the same numeric ids, so a
//   surviving draft would resurrect stale content under a familiar id;
// - a cancelled or rejected import preserves drafts untouched;
// - deleting a child / clearing demo data / wiping everything removes the
//   matching drafts inside that same transaction;
// - a draft remembers the absolute instant the user picked for "when did
//   it happen" — resuming hours later must not shift the episode.

import { db } from "./db";

const PREFIX = "owly-draft-";

export interface ObsDraft {
  step: number;
  baseline: boolean;
  minutesAgo: number;
  customAt: string | null;
  // Absolute epoch-ms instant the user selected (pinned at selection time).
  startedAt: number | null;
  scores: { face: number; legs: number; activity: number; cry: number; consolability: number };
  duration: number | null;
  zones: string[];
  cause: string;
  interventions: { type: string; label: string; helped: "yes" | "no" | "unsure" | null }[];
  note: string;
  savedAt: number;
}

export function draftKey(childId: number): string {
  return `${PREFIX}${childId}`;
}

export function draftEditKey(obsId: number): string {
  return `${PREFIX}edit-${obsId}`;
}

export async function loadDraft(key: string): Promise<ObsDraft | null> {
  try {
    const row = await db.settings.get(key);
    const d = row?.value as ObsDraft | undefined;
    if (!d || typeof d !== "object" || !d.scores || typeof d.step !== "number") return null;
    return d;
  } catch {
    return null;
  }
}

// Throws on failure — callers surface it to the user (a lost draft is data
// loss, never a silent best-effort event).
export async function saveDraft(key: string, draft: ObsDraft): Promise<void> {
  await db.settings.put({ key, value: draft });
}

export async function clearDraft(key: string): Promise<void> {
  await db.settings.delete(key);
}

export async function clearAllDrafts(): Promise<void> {
  await db.settings.where("key").startsWith(PREFIX).delete();
}

// Removing a child drops its new-observation draft and every edit draft
// tied to its observations.
export async function clearChildDrafts(childId: number, obsIds: number[]): Promise<void> {
  await db.settings.bulkDelete([draftKey(childId), ...obsIds.map(draftEditKey)]);
}

// Autosaves overlap in real life (IndexedDB writes can be slow or quota-
// denied). Each new write gets a newer ticket, so a delayed resolution —
// or a rejection — of an older write can never mark current fields saved
// or failed. Latest write wins.
export function latestWriteGate() {
  let seq = 0;
  return {
    begin: () => ++seq,
    isCurrent: (ticket: number) => ticket === seq,
  };
}
