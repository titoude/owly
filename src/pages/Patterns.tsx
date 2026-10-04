import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useApp } from "../appContext";
import { db, saneObs } from "../db";
import { BAND_COLOR } from "../flacc";
import { bandFor, type Observation } from "../types";
import { intlLocale } from "../i18n";
import { IconChevronRight } from "../components/icons";

function bucket(hour: number): "night" | "morning" | "afternoon" | "evening" {
  if (hour >= 22 || hour < 6) return "night";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

export default function Patterns() {
  const { t } = useTranslation();
  const { active } = useApp();
  const [obs, setObs] = useState<Observation[]>([]);
  const loc = intlLocale();
  const fmtD = (ms: number) => new Date(ms).toLocaleDateString(loc, { day: "numeric", month: "short" });

  useEffect(() => {
    if (!active?.id) return;
    void db.observations.where("childId").equals(active.id).sortBy("recordedAt").then((list) => setObs(list.map(saneObs)));
  }, [active]);

  const episodes = useMemo(() => obs.filter((o) => !o.baseline), [obs]);

  const byTime = useMemo(() => {
    const c = { night: 0, morning: 0, afternoon: 0, evening: 0 };
    episodes.forEach((o) => c[bucket(new Date(o.startedAt).getHours())]++);
    return c;
  }, [episodes]);

  const zones = useMemo(() => {
    const m = new Map<string, number>();
    episodes.forEach((o) => o.bodyZones.forEach((z) => m.set(z, (m.get(z) ?? 0) + 1)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [episodes]);

  const helped = useMemo(() => {
    const m = new Map<string, { yes: number; n: number }>();
    episodes.forEach((o) =>
      o.interventions.forEach((i) => {
        if (!i.helped) return;
        const e = m.get(i.type) ?? { yes: 0, n: 0 };
        e.n++;
        if (i.helped === "yes") e.yes++;
        m.set(i.type, e);
      }),
    );
    return [...m.entries()].sort((a, b) => b[1].yes - a[1].yes);
  }, [episodes]);

  const insights = useMemo(() => {
    const out: string[] = [];
    // Night insight only when night is strictly the modal bucket — no tie bias.
    const max = Math.max(...Object.values(byTime));
    const nightStrictlyTop = byTime.night === max && Object.values(byTime).filter((v) => v === max).length === 1;
    if (nightStrictlyTop && max >= 2 && max > episodes.length / 2) out.push(t("patterns.insightNight"));
    if (zones.length > 0) out.push(t("patterns.insightZone", { zone: t(`zones.${zones[0][0]}`), n: zones[0][1], count: zones[0][1] }));
    const w = helped.find(([, v]) => v.yes >= 2);
    if (w) out.push(t("patterns.insightWorked", { label: t(`interventions.${w[0]}`), yes: w[1].yes, n: w[1].n }));
    return out;
  }, [byTime, episodes.length, zones, helped, t]);

  if (!active) return null;

  if (episodes.length < 2) {
    return (
      <div className="text-center space-y-4 pt-20">
        <div className="mx-auto grid place-items-center size-16 rounded-3xl bg-neutral-100 border border-neutral-200">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="text-neutral-600" aria-hidden>
            <path d="M4 19.5V10M9.5 19.5V4.5M15 19.5v-8M20.5 19.5V8" />
          </svg>
        </div>
        <h1 className="page-title">{t("patterns.title")}</h1>
        <p className="text-neutral-600">{t("patterns.empty")}</p>
        <Link to="/observe" className="btn-primary inline-block">{t("observe.start")}</Link>
      </div>
    );
  }

  const avg = episodes.reduce((s, o) => s + o.total, 0) / episodes.length;
  const maxScore = Math.max(...episodes.map((o) => o.total), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">{t("patterns.title")}</h1>
        <p className="mt-1 text-sm text-neutral-600">
          <span dir="auto">{active.name}</span> · {t("patterns.episodeCount", { count: episodes.length })} · {t("patterns.avgScore")} {avg.toFixed(1)}/10
        </p>
      </div>

      {insights.length > 0 && (
        <div className="card p-4 !border-accent-100 !bg-accent-50 space-y-1.5">
          <h2 className="text-sm font-semibold text-accent-700">{t("patterns.insight")}</h2>
          {insights.map((s, i) => (
            <p key={i} className="text-sm text-neutral-600">• {s}</p>
          ))}
          <p className="text-sm text-neutral-600 pt-1">{t("patterns.note")}</p>
        </div>
      )}

      <Link
        to="/report"
        className="card p-4 flex items-center justify-between gap-3 min-h-12 hover:bg-accent-50/60 transition-colors"
      >
        <span>
          <span className="block text-sm font-semibold text-accent-700">{t("report.entryTitle")}</span>
          <span className="block text-sm text-neutral-600">{t("report.entryDesc")}</span>
        </span>
        <span aria-hidden className="text-accent-700 rtl:-scale-x-100"><IconChevronRight /></span>
      </Link>

      <div className="space-y-6 lg:grid lg:grid-cols-2 lg:gap-5 lg:space-y-0">
      <section className="card p-4 space-y-3">
        <h2 className="section-title">{t("patterns.scoreOverTime")}</h2>
        {/* Bars are scaled on the real 0–10 score axis (not relative to the
            local max) so heights are truthful; the numeric value sits above
            each bar whenever the column can hold it. */}
        <div
          className="flex items-end gap-1"
          role="img"
          aria-label={t("patterns.scoreChartLabel", { count: Math.min(30, episodes.length), avg: avg.toFixed(1), max: maxScore })}
        >
          {episodes.slice(-30).map((o) => (
            <div key={o.id} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${fmtD(o.startedAt)} — ${o.total}/10`}>
              <span className="hidden text-[11px] tabular-nums text-neutral-600 md:block">{o.total}</span>
              <div
                className={`w-full rounded-t-md ${BAND_COLOR[bandFor(o.total)]}`}
                style={{ height: `${o.total * 7.2}px`, opacity: 0.9 }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between border-t border-neutral-200 pt-1 text-[13px] text-neutral-600">
          <span>{episodes.length > 0 && fmtD(episodes[Math.max(0, episodes.length - 30)].startedAt)}</span>
          <span aria-hidden>0–10</span>
          <span>{episodes.length > 0 && fmtD(episodes[episodes.length - 1].startedAt)}</span>
        </div>
        {/* Same records as a plain data list — the chart's accessible
            alternative and the mobile value readout. */}
        <details className="text-[13px] text-neutral-600">
          <summary className="min-h-11 cursor-pointer font-medium text-neutral-700 inline-flex items-center">{t("patterns.values")}</summary>
          <ul className="mt-1 grid grid-cols-2 gap-x-6 gap-y-0.5 sm:grid-cols-3">
            {episodes.slice(-30).map((o) => (
              <li key={o.id} className="tabular-nums">{fmtD(o.startedAt)} — {o.total}/10</li>
            ))}
          </ul>
        </details>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="section-title">{t("patterns.byTimeOfDay")}</h2>
        <div className="space-y-2">
          {(["night", "morning", "afternoon", "evening"] as const).map((k) => (
            <div key={k} className="flex items-center gap-2 text-sm">
              <span className="w-28 text-neutral-600">{t(`patterns.${k}`)}</span>
              <div className="flex-1 h-4 rounded-full bg-neutral-100 overflow-hidden">
                <div
                  className="h-full bg-accent-500 rounded-full"
                  style={{ width: `${episodes.length ? (byTime[k] / episodes.length) * 100 : 0}%` }}
                />
              </div>
              <span className="w-6 text-end tabular-nums text-neutral-600">{byTime[k]}</span>
            </div>
          ))}
        </div>
      </section>

      {zones.length > 0 && (
        <section className="card p-4 space-y-2">
          <h2 className="section-title">{t("patterns.zones")}</h2>
          <div className="flex flex-wrap gap-2">
            {zones.map(([z, n]) => (
              <span key={z} className="badge bg-accent-50 text-accent-800 border border-accent-100">
                {t(`zones.${z}`)} ×{n}
              </span>
            ))}
          </div>
        </section>
      )}

      {helped.length > 0 && (
        <section className="card p-4 space-y-2">
          <h2 className="section-title">{t("patterns.worked")}</h2>
          {helped.map(([type, v]) => (
            <div key={type} className="flex items-center justify-between text-sm">
              <span className="text-neutral-600">{t(`interventions.${type}`)}</span>
              <span className={v.yes / v.n >= 0.5 ? "text-emerald-700" : "text-neutral-600"}>
                {t("patterns.workedRate", { yes: v.yes, n: v.n })}
              </span>
            </div>
          ))}
        </section>
      )}
      </div>
    </div>
  );
}
