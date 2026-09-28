// Observation-wizard drafts, kept in localStorage (UI state, not journal
// data — exports remain the durable record).
//
// Invariants the flows depend on:
// - a confirmed replacement import wipes ALL drafts: restored children may
//   reuse the same numeric ids, so a per-child clear would silently revive
//   stale content under a familiar id;
// - a cancelled or rejected import preserves drafts untouched;
// - deleting a child / clearing demo data / wiping everything removes the
//   matching drafts.

const PREFIX = "owly-draft-";

export interface ObsDraft {
  step: number;
  baseline: boolean;
  minutesAgo: number;
  customAt: string | null;
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

export function loadDraft(key: string): ObsDraft | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw) as ObsDraft;
    if (!d || typeof d !== "object" || !d.scores || typeof d.step !== "number") return null;
    return d;
  } catch {
    return null;
  }
}

export function saveDraft(key: string, draft: ObsDraft): void {
  try {
    localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Storage full/blocked — drafts are best-effort; never break the wizard.
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch { /* ignore */ }
}

export function clearAllDrafts(): void {
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(PREFIX)) localStorage.removeItem(k);
    }
  } catch { /* ignore */ }
}

// Removing a child drops its new-observation draft and every edit draft
// tied to its observations.
export function clearChildDrafts(childId: number, obsIds: number[]): void {
  clearDraft(draftKey(childId));
  for (const id of obsIds) clearDraft(draftEditKey(id));
}
