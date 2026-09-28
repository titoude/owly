import { beforeEach, describe, expect, it, vi } from "vitest";
import { db, getSetting, setSetting } from "../db";
import { seedDemo, clearDemo } from "../demo";
import { clearAllDrafts, draftEditKey, draftKey, latestWriteGate, loadDraft, saveDraft } from "../drafts";
import { exportAll, importAll, deleteAll } from "../export";
import { hashPin } from "../pin";
import type { Observation } from "../types";

const DRAFT = {
  step: 3, baseline: false, minutesAgo: 0, customAt: null, startedAt: null,
  scores: { face: 1, legs: 1, activity: 1, cry: 1, consolability: 1 },
  duration: 10, zones: [], cause: "draft cause",
  interventions: [], note: "draft note", savedAt: 0,
};

beforeEach(async () => {
  await db.children.clear();
  await db.observations.clear();
  await db.settings.clear();
  await clearAllDrafts();
});

describe("demo seed", () => {
  it("creates Léo with observations and sets him active", async () => {
    await seedDemo();
    const kids = await db.children.toArray();
    expect(kids).toHaveLength(1);
    expect(kids[0].isDemo).toBe(true);
    expect(kids[0].customDescriptors.face).toBeTruthy();
    const obs = await db.observations.toArray();
    expect(obs.length).toBeGreaterThanOrEqual(8);
    expect(await getSetting("activeChildId")).toBe(kids[0].id);
    // both episodes and baselines exist
    expect(obs.some((o) => o.baseline)).toBe(true);
    expect(obs.some((o) => !o.baseline)).toBe(true);
    // every episode has a valid FLACC total
    for (const o of obs) {
      const sum = Object.values(o.scores).reduce((a, b) => a + b, 0);
      expect(o.total).toBe(sum);
      expect(o.total).toBeGreaterThanOrEqual(0);
      expect(o.total).toBeLessThanOrEqual(10);
    }
  });

  it("clearDemo removes only demo children", async () => {
    await seedDemo();
    const realId = await db.children.add({ name: "Real", createdAt: 0 } as never);
    await clearDemo();
    const kids = await db.children.toArray();
    expect(kids).toHaveLength(1);
    expect(kids[0].id).toBe(realId);
    expect(await db.observations.count()).toBe(0);
  });
});

describe("export/import", () => {
  it("round-trips children and observations", async () => {
    await seedDemo();
    const dump = await exportAll();
    await deleteAll();
    expect(await db.children.count()).toBe(0);
    await importAll(dump);
    expect(await db.children.count()).toBe(1);
    expect((await db.observations.toArray()).length).toBeGreaterThanOrEqual(8);
  });

  it("rejects invalid backup", async () => {
    await expect(importAll("{}")).rejects.toThrow();
    await expect(importAll('{"version":9,"children":[],"observations":[]}')).rejects.toThrow();
  });

  // exportedAt differs between exports — compare the stored rows, not the dump string.
  const dbRows = async () => ({
    children: await db.children.toArray(),
    observations: await db.observations.toArray(),
    settings: await db.settings.toArray(),
  });

  it("rejects a backup with a non-string custom descriptor and preserves existing data", async () => {
    await seedDemo();
    const before = await dbRows();
    const dump = JSON.parse(await exportAll());
    dump.children[0].customDescriptors.face = { en: "grimaces" };
    await expect(importAll(JSON.stringify(dump))).rejects.toThrow();
    expect(await dbRows()).toEqual(before);
  });

  it("rejects non-string free-text fields instead of silently dropping them", async () => {
    await seedDemo();
    const before = await dbRows();
    const base = await exportAll();
    for (const field of ["communicates", "conditions", "name"]) {
      const dump = JSON.parse(base);
      dump.children[0][field] = { text: "nested" };
      await expect(importAll(JSON.stringify(dump))).rejects.toThrow();
    }
    const dump = JSON.parse(base);
    dump.observations[0].note = 42;
    await expect(importAll(JSON.stringify(dump))).rejects.toThrow();
    expect(await dbRows()).toEqual(before);
  });

  it("points the active child at an imported profile after restore", async () => {
    await seedDemo();
    const dump = await exportAll();
    const importedId = JSON.parse(dump).children[0].id;
    await deleteAll();
    await setSetting("activeChildId", 9999); // stale id, no longer exists
    await importAll(dump);
    expect(await getSetting("activeChildId")).toBe(importedId);
  });

  it("rejects timestamps a Date cannot represent and preserves all rows", async () => {
    await seedDemo();
    const before = await dbRows();
    const base = await exportAll();
    for (const mutate of [
      (d: Record<string, never>) => { (d.observations as { startedAt: number }[])[0].startedAt = 9e18; },
      (d: Record<string, never>) => { (d.observations as { recordedAt: number }[])[0].recordedAt = 9e18; },
      (d: Record<string, never>) => { (d.children as { createdAt: number }[])[0].createdAt = -9e18; },
    ]) {
      const dump = JSON.parse(base);
      mutate(dump);
      await expect(importAll(JSON.stringify(dump))).rejects.toThrow();
    }
    expect(await dbRows()).toEqual(before);
  });

  it("rolls back the whole import if the active-child write fails", async () => {
    await seedDemo();
    const dump = await exportAll();
    await deleteAll();
    const put = vi.spyOn(db.settings, "put").mockRejectedValueOnce(new Error("disk full"));
    await expect(importAll(dump)).rejects.toThrow();
    put.mockRestore();
    // Nothing half-restored: children, observations and settings all empty.
    expect(await db.children.count()).toBe(0);
    expect(await db.observations.count()).toBe(0);
    expect(await getSetting("activeChildId")).toBeUndefined();
  });
});

