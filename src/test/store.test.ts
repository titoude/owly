import { beforeEach, describe, expect, it } from "vitest";
import { db, getSetting, setSetting } from "../db";
import { seedDemo, clearDemo } from "../demo";
import { exportAll, importAll, deleteAll } from "../export";
import { hashPin } from "../pin";
import type { Observation } from "../types";

beforeEach(async () => {
  await db.children.clear();
  await db.observations.clear();
  await db.settings.clear();
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
});
