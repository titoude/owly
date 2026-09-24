import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../appContext";
import { db } from "../db";
import type { Observation } from "../types";
import { ScoreBadge } from "../components/ScoreBadge";

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const loc = i18n.language === "fr" ? "fr-FR" : "en-GB";
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
        setCount(all.filter((o) => !o.baseline).length);
        setRecent(all.slice(0, 3));
      });
  }, [active]);

  if (!active) return null;
  const last = recent[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold break-words">{active.name}</h1>
          <p className="text-sm text-neutral-600">
            {count} {t("patterns.episodes")}
          </p>
        </div>
        <Link to="/redflags" className="btn-ghost !bg-red-50 !text-red-700 !border !border-red-200 text-sm">
          ⚠ {t("nav.redflags")}
        </Link>
      </div>

      <button
        type="button"
        onClick={() => void nav("/observe")}
        className="group w-full card p-6 text-left !border-teal-200 !bg-teal-50 hover:!bg-teal-100/70 hover:!border-teal-300 active:scale-[0.99] transition-all duration-150"
      >
        <div className="flex items-center gap-4">
          <span className="grid place-items-center size-12 rounded-2xl bg-teal-700 text-white shadow-[0_8px_20px_-6px_rgba(45,212,191,0.5)] transition-transform duration-150 group-active:scale-95">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="8.5" />
              <path d="M12 8v8M8 12h8" />
            </svg>
          </span>
          <span>
            <span className="block text-lg font-bold text-teal-800 tracking-tight">{t("observe.start")}</span>
            <span className="block text-sm text-neutral-600">{t("observe.pickScore")} — 60 s</span>
          </span>
        </div>
      </button>

      {last ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-neutral-600">{t("history.title")}</h2>
          {recent.map((o) => (
            <div key={o.id} className="card p-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">
                  {new Date(o.startedAt).toLocaleDateString(loc)}{" "}
                  {new Date(o.startedAt).toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" })}
                  {o.baseline && <span className="ml-2 text-xs text-emerald-700">· {t("history.baseline")}</span>}
                </div>
                <div className="text-xs text-neutral-600">
                  {o.bodyZones.map((z) => t(`zones.${z}`)).join(", ") || "—"}
                </div>
              </div>
              <ScoreBadge total={o.total} />
            </div>
          ))}
          <Link to="/history" className="block text-sm text-teal-700 pt-1">
            {t("history.title")} →
          </Link>
        </section>
      ) : (
        <p className="text-neutral-600 text-sm">{t("history.empty")}</p>
      )}
    </div>
  );
}
