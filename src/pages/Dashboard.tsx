import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useApp } from "../appContext";
import { db } from "../db";
import type { Observation } from "../types";
import { ObsRow } from "../components/ObsRow";
import { IconReport, IconPatterns, IconChevronRight } from "../components/icons";

export default function Dashboard() {
  const { t } = useTranslation();
  const { active } = useApp();
  const [recent, setRecent] = useState<Observation[]>([]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!active?.id) return;
    void db.observations
      .where("childId").equals(active.id)
      .reverse().sortBy("recordedAt")
      .then((all) => {
        setCount(all.filter((o) => !o.baseline).length);
        setRecent(all.slice(0, 5));
      });
  }, [active]);

  if (!active) return null;

  const toolRows = [
    { to: "/report", Icon: IconReport, title: t("report.entryTitle"), desc: t("report.entryDesc") },
    ...(count > 0 ? [{ to: "/patterns", Icon: IconPatterns, title: t("patterns.title"), desc: t("patterns.entryDesc") }] : []),
  ];

  return (
    <div className="space-y-8">
      {/* Page header — journal title with child context, one primary action. */}
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-neutral-200 pb-5">
        <div className="min-w-0">
          <h1 className="page-title">{t("dashboard.journal")}</h1>
          <p className="mt-1 text-[15px] text-neutral-600">
            <span dir="auto" className="font-medium text-neutral-800">{active.name}</span>
            {" · "}{count} {t("patterns.episodes")}
          </p>
        </div>
        <Link to="/observe" className="btn-primary">
          {t("observe.start")}
        </Link>
      </header>

      {/* Journal + tools side by side on desktop, stacked on mobile. */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-x-12 space-y-8 lg:space-y-0">
        <section aria-labelledby="recent-obs">
          <div className="flex items-baseline justify-between gap-3 border-b border-neutral-200 pb-2">
            <h2 id="recent-obs" className="section-title">{t("dashboard.recent")}</h2>
            {count > 0 && (
              <Link to="/history" className="shrink-0 text-sm font-medium text-accent-700 hover:text-accent-800">
                {t("common.viewAll")}
              </Link>
            )}
          </div>
          {recent[0] ? (
            <div className="divide-y divide-neutral-100">
              {recent.map((o) => <ObsRow key={o.id} o={o} to={`/history?focus=${o.id}`} />)}
            </div>
          ) : (
            <p className="pt-4 text-[15px] text-neutral-600">{t("history.empty")}</p>
          )}
        </section>

        {/* Report and patterns are product tools — an adjacent rail, in view. */}
        <section aria-labelledby="tools" className="lg:pt-0">
          <h2 id="tools" className="section-title border-b border-neutral-200 pb-2">{t("dashboard.tools")}</h2>
          <div className="mt-3 divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
            {toolRows.map(({ to, Icon, title, desc }) => (
              <Link
                key={to}
                to={to}
                className="flex min-h-14 items-center gap-3.5 px-4 py-3 transition-colors hover:bg-neutral-50"
              >
                <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-600">
                  <Icon size={19} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium">{title}</span>
                  <span className="block truncate text-[13px] text-neutral-600">{desc}</span>
                </span>
                <span aria-hidden className="text-neutral-500 rtl:-scale-x-100"><IconChevronRight /></span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
