import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { useApp } from "../appContext";
import { db, saneObs } from "../db";
import { fmtMinutes, intlLocale, scaleLang } from "../i18n";
import { summarize } from "../summary";
import { bandFor, FLACC_CATEGORIES, type Observation } from "../types";
import { IconPrint } from "../components/icons";
import { readReportState } from "../reportState";

/** The doctor report as a web page: the same content and numbers as the PDF
    (both read src/summary.ts), but with real headings, lists and a data
    table — readable with a screen reader, at 400% zoom, or printed. */
export default function ReportView() {
  const { t, i18n } = useTranslation();
  const { active } = useApp();
  const loc = useLocation();
  const opts = readReportState(loc.state);
  const [obs, setObs] = useState<Observation[] | null>(null);
  // One clock reading per visit: the "prepared" stamp and the period window agree.
  const [now] = useState(Date.now);

  useEffect(() => {
    if (!active?.id) return;
    void db.observations.where("childId").equals(active.id).toArray().then((rows) => setObs(rows.map(saneObs)));
  }, [active]);

  if (!active) return null;
  if (obs === null) {
    return <p className="pt-20 text-center text-neutral-600">{t("common.loading")}</p>;
  }

  const lang = intlLocale();
  const p = (key: string, o?: Record<string, unknown>) => t(`report.pdf.${key}`, o);
  const cap = (s: string) => s.charAt(0).toLocaleUpperCase(lang) + s.slice(1);
  const fmtDate = (ms: number) =>
    `${new Date(ms).toLocaleDateString(lang, { day: "2-digit", month: "short", year: "numeric" })} ${new Date(ms).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" })}`;
  const zone = (z: string) => t(`zones.${z}`, { defaultValue: z });

  const s = summarize(obs, opts.period, now);
  const { episodes, baselines } = s;
  const sl = scaleLang();
  const scaleAttrs = sl !== i18n.language ? { lang: sl, dir: "ltr" as const } : {};
  const custom = FLACC_CATEGORIES.filter((c) => active.customDescriptors[c]?.trim());
  const questions = opts.questions.map((q) => q.trim()).filter(Boolean);
  const about = [
    active.birthYear ? `${p("born")} ${active.birthYear}` : "",
    active.conditions,
  ].filter(Boolean).join(" · ");
  const h2 = "text-[15px] font-semibold text-neutral-900 border-b border-neutral-200 pb-1.5 mb-3";

  return (
    <article aria-labelledby="rv-title" className="mx-auto max-w-3xl space-y-7 print:space-y-4 print:text-[12px]">
      <div className="flex flex-wrap gap-2 print:hidden">
        <Link to="/report" state={opts} className="btn-ghost">{t("reportView.back")}</Link>
        <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={() => window.print()}>
          <span aria-hidden><IconPrint /></span>
          {t("reportView.print")}
        </button>
      </div>

      <header className="space-y-1 border-b-2 border-accent-600 pb-4">
        <h1 id="rv-title" className="page-title">{t("reportView.title")}</h1>
        <p className="text-[15px] font-medium text-neutral-800">
          <span dir="auto" className="break-words">{active.name}</span>
          {active.isDemo && <span className="ms-2 badge bg-amber-100 text-amber-800">{t("app.demoBadge")}</span>}
        </p>
        {about && <p className="text-[15px] text-neutral-600" dir="auto">{about}</p>}
        <p className="text-[13px] text-neutral-600">
          {p("prepared", { date: fmtDate(now), count: episodes.length })}
          {" · "}
          {opts.period == null ? p("periodAll") : p("periodLast", { n: opts.period })}
        </p>
      </header>

      {(active.communicates || custom.length > 0) && (
        <section aria-labelledby="rv-signal">
          <h2 id="rv-signal" className={h2}>{p("howTheySignal")}</h2>
          {active.communicates && <p className="text-[15px] text-neutral-800 print:text-[12px]" dir="auto">{active.communicates}</p>}
          {custom.length > 0 && (
            <>
              <h3 className="mt-3 mb-1.5 text-[13px] font-semibold text-neutral-700">{p("individualBehaviours")}</h3>
              <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-4 gap-y-1 text-[15px] print:text-[12px]">
                {custom.map((c) => (
                  <div key={c} className="contents">
                    <dt className="font-medium text-neutral-700" {...scaleAttrs}>{t(`flacc.${c}`)}</dt>
                    <dd className="text-neutral-800" dir="auto">{active.customDescriptors[c].trim()}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </section>
      )}

      {episodes.length > 0 && (
        <section aria-labelledby="rv-shows">
          <h2 id="rv-shows" className={h2}>{p("whatShows")}</h2>
          <ul className="list-disc space-y-1 ps-5 text-[15px] text-neutral-800 print:text-[12px]">
            <li>{p("episodesLine", { count: episodes.length, avg: s.avg.toFixed(1), max: s.max })}</li>
            {s.night > 0 && <li>{p("nightLine", { night: s.night, count: episodes.length })}</li>}
            {s.zones.length > 0 && <li>{p("areasLine")}: {s.zones.slice(0, 4).map(([z, n]) => `${zone(z)} (${n}×)`).join(", ")}</li>}
            {s.meds.length > 0 && <li>{p("medLine")}: <span dir="auto">{s.meds.join(", ")}</span></li>}
            {s.helped.length > 0 && (
              <li>{p("intervLine")}: {s.helped.map(([k, v]) => `${t(`interventions.${k}`, { defaultValue: k })} ${v.yes}/${v.n} ${p("helped")}`).join(", ")}</li>
            )}
          </ul>
        </section>
      )}

      <section aria-labelledby="rv-log">
        <h2 id="rv-log" className={h2}>{p("episodeLog")}</h2>
        {episodes.length > 0 ? (
          // Wide table on a phone: it scrolls inside its own focusable region
          // (keyboard users can scroll it too) instead of the whole page.
          <div role="region" aria-labelledby="rv-caption" tabIndex={0} className="-mx-1 overflow-x-auto px-1 focus-visible:outline-2 focus-visible:outline-accent-600 print:overflow-visible">
            <table className="w-full min-w-[40rem] border-collapse text-start text-[14px] print:min-w-0 print:text-[10.5px]">
              <caption id="rv-caption" className="sr-only">{t("reportView.caption")}</caption>
              <thead>
                <tr className="border-b border-neutral-300 text-[13px] text-neutral-700 print:text-[10px]">
                  {[p("colDate"), p("colScore"), p("colBand"), p("colDuration"), p("colAreas"), p("colCause")].map((h) => (
                    <th key={h} scope="col" className="px-2 py-2 text-start font-semibold">{cap(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {episodes.map((o) => (
                  <tr key={o.id ?? o.startedAt} className="border-b border-neutral-200 align-top">
                    <th scope="row" className="whitespace-nowrap px-2 py-2 text-start font-medium tabular-nums text-neutral-800">{fmtDate(o.startedAt)}</th>
                    <td className="px-2 py-2 tabular-nums font-semibold">{o.total}/10</td>
                    <td className="px-2 py-2" {...scaleAttrs}>{t(`band.${bandFor(o.total)}`)}</td>
                    <td className="whitespace-nowrap px-2 py-2 tabular-nums">{o.durationMinutes ? fmtMinutes(o.durationMinutes) : "—"}</td>
                    <td className="px-2 py-2">{o.bodyZones.map(zone).join(", ") || "—"}</td>
                    <td className="px-2 py-2" dir="auto">{[o.suspectedCause, o.note].filter(Boolean).join(" — ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[15px] text-neutral-600">{t("reportView.noEpisodes")}</p>
        )}
        {baselines.length > 0 && (
          <p className="mt-3 text-[13px] text-neutral-600">{p("baselineLine", { count: baselines.length, scores: baselines.map((b) => b.total).join(", ") })}</p>
        )}
      </section>

      {questions.length > 0 && (
        <section aria-labelledby="rv-questions">
          <h2 id="rv-questions" className={h2}>{p("questions")}</h2>
          <ol className="list-decimal space-y-1 ps-5 text-[15px] text-neutral-800 print:text-[12px]">
            {questions.map((q, i) => <li key={i} dir="auto">{q}</li>)}
          </ol>
        </section>
      )}

      <footer className="space-y-1 border-t border-neutral-200 pt-3 text-[13px] text-neutral-600 print:text-[10px]">
        <p>{p("footer1")}</p>
        <p>{p("footer2")}</p>
      </footer>
    </article>
  );
}
