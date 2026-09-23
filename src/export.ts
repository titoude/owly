import { db } from "./db";
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
  await db.children.clear();
  await db.observations.clear();
  await db.children.bulkAdd(dump.children);
  await db.observations.bulkAdd(dump.observations);
}

export async function deleteAll(): Promise<void> {
  await db.children.clear();
  await db.observations.clear();
  await db.settings.clear();
}
