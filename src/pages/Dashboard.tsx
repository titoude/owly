import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../appContext";
import { db } from "../db";
import type { Observation } from "../types";
import { ScoreBadge } from "../components/ScoreBadge";
import { intlLocale } from "../i18n";

export default function Dashboard() {
  const { t } = useTranslation();
  const loc = intlLocale();
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

  return (
    <div className="space-y-7">
      {/* Full-width page header — child identity and context first. */}
      <header className="flex items-start justify-between gap-3 border-b border-neutral-200 pb-5">
        <div className="min-w-0">
          <h1 className="page-title break-words" dir="auto">{active.name}</h1>
          <p className="mt-1 text-sm text-neutral-600">
            {count} {t("patterns.episodes")}
          </p>
        </div>
        <Link to="/redflags" className="btn-ghost !bg-red-50 !text-red-700 !border !border-red-200 text-sm shrink-0 md:hidden">
          ⚠ {t("nav.redflags")}
        </Link>
      </header>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:gap-10 space-y-7 lg:space-y-0">
        <div className="min-w-0 space-y-7">
          <button
            type="button"
            onClick={() => void nav("/observe")}
            className="btn-primary group w-full p-5 text-left flex items-center gap-4"
          >
            <span className="grid place-items-center size-12 shrink-0 rounded-xl bg-teal-600/80 text-white transition-transform duration-150 group-active:scale-95">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="8.5" />
                <path d="M12 8v8M8 12h8" />
              </svg>
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-bold tracking-tight">{t("observe.start")}</span>
              <span className="block text-sm text-teal-100">{t("observe.pickScore")}</span>
            </span>
            <span aria-hidden className="ml-auto text-xl leading-none text-teal-200">→</span>
          </button>

          {recentSection()}
        </div>

        <aside className="space-y-4">
          <Link
            to="/report"
            className="card p-4 flex items-center justify-between gap-3 min-h-12 hover:bg-teal-50/60 transition-colors"
          >
            <span>
              <span className="block text-[15px] font-semibold text-teal-800">{t("report.entryTitle")}</span>
              <span className="mt-0.5 block text-sm text-neutral-600">{t("report.entryDesc")}</span>
            </span>
            <span aria-hidden className="text-teal-700">→</span>
          </Link>
          {count > 0 && (
            <Link
              to="/patterns"
              className="card p-4 flex items-center justify-between gap-3 min-h-12 hover:bg-teal-50/60 transition-colors"
            >
              <span>
                <span className="block text-[15px] font-semibold text-teal-800">{t("patterns.title")}</span>
                <span className="mt-0.5 block text-sm text-neutral-600">{t("patterns.entryDesc")}</span>
              </span>
              <span aria-hidden className="text-teal-700">→</span>
            </Link>
          )}
        </aside>
      </div>
    </div>
  );

  function recentSection() {
    if (!recent[0]) {
      return <p className="text-sm text-neutral-600">{t("history.empty")}</p>;
    }
    return (
      <section aria-labelledby="recent-obs">
        <div className="flex items-baseline justify-between gap-3 border-b border-neutral-200 pb-2">
          <h2 id="recent-obs" className="section-title">{t("dashboard.recent")}</h2>
          <Link to="/history" className="text-sm font-medium text-teal-700 hover:text-teal-800 shrink-0">
            {t("common.viewAll")} →
          </Link>
        </div>
        <div className="divide-y divide-neutral-200">
          {recent.map((o) => (
            <Link key={o.id} to="/history" className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3.5 min-h-14 transition-colors hover:bg-white/60">
              <div className="min-w-0">
                <div className="text-[15px] font-medium">
                  {new Date(o.startedAt).toLocaleDateString(loc)}{" "}
                  {new Date(o.startedAt).toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" })}
                  {o.baseline && <span className="ml-2 text-[13px] text-emerald-700">· {t("history.baseline")}</span>}
                </div>
                <div className="text-[13px] text-neutral-600 truncate">
                  {o.bodyZones.map((z) => t(`zones.${z}`)).join(", ") || "—"}
                </div>
              </div>
              <ScoreBadge total={o.total} />
            </Link>
          ))}
        </div>
      </section>
    );
  }
}
