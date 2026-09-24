import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useApp } from "../appContext";
import { db } from "../db";
import { BAND_COLOR } from "../flacc";
import { bandFor, type Observation } from "../types";

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

  useEffect(() => {
    if (!active?.id) return;
    void db.observations.where("childId").equals(active.id).sortBy("recordedAt").then(setObs);
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
    const max = Math.max(...Object.values(byTime));
    const top = (Object.entries(byTime) as [string, number][]).find(([, v]) => v === max);
    if (top && max >= 2 && top[0] === "night" && max > episodes.length / 2) out.push(t("patterns.insightNight"));
    if (zones.length > 0) out.push(t("patterns.insightZone", { zone: t(`zones.${zones[0][0]}`), n: zones[0][1] }));
    const w = helped.find(([, v]) => v.yes >= 2);
    if (w) out.push(t("patterns.insightWorked", { label: t(`interventions.${w[0]}`), yes: w[1].yes, n: w[1].n }));
    return out;
  }, [byTime, episodes.length, zones, helped, t]);

  if (!active) return null;

  if (episodes.length < 2) {
    return (
      <div className="text-center space-y-4 pt-20">
        <div className="mx-auto grid place-items-center size-16 rounded-3xl bg-white/[0.05] border border-white/[0.07]">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="text-neutral-500" aria-hidden>
            <path d="M4 19.5V10M9.5 19.5V4.5M15 19.5v-8M20.5 19.5V8" />
          </svg>
        </div>
        <p className="text-neutral-400">{t("patterns.empty")}</p>
        <Link to="/observe" className="btn-primary inline-block">{t("observe.start")}</Link>
      </div>
    );
  }

  const avg = episodes.reduce((s, o) => s + o.total, 0) / episodes.length;
  const maxScore = Math.max(...episodes.map((o) => o.total), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">{t("patterns.title")}</h1>
        <span className="text-sm text-neutral-400">
          {episodes.length} {t("patterns.episodes")} · {t("patterns.avgScore")} {avg.toFixed(1)}
        </span>
      </div>

      {insights.length > 0 && (
        <div className="card p-4 !border-teal-400/30 !bg-teal-400/[0.06] space-y-1.5">
          <h2 className="text-sm font-semibold text-teal-300">{t("patterns.insight")}</h2>
          {insights.map((s, i) => (
            <p key={i} className="text-sm text-neutral-300">• {s}</p>
          ))}
        </div>
      )}

      <section className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-neutral-400">{t("patterns.scoreOverTime")}</h2>
        <div className="flex items-end gap-1 h-24">
          {episodes.slice(-30).map((o) => (
            <div
              key={o.id}
              title={`${new Date(o.startedAt).toLocaleDateString()} — ${o.total}/10`}
              className={`flex-1 rounded-t-md ${BAND_COLOR[bandFor(o.total)]}`}
              style={{ height: `${Math.max(8, (o.total / maxScore) * 100)}%`, opacity: 0.9 }}
            />
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-neutral-600">
          <span>{episodes.length > 0 && new Date(episodes[Math.max(0, episodes.length - 30)].startedAt).toLocaleDateString()}</span>
          <span>{episodes.length > 0 && new Date(episodes[episodes.length - 1].startedAt).toLocaleDateString()}</span>
        </div>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-neutral-400">{t("patterns.byTimeOfDay")}</h2>
        <div className="space-y-2">
          {(["night", "morning", "afternoon", "evening"] as const).map((k) => (
            <div key={k} className="flex items-center gap-2 text-sm">
              <span className="w-28 text-neutral-400">{t(`patterns.${k}`)}</span>
              <div className="flex-1 h-4 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full bg-indigo-400 rounded-full"
                  style={{ width: `${episodes.length ? (byTime[k] / episodes.length) * 100 : 0}%` }}
                />
              </div>
              <span className="w-6 text-right text-neutral-300">{byTime[k]}</span>
            </div>
          ))}
        </div>
      </section>

      {zones.length > 0 && (
        <section className="card p-4 space-y-2">
          <h2 className="text-sm font-semibold text-neutral-400">{t("patterns.zones")}</h2>
          <div className="flex flex-wrap gap-2">
            {zones.map(([z, n]) => (
              <span key={z} className="badge bg-orange-500/15 text-orange-300 border border-orange-400/20">
                {t(`zones.${z}`)} ×{n}
              </span>
            ))}
          </div>
        </section>
      )}

      {helped.length > 0 && (
        <section className="card p-4 space-y-2">
          <h2 className="text-sm font-semibold text-neutral-400">{t("patterns.worked")}</h2>
          {helped.map(([type, v]) => (
            <div key={type} className="flex items-center justify-between text-sm">
              <span className="text-neutral-300">{t(`interventions.${type}`)}</span>
              <span className={v.yes / v.n >= 0.5 ? "text-emerald-400" : "text-neutral-500"}>
                {t("patterns.workedRate", { yes: v.yes, n: v.n })}
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
