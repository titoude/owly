import Dexie, { type EntityTable } from "dexie";
import type { Child, Observation, Settings } from "./types";

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
