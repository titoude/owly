import { db } from "./db";
import { totalFlacc } from "./flacc";
import { FLACC_CATEGORIES, type Child, type Intervention, type Observation } from "./types";

interface Dump {
  version: 1;
  exportedAt: string;
  children: Child[];
  observations: Observation[];
}

export async function exportAll(): Promise<string> {
  const dump: Dump = {
    version: 1,
    exportedAt: new Date().toISOString(),
    children: await db.children.toArray(),
    observations: await db.observations.toArray(),
  };
  return JSON.stringify(dump, null, 2);
}

function normalizeChild(c: Child, i: number): Child {
  if (!c || typeof c.name !== "string" || c.name.trim() === "" || typeof c.createdAt !== "number" || !Number.isFinite(c.createdAt)) {
    throw new Error(`Invalid Owly backup file: malformed child record #${i + 1}`);
  }
  const cd = (c.customDescriptors ?? {}) as Partial<Child["customDescriptors"]>;
  return {
    ...c,
    birthYear: typeof c.birthYear === "number" && Number.isFinite(c.birthYear) ? c.birthYear : null,
    conditions: typeof c.conditions === "string" ? c.conditions : "",
    communicates: typeof c.communicates === "string" ? c.communicates : "",
    customDescriptors: {
      face: cd.face ?? "", legs: cd.legs ?? "", activity: cd.activity ?? "",
      cry: cd.cry ?? "", consolability: cd.consolability ?? "",
    },
  };
}

function normalizeObservation(o: Observation, i: number): Observation {
  const fail = (): never => { throw new Error(`Invalid Owly backup file: malformed observation #${i + 1}`); };
  if (!o || typeof o.childId !== "number" || !Number.isFinite(o.childId)) fail();
  if (typeof o.recordedAt !== "number" || !Number.isFinite(o.recordedAt)) fail();
  if (typeof o.startedAt !== "number" || !Number.isFinite(o.startedAt)) fail();
  if (!o.scores || typeof o.scores !== "object") fail();
  for (const cat of FLACC_CATEGORIES) {
    const v = (o.scores as unknown as Record<string, unknown>)[cat];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 2) fail();
  }
  const interventions = Array.isArray(o.interventions) ? o.interventions : [];
  for (const it of interventions) {
    if (!it || typeof it.type !== "string") fail();
    (it as Intervention).label = typeof it.label === "string" ? it.label : "";
    (it as Intervention).helped = it.helped === "yes" || it.helped === "no" || it.helped === "unsure" ? it.helped : null;
  }
  return {
    ...o,
    // Recompute total from scores — never trust a stale or hand-edited field.
    total: totalFlacc(o.scores),
    durationMinutes: typeof o.durationMinutes === "number" && Number.isFinite(o.durationMinutes) ? o.durationMinutes : null,
    bodyZones: Array.isArray(o.bodyZones) ? o.bodyZones.filter((z) => typeof z === "string") : [],
    suspectedCause: typeof o.suspectedCause === "string" ? o.suspectedCause : "",
    interventions,
    note: typeof o.note === "string" ? o.note : "",
    baseline: o.baseline === true,
  };
}

export async function importAll(json: string): Promise<void> {
  const dump = JSON.parse(json) as Dump;
  if (dump.version !== 1 || !Array.isArray(dump.children) || !Array.isArray(dump.observations)) {
    throw new Error("Invalid Owly backup file");
  }
  const children = dump.children.map(normalizeChild);
  const observations = dump.observations.map(normalizeObservation);
  const childIds = new Set(children.map((c) => c.id));
  if (observations.some((o) => !childIds.has(o.childId))) {
    throw new Error("Invalid Owly backup file: observation references a missing child");
  }
  // Atomic: never leave the user with a half-restored database.
  await db.transaction("rw", [db.children, db.observations], async () => {
    await db.children.clear();
    await db.observations.clear();
    await db.children.bulkAdd(children);
    await db.observations.bulkAdd(observations);
  });
}

export async function deleteAll(): Promise<void> {
  await db.transaction("rw", [db.children, db.observations, db.settings], async () => {
    await db.children.clear();
    await db.observations.clear();
    await db.settings.clear();
  });
}
