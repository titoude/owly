import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { db, getSetting, setSetting } from "./db";
import type { Child } from "./types";

interface AppState {
  children: Child[];
  active: Child | null;
  loading: boolean;
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

  async function refresh() {
    const all = await db.children.orderBy("createdAt").toArray();
    setChildren(all);
    const activeId = await getSetting<number>("activeChildId");
    const found = all.find((c) => c.id === activeId) ?? all[0] ?? null;
    setActiveChild(found);
    setLoading(false);
  }

  async function setActive(id: number) {
    await setSetting("activeChildId", id);
    await refresh();
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <Ctx.Provider value={{ children, active, loading, refresh, setActive }}>
      {kids}
    </Ctx.Provider>
  );
}
