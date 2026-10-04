import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { db, getSetting, setSetting, saneChild } from "./db";
import type { Child } from "./types";

interface AppState {
  children: Child[];
  active: Child | null;
  loading: boolean;
  // Database open/read failure — the UI shows a recovery state, never a
  // permanent spinner or a fake-empty journal.
  error: boolean;
  refresh: () => Promise<void>;
  setActive: (id: number) => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const s = useContext(Ctx);
  if (!s) throw new Error("useApp outside provider");
  return s;
}

export function AppProvider({ children: kids }: { children: ReactNode }) {
  const [children, setChildren] = useState<Child[]>([]);
  const [active, setActiveChild] = useState<Child | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  async function refresh() {
    try {
      const all = (await db.children.orderBy("createdAt").toArray()).map(saneChild);
      const activeId = await getSetting<number>("activeChildId");
      setChildren(all);
      setActiveChild(all.find((c) => c.id === activeId) ?? all[0] ?? null);
      setError(false);
    } catch {
      // IndexedDB unavailable/corrupt — surface it, don't pretend empty.
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  async function setActive(id: number) {
    await setSetting("activeChildId", id);
    await refresh();
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <Ctx.Provider value={{ children, active, loading, error, refresh, setActive }}>
      {kids}
    </Ctx.Provider>
  );
}
