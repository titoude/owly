import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useApp } from "../appContext";
import { db } from "../db";
import { buildReport, downloadPdf } from "../report";
import type { Observation } from "../types";

const PERIODS = [7, 14, 30, null] as const;

export default function Report() {
  const { t, i18n } = useTranslation();
  const { active } = useApp();
  const [obs, setObs] = useState<Observation[]>([]);
  const [period, setPeriod] = useState<number | null>(30);
  const [questions, setQuestions] = useState<string[]>(["", ""]);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!active?.id) return;
    void db.observations.where("childId").equals(active.id).sortBy("recordedAt").then((o) => {
      setObs(o);
      setReady(o.filter((x) => !x.baseline).length > 0);
    });
  }, [active]);

  if (!active) return null;

  const episodeCount = obs.filter((o) => !o.baseline && (period == null || o.startedAt >= Date.now() - period * 864e5)).length;

  async function generate() {
    if (!active) return;
    setBusy(true);
    try {
      const bytes = await buildReport(active, obs, { periodDays: period, questions });
      const date = new Date().toISOString().slice(0, 10);
      downloadPdf(bytes, `owly-report-${active.name.toLowerCase()}-${date}.pdf`);
    } finally {
      setBusy(false);
    }
  }

  const fmtD = (ms: number) =>
    new Date(ms).toLocaleDateString(i18n.language === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short" });

  if (!ready) {
    return (
      <div className="text-center space-y-4 pt-20">
        <div className="text-5xl">📋</div>
        <p className="text-slate-400">{t("report.empty")}</p>
        <Link to="/observe" className="btn-primary inline-block">{t("observe.start")}</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("report.title")}</h1>
        <p className="text-sm text-slate-400">{t("report.subtitle")}</p>
      </div>

      <div>
        <h2 className="label">{t("report.period")}</h2>
        <div className="grid grid-cols-4 gap-2">
          {PERIODS.map((d) => (
            <button
              key={d ?? "all"}
              type="button"
              onClick={() => setPeriod(d)}
              className={`touch-target rounded-xl text-sm font-medium ${
                period === d ? "bg-teal-500 text-slate-950" : "bg-slate-800 text-slate-300"
              }`}
            >
              {d == null ? t("report.all") : t("report.days", { n: d })}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {episodeCount} {t("report.included")}
        </p>
      </div>

      <div>
        <h2 className="label">{t("report.questions")}</h2>
        <div className="space-y-2">
          {questions.map((q, i) => (
            <input
              key={i}
              className="input text-sm"
              value={q}
              onChange={(e) => setQuestions((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder={t(`report.q${i}`)}
            />
          ))}
        </div>
      </div>

      <div className="card p-4 space-y-2">
        <h3 className="text-sm font-semibold text-slate-400">{t("report.previewTitle")}</h3>
        <ul className="text-xs text-slate-400 space-y-1">
          {(t("report.includes", { returnObjects: true }) as string[]).map((s, i) => (
            <li key={i}>• {s}</li>
          ))}
        </ul>
        <p className="text-xs text-slate-500 pt-1">
          {t("report.range")}: {fmtD(Date.now() - (period ?? 9999) * 864e5)} → {fmtD(Date.now())}
        </p>
      </div>

      <button type="button" className="btn-primary w-full" disabled={busy || episodeCount === 0} onClick={() => void generate()}>
        {busy ? t("common.loading") : t("report.generate")}
      </button>
      <p className="text-xs text-slate-500 text-center">{t("report.localNote")}</p>
    </div>
  );
}
