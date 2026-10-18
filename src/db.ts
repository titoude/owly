import Dexie, { type EntityTable } from "dexie";
import type { Child, CustomDescriptors, FlaccScores, Intervention, Observation, Settings } from "./types";

export const db = new Dexie("owly") as Dexie & {
  children: EntityTable<Child, "id">;
  observations: EntityTable<Observation, "id">;
  settings: EntityTable<Settings, "key">;
};

db.version(1).stores({
  children: "++id, name, createdAt",
  observations: "++id, childId, recordedAt, [childId+recordedAt]",
  settings: "key",
});

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const row = await db.settings.get(key);
  return row?.value as T | undefined;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}

// Read-boundary shape guards. A malformed row (older app version, sync
// bug, browser extension, hand-edit) must degrade to safe defaults —
// never crash the render tree or print literal garbage.
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown, dflt: number): number => (typeof v === "number" && Number.isFinite(v) ? v : dflt);

export function saneObs(o: Observation): Observation {
  const s: Partial<FlaccScores> = o.scores && typeof o.scores === "object" && !Array.isArray(o.scores) ? o.scores : {};
  return {
    ...o,
    childId: num(o.childId, 0),
    startedAt: num(o.startedAt, 0),
    recordedAt: num(o.recordedAt, 0),
    scores: {
      face: num(s.face, 0), legs: num(s.legs, 0), activity: num(s.activity, 0),
      cry: num(s.cry, 0), consolability: num(s.consolability, 0),
    },
    total: num(o.total, 0),
    durationMinutes: o.durationMinutes === null || typeof o.durationMinutes === "number" ? o.durationMinutes : null,
    bodyZones: Array.isArray(o.bodyZones) ? o.bodyZones.filter((z) => typeof z === "string") : [],
    suspectedCause: str(o.suspectedCause),
    interventions: Array.isArray(o.interventions)
      ? o.interventions.filter((i): i is Intervention => !!i && typeof i === "object" && typeof i.type === "string")
      : [],
    note: str(o.note),
    baseline: o.baseline === true,
  };
}

export function saneChild(c: Child): Child {
  const d: Partial<CustomDescriptors> = c.customDescriptors && typeof c.customDescriptors === "object" && !Array.isArray(c.customDescriptors)
    ? c.customDescriptors : {};
  return {
    ...c,
    name: str(c.name),
    birthYear: typeof c.birthYear === "number" || c.birthYear === null ? c.birthYear : null,
    conditions: str(c.conditions),
    communicates: str(c.communicates),
    customDescriptors: {
      face: str(d.face), legs: str(d.legs), activity: str(d.activity),
      cry: str(d.cry), consolability: str(d.consolability),
    },
    createdAt: num(c.createdAt, 0),
  };
}
