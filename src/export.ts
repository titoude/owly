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

const HELPED = new Set(["yes", "no", "unsure"]);

// Free-text fields must be strings when present. A non-string value means
// the file was corrupted or hand-edited — reject rather than silently
// coerce and destroy data the user may have no other copy of.
function strField(v: unknown, what: string): string {
  if (v == null) return "";
  if (typeof v !== "string") throw new Error(`Invalid Owly backup file: ${what}`);
  return v;
}

// Epoch-ms timestamps must be representable by Date: a finite number like
// 9e18 is not, and would corrupt sorting/labels downstream.
function tsField(v: unknown, bad: () => never): void {
  if (typeof v !== "number" || !Number.isFinite(v) || Math.abs(v) > 8.64e15 || Number.isNaN(new Date(v).getTime())) {
    bad();
  }
}

function normalizeChild(c: Child, i: number): Child {
  const bad = (what: string): never => {
    throw new Error(`Invalid Owly backup file: ${what} (child #${i + 1})`);
  };
  if (!c || typeof c !== "object") bad("malformed record");
  if (typeof c.name !== "string" || c.name.trim() === "") bad("missing name");
  tsField(c.createdAt, () => bad("invalid createdAt"));
  if (c.id != null && (typeof c.id !== "number" || !Number.isInteger(c.id) || c.id <= 0)) bad("invalid id");
  if (c.birthYear != null && (typeof c.birthYear !== "number" || !Number.isFinite(c.birthYear))) bad("invalid birthYear");
  const raw: unknown = c.customDescriptors ?? {};
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) bad("customDescriptors must be an object");
  const cd = raw as Record<string, unknown>;
  return {
    ...c,
    name: c.name.trim(),
    birthYear: c.birthYear ?? null,
    conditions: strField(c.conditions, `conditions must be text (child #${i + 1})`),
    communicates: strField(c.communicates, `communicates must be text (child #${i + 1})`),
    customDescriptors: {
      face: strField(cd.face, `customDescriptors.face must be text (child #${i + 1})`),
      legs: strField(cd.legs, `customDescriptors.legs must be text (child #${i + 1})`),
      activity: strField(cd.activity, `customDescriptors.activity must be text (child #${i + 1})`),
      cry: strField(cd.cry, `customDescriptors.cry must be text (child #${i + 1})`),
      consolability: strField(cd.consolability, `customDescriptors.consolability must be text (child #${i + 1})`),
    },
  };
}

function normalizeObservation(o: Observation, i: number): Observation {
  const fail = (): never => { throw new Error(`Invalid Owly backup file: malformed observation #${i + 1}`); };
  if (!o || typeof o.childId !== "number" || !Number.isFinite(o.childId)) fail();
  tsField(o.recordedAt, fail);
  tsField(o.startedAt, fail);
  if (!o.scores || typeof o.scores !== "object") fail();
  for (const cat of FLACC_CATEGORIES) {
    const v = (o.scores as unknown as Record<string, unknown>)[cat];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 2) fail();
  }
  if (o.durationMinutes != null && (typeof o.durationMinutes !== "number" || !Number.isFinite(o.durationMinutes))) fail();
  if (o.bodyZones != null && !Array.isArray(o.bodyZones)) fail();
  if (o.interventions != null && !Array.isArray(o.interventions)) fail();
  const interventions = (o.interventions ?? []).map((it): Intervention => {
    if (!it || typeof it !== "object" || typeof it.type !== "string") fail();
    const helped = (it as Intervention).helped;
    if (helped != null && (typeof helped !== "string" || !HELPED.has(helped))) fail();
    return { type: it.type, label: strField(it.label, `intervention label must be text (observation #${i + 1})`), helped: helped ?? null };
  });
  const bodyZones = (o.bodyZones ?? []) as unknown[];
  if (bodyZones.some((z) => typeof z !== "string")) fail();
  return {
    ...o,
    // Recompute total from scores — never trust a stale or hand-edited field.
    total: totalFlacc(o.scores),
    durationMinutes: o.durationMinutes ?? null,
    bodyZones: bodyZones as string[],
    suspectedCause: strField(o.suspectedCause, `suspectedCause must be text (observation #${i + 1})`),
    interventions,
    note: strField(o.note, `note must be text (observation #${i + 1})`),
    baseline: o.baseline === true,
  };
}

function validateDump(json: string): { children: Child[]; observations: Observation[]; exportedAt: string } {
  const dump = JSON.parse(json) as Dump;
  if (!dump || typeof dump !== "object" || dump.version !== 1 ||
      !Array.isArray(dump.children) || !Array.isArray(dump.observations)) {
    throw new Error("Invalid Owly backup file");
  }
  const children = dump.children.map(normalizeChild);
  const observations = dump.observations.map(normalizeObservation);
  const ids = children.map((c) => c.id).filter((id): id is number => typeof id === "number");
  if (new Set(ids).size !== ids.length) {
    throw new Error("Invalid Owly backup file: duplicate child id");
  }
  const childIds = new Set(ids);
  if (observations.some((o) => !childIds.has(o.childId))) {
    throw new Error("Invalid Owly backup file: observation references a missing child");
  }
  return { children, observations, exportedAt: typeof dump.exportedAt === "string" ? dump.exportedAt : "" };
}

export interface BackupSummary {
  children: number;
  observations: number;
  exportedAt: string;
}

// Read-only validation + counts, for the pre-replace confirmation UI.
export function inspectBackup(json: string): BackupSummary {
  const { children, observations, exportedAt } = validateDump(json);
  return { children: children.length, observations: observations.length, exportedAt };
}

export async function importAll(json: string): Promise<void> {
  const { children, observations } = validateDump(json);
  // Fully atomic — including the active-child pointer: a failure anywhere
  // rolls the whole restore back rather than leaving a partial database.
  await db.transaction("rw", [db.children, db.observations, db.settings], async () => {
    await db.children.clear();
    await db.observations.clear();
    await db.children.bulkAdd(children);
    await db.observations.bulkAdd(observations);
    // The previous active child id may not exist in the restored set.
    await db.settings.put({ key: "activeChildId", value: children[0]?.id ?? null });
  });
}

export async function deleteAll(): Promise<void> {
  await db.transaction("rw", [db.children, db.observations, db.settings], async () => {
    await db.children.clear();
    await db.observations.clear();
    await db.settings.clear();
  });
}
