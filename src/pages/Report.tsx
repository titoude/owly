import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useApp } from "../appContext";
import { db, saneObs } from "../db";
// pdf-lib is heavy — report.ts is lazy-loaded on first Generate click
// to keep the initial bundle small on low-end phones.
import type { Observation } from "../types";
import { intlLocale } from "../i18n";

const PERIODS = [7, 14, 30, null] as const;

export default function Report() {
  const { t } = useTranslation();
  const { active } = useApp();
  const [obs, setObs] = useState<Observation[]>([]);
  const [period, setPeriod] = useState<number | null>(30);
  const [questions, setQuestions] = useState<string[]>(["", ""]);
  const [busy, setBusy] = useState(false);
  // State disables the button only after a re-render — a fast second click
  // still reaches generate(). The ref gates synchronously.
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadNeeded, setReloadNeeded] = useState(false);
  const [ready, setReady] = useState(false);

  // The pre-reload stash is keyed per child so a recovery for one child can
  // never bleed into another's report. It is consumed on read — a stale stash
  // must not resurrect old inputs on a later mount.
  const stashKey = active?.id != null ? `owly-report-draft-${active.id}` : null;

  useEffect(() => {
    if (!stashKey) return;
    try {
      const raw = sessionStorage.getItem(stashKey);
      sessionStorage.removeItem(stashKey);
      if (!raw) return;
      const d = JSON.parse(raw) as { questions?: string[]; period?: number | null };
      // The form renders exactly two question fields — a stash carrying
      // extras (corrupt or hand-written) would push the layout wider.
      if (Array.isArray(d.questions)) setQuestions(d.questions.slice(0, 2));
      if ("period" in d) setPeriod(d.period ?? null);
    } catch { /* sessionStorage can be denied — restoration is best-effort */ }
  }, [stashKey]);

  // While a reload is pending, keep the stash equal to the CURRENT inputs —
  // text typed after the failure must be what survives the reload — and keep
  // the message honest if persistence itself is denied.
  useEffect(() => {
    if (!reloadNeeded || !stashKey) return;
    try {
      sessionStorage.setItem(stashKey, JSON.stringify({ questions, period }));
      setError(t("report.loadFailed"));
    } catch {
      setError(t("report.loadFailedNoKeep"));
    }
  }, [questions, period, reloadNeeded, stashKey, t]);

  useEffect(() => {
    if (!active?.id) return;
    void db.observations.where("childId").equals(active.id).sortBy("recordedAt").then((o) => {
      const rows = o.map(saneObs);
      setObs(rows);
      setReady(rows.filter((x) => !x.baseline).length > 0);
    });
  }, [active]);

  if (!active) return null;

  const episodeCount = obs.filter((o) => !o.baseline && (period == null || o.startedAt >= Date.now() - period * 864e5)).length;

  async function generate() {
    if (!active || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      // The lazy chunk load is inside try/finally too: an aborted or stale
      // module fetch (interrupted first load, SW mid-update) must surface a
      // retryable error, not wedge the button in "loading" forever.
      const mod = await import("../report");
      const bytes = await mod.buildReport(active, obs, { periodDays: period, questions });
      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      mod.downloadPdf(bytes, `owly-report-${active.name.toLowerCase()}-${date}.pdf`);
      if (stashKey) try { sessionStorage.removeItem(stashKey); } catch { /* denied */ }
    } catch (e) {
      const chars = (e as { chars?: unknown }).chars;
      if (e instanceof Error && e.name === "UnsupportedCharsError" && Array.isArray(chars)) {
        // Unsupported characters: name them so the user can fix or keep the
        // journal + export a JSON backup instead. Never ship a misleading PDF.
        setError(t("report.unsupported", { chars: chars.join(" ") }));
      } else if (
        (e instanceof TypeError && /dynamically imported|import\(i?\)|fetch/i.test(e.message)) ||
        e instanceof SyntaxError
      ) {
        // A failed lazy-chunk fetch is cached by the browser, and a stale
        // service worker can also answer it with an HTML 404 body — that
        // fails the module parse (SyntaxError), not the fetch (TypeError).
        // Both are unrecoverable in-page: only a reload refetches the chunk.
        // The synced-stash effect writes inputs and picks the honest message
        // (kept vs could-not-be-kept) once reloadNeeded flips.
        setReloadNeeded(true);
      } else {
        setError(t("report.error"));
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const fmtD = (ms: number) =>
    new Date(ms).toLocaleDateString(intlLocale(), { day: "numeric", month: "short" });

  if (!ready) {
    return (
      <div className="mx-auto max-w-xl text-center space-y-4 pt-20">
        <div className="mx-auto grid place-items-center size-16 rounded-3xl bg-neutral-100 border border-neutral-200">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-600" aria-hidden>
            <path d="M6.5 3.5h7L19 8.5v11a1 1 0 0 1-1 1H6.5a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Z" />
            <path d="M13.5 3.5V9H19M9 13h6.5M9 16.5h4" />
          </svg>
        </div>
        <h1 className="page-title">{t("report.title")}</h1>
        <p className="text-neutral-600">{t("report.empty")}</p>
        <Link to="/observe" className="btn-primary inline-block">{t("observe.start")}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="page-title">{t("report.title")}</h1>
        <p className="mt-1 text-sm text-neutral-600">
          <span dir="auto">{active.name}</span> · {t("report.subtitle")}
        </p>
      </div>

      <div>
        <h2 className="section-title">{t("report.period")}</h2>
        <div className="grid grid-cols-4 gap-2">
          {PERIODS.map((d) => (
            <button
              key={d ?? "all"}
              type="button"
              onClick={() => setPeriod(d)}
              aria-pressed={period === d}
              className={`touch-target rounded-xl border text-sm font-medium transition-all duration-150 ${
                period === d
                  ? "bg-accent-700 text-white font-semibold border-accent-700"
                  : "bg-white border-neutral-500 text-neutral-600 hover:bg-neutral-100 hover:border-neutral-600"
              }`}
            >
              {d == null ? t("report.all") : t("report.days", { n: d })}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[13px] text-neutral-600">
          {t("report.included", { count: episodeCount })}
        </p>
      </div>

      <div>
        <h2 className="section-title">{t("report.questions")}</h2>
        <div className="space-y-2">
          {questions.map((q, i) => (
            <input
              key={i}
              className="input text-sm"
              aria-label={`${t("report.questions")} ${i + 1}`}
              value={q}
              onChange={(e) => setQuestions((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder={t(`report.q${i}`)}
            />
          ))}
        </div>
      </div>

      <div className="card p-4 space-y-2">
        <h3 className="section-title">{t("report.previewTitle")}</h3>
        <ul className="text-[13px] text-neutral-600 space-y-1">
          {(t("report.includes", { returnObjects: true }) as string[]).map((s, i) => (
            <li key={i}>• {s}</li>
          ))}
        </ul>
        <p className="text-[13px] text-neutral-600 pt-1">
          {period == null
            ? t("report.allTime")
            : `${t("report.range")}: ${fmtD(Date.now() - period * 864e5)} → ${fmtD(Date.now())}`}
        </p>
      </div>

      <button type="button" className="btn-primary w-full" disabled={busy || episodeCount === 0} onClick={() => void generate()}>
        {busy ? t("common.loading") : t("report.generate")}
      </button>
      {error && <p className="text-sm text-red-700 text-center" role="alert">{error}</p>}
      {reloadNeeded && (
        <button type="button" className="btn-ghost w-full" onClick={() => window.location.reload()}>
          {t("report.reloadRetry")}
        </button>
      )}
      <p className="text-[13px] text-neutral-600 text-center">{t("report.localNote")}</p>
    </div>
  );
}
