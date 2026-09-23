import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../appContext";
import { db } from "../db";
import type { Observation } from "../types";
import { ScoreBadge } from "../components/ScoreBadge";

export default function Dashboard() {
  const { t } = useTranslation();
  const { active } = useApp();
  const nav = useNavigate();
  const [recent, setRecent] = useState<Observation[]>([]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!active?.id) return;
    void db.observations
      .where("childId").equals(active.id)
      .reverse().sortBy("recordedAt")
      .then((all) => {
        setCount(all.length);
        setRecent(all.slice(0, 3));
      });
  }, [active]);

  if (!active) return null;
  const last = recent[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{active.name}</h1>
          <p className="text-sm text-slate-400">
            {count} {t("patterns.episodes")}
          </p>
        </div>
        <Link to="/redflags" className="btn-ghost !bg-red-950/60 !text-red-300 text-sm">
          ⚠ {t("nav.redflags")}
        </Link>
      </div>

      <button
        type="button"
        onClick={() => void nav("/observe")}
        className="w-full card p-6 text-left border-teal-500/40 bg-teal-500/5 hover:bg-teal-500/10 transition"
      >
        <div className="text-3xl mb-1">✚</div>
        <div className="text-lg font-bold text-teal-300">{t("observe.start")}</div>
        <div className="text-sm text-slate-400">{t("observe.pickScore")} — 60 s</div>
      </button>

      {last ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-400">{t("history.title")}</h2>
          {recent.map((o) => (
            <div key={o.id} className="card p-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">
                  {new Date(o.startedAt).toLocaleDateString()}{" "}
                  {new Date(o.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {o.baseline && <span className="ml-2 text-xs text-emerald-400">· {t("history.baseline")}</span>}
                </div>
                <div className="text-xs text-slate-500">
                  {o.bodyZones.map((z) => t(`zones.${z}`)).join(", ") || "—"}
                </div>
              </div>
              <ScoreBadge total={o.total} />
            </div>
          ))}
          <Link to="/history" className="block text-sm text-teal-400 pt-1">
            {t("history.title")} →
          </Link>
        </section>
      ) : (
        <p className="text-slate-500 text-sm">{t("history.empty")}</p>
      )}
    </div>
  );
}