describe("settings + pin", () => {
  it("stores and reads settings", async () => {
    await setSetting("activeChildId", 42);
    expect(await getSetting("activeChildId")).toBe(42);
    await setSetting("activeChildId", null);
    expect(await getSetting("activeChildId")).toBeNull();
  });

  it("hashes a pin deterministically", async () => {
    const h = await hashPin("1234");
    expect(h).toBe(await hashPin("1234"));
    expect(h).not.toBe(await hashPin("1235"));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("observation integrity", () => {
  it("stores an observation queryable by childId+recordedAt", async () => {
    const childId = await db.children.add({ name: "A", createdAt: 0 } as never);
    const obs: Observation = {
      childId: childId as number,
      startedAt: 1000,
      recordedAt: 2000,
      scores: { face: 1, legs: 1, activity: 0, cry: 2, consolability: 0 },
      total: 4,
      durationMinutes: 20,
      bodyZones: ["ears"],
      suspectedCause: "",
      interventions: [{ type: "comfort", label: "", helped: "yes" }],
      note: "n",
      baseline: false,
    };
    const id = await db.observations.add(obs);
    const got = await db.observations.get(id as number);
    expect(got?.total).toBe(4);
    const byChild = await db.observations.where("childId").equals(childId as number).toArray();
    expect(byChild).toHaveLength(1);
  });

  it("never leaks one child's observations into another profile", async () => {
    const a = (await db.children.add({ name: "A", createdAt: 0 } as never)) as number;
    const b = (await db.children.add({ name: "B", createdAt: 0 } as never)) as number;
    const mk = (childId: number): Observation => ({
      childId, startedAt: 1, recordedAt: 2,
      scores: { face: 0, legs: 0, activity: 0, cry: 0, consolability: 0 },
      total: 0, durationMinutes: null, bodyZones: [], suspectedCause: "",
      interventions: [], note: "", baseline: false,
    });
    await db.observations.bulkAdd([mk(a), mk(a), mk(b)]);
    expect(await db.observations.where("childId").equals(a).count()).toBe(2);
    expect(await db.observations.where("childId").equals(b).count()).toBe(1);
  });
});

describe("drafts", () => {
  it("a confirmed replace import wipes all drafts, even on colliding child ids", async () => {
    await seedDemo();
    const dump = await exportAll();
    const demoId = JSON.parse(dump).children[0].id as number;
    // Drafts keyed to the ids the restore will REUSE.
    await saveDraft(draftKey(demoId), DRAFT);
    await saveDraft(draftEditKey(1), DRAFT);
    await importAll(dump);
    expect(await loadDraft(draftKey(demoId))).toBeNull();
    expect(await loadDraft(draftEditKey(1))).toBeNull();
  });

  it("draft wipe is inside the import transaction — a settings failure rolls back everything", async () => {
    await seedDemo();
    const dump = await exportAll();
    const demoId = JSON.parse(dump).children[0].id as number;
    await saveDraft(draftKey(demoId), DRAFT);
    // Make the draft deletion fail mid-transaction: nothing may commit.
    const spy = vi.spyOn(db.settings, "where").mockImplementationOnce(() => {
      throw new DOMException("The operation is insecure", "SecurityError");
    });
    await expect(importAll(dump)).rejects.toThrow();
    spy.mockRestore();
    // Original data AND the draft both survive.
    expect(await db.children.count()).toBe(1);
    expect((await loadDraft(draftKey(demoId)))?.note).toBe("draft note");
  });

  it("a rejected import preserves drafts", async () => {
    await seedDemo();
    const k = draftKey(1);
    await saveDraft(k, DRAFT);
    await expect(importAll("{}")).rejects.toThrow();
    const d = await loadDraft(k);
    expect(d?.note).toBe("draft note");
  });

  it("deleteAll wipes drafts along with the database", async () => {
    await seedDemo();
    await saveDraft(draftKey(1), DRAFT);
    await deleteAll();
    expect(await loadDraft(draftKey(1))).toBeNull();
  });

  it("clearDemo removes drafts of the demo child (and its edit drafts)", async () => {
    await seedDemo();
    const demoId = (await db.children.toArray())[0].id!;
    const obsId = (await db.observations.toArray())[0].id!;
    const other = (await db.children.add({ name: "Real", createdAt: 0 } as never)) as number;
    await saveDraft(draftKey(demoId), DRAFT);
    await saveDraft(draftEditKey(obsId), DRAFT);
    await saveDraft(draftKey(other), { ...DRAFT, note: "keep me" });
    await clearDemo();
    expect(await loadDraft(draftKey(demoId))).toBeNull();
    expect(await loadDraft(draftEditKey(obsId))).toBeNull();
    expect((await loadDraft(draftKey(other)))?.note).toBe("keep me");
  });

  it("saveDraft propagates storage failures instead of swallowing them", async () => {
    const spy = vi.spyOn(db.settings, "put").mockRejectedValueOnce(
      new DOMException("Quota exceeded", "QuotaExceededError"),
    );
    await expect(saveDraft(draftKey(1), DRAFT)).rejects.toThrow();
    spy.mockRestore();
    expect(await loadDraft(draftKey(1))).toBeNull();
  });

  it("loadDraft returns null when storage is denied, not a throw", async () => {
    const spy = vi.spyOn(db.settings, "get").mockRejectedValueOnce(
      new DOMException("denied", "SecurityError"),
    );
    expect(await loadDraft(draftKey(1))).toBeNull();
    spy.mockRestore();
  });
});

describe("latestWriteGate", () => {
  it("a delayed older write cannot mark current fields saved", async () => {
    // Simulates the wizard autosave: write A starts, fields change, write B
    // starts — A resolving late must not flip the indicator.
    const gate = latestWriteGate();
    const a = gate.begin();
    const b = gate.begin();
    expect(gate.isCurrent(a)).toBe(false);
    expect(gate.isCurrent(b)).toBe(true);
  });

  it("latest resolution wins; latest rejection reports failure", async () => {
    const gate = latestWriteGate();
    const state = { saved: false, failed: false };
    const apply = (ticket: number, ok: boolean) => {
      if (!gate.isCurrent(ticket)) return;
      if (ok) { state.saved = true; state.failed = false; }
      else { state.saved = false; state.failed = true; }
    };
    const slow = gate.begin();
    const fast = gate.begin();
    // slow write resolves AFTER fast one started — stale, ignored
    apply(slow, true);
    expect(state.saved).toBe(false);
    // fast write rejects — the current outcome is failure, not saved
    apply(fast, false);
    expect(state.failed).toBe(true);
    // and a subsequent fresh write that succeeds restores saved
    const third = gate.begin();
    apply(third, true);
    expect(state.saved).toBe(true);
    expect(state.failed).toBe(false);
  });
});
