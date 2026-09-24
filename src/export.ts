import { db } from "./db";
import { totalFlacc } from "./flacc";
import type { Child, Observation } from "./types";

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

export async function importAll(json: string): Promise<void> {
  const dump = JSON.parse(json) as Dump;
  if (dump.version !== 1 || !Array.isArray(dump.children) || !Array.isArray(dump.observations)) {
    throw new Error("Invalid Owly backup file");
  }
  for (const c of dump.children) {
    if (typeof c.name !== "string" || typeof c.createdAt !== "number") {
      throw new Error("Invalid Owly backup file: malformed child record");
    }
  }
  const observations = dump.observations.map((o) => {
    if (typeof o.childId !== "number" || typeof o.recordedAt !== "number" || !o.scores) {
      throw new Error("Invalid Owly backup file: malformed observation");
    }
    // Recompute total from scores — never trust a stale or hand-edited field.
    return { ...o, total: totalFlacc(o.scores) };
  });
  // Atomic: never leave the user with a half-restored database.
  await db.transaction("rw", [db.children, db.observations], async () => {
    await db.children.clear();
    await db.observations.clear();
    await db.children.bulkAdd(dump.children);
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
