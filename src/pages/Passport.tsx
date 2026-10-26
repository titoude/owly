import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useApp } from "../appContext";
import { db, saneObs } from "../db";
import { intlLocale, scaleLang } from "../i18n";
import { mostlyAtNight, summarize } from "../summary";
import { FLACC_CATEGORIES, type Observation } from "../types";
import { IconPrint } from "../components/icons";

// Most frequent calm (baseline) score — what "comfortable" usually scores.
function usualCalmScore(baselines: Observation[]): number | null {
  if (baselines.length === 0) return null;
  const counts = new Map<number, number>();
  for (const b of baselines) counts.set(b.total, (counts.get(b.total) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
}

/** One printable page that travels with the child — school, respite care,
    grandparents, the ER — so the people around them can read their pain
    the way their family does. Plain semantic HTML: screen readers, zoom,
    reflow and print all work without a separate "accessible version". */
export default function Passport() {
  const { t, i18n } = useTranslation();
  const { active } = useApp();
  const [obs, setObs] = useState<Observation[] | null>(null);

  useEffect(() => {
    if (!active?.id) return;
    void db.observations.where("childId").equals(active.id).toArray().then((rows) => setObs(rows.map(saneObs)));
  }, [active]);

  if (!active) return null;
  if (obs === null) {
    return <p className="pt-20 text-center text-neutral-600">{t("common.loading")}</p>;
  }

  const name = active.name;
  const s = summarize(obs);
  const sl = scaleLang();
  const scaleAttrs = sl !== i18n.language ? { lang: sl, dir: "ltr" as const } : {};
  const signs = FLACC_CATEGORIES.filter((c) => active.customDescriptors[c]?.trim());
  // Medication is deliberately left out: dosing is agreed with the family
  // or a doctor, never inferred from a journal by someone else.
  const helps = s.helped.filter(([type, v]) => type !== "medication" && v.yes > 0);
  const calm = usualCalmScore(s.baselines);
  const watch = [
    ...(mostlyAtNight(s) ? [t("passport.watchNight")] : []),
    ...(s.zones[0] ? [t("passport.watchZone", { zone: t(`zones.${s.zones[0][0]}`, { defaultValue: s.zones[0][0] }) })] : []),
  ];
  const about = [
    active.conditions,
    active.birthYear ? t("passport.born", { year: active.birthYear }) : "",
  ].filter(Boolean).join(" · ");
  const today = new Date().toLocaleDateString(intlLocale(), { day: "numeric", month: "long", year: "numeric" });
  const h2 = "text-[15px] font-semibold text-neutral-900 border-b border-neutral-200 pb-1.5 mb-2.5 print:text-[12.5px] print:pb-1 print:mb-1.5";

  return (
    <article aria-labelledby="passport-title" className="mx-auto max-w-2xl space-y-6 print:max-w-none print:space-y-3">
      <header className="flex items-start gap-4 border-b-2 border-accent-600 pb-4 print:gap-3 print:pb-2">
        <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="size-12 shrink-0 rounded-xl print:size-9" />
        <div className="min-w-0 space-y-1">
          <p className="text-[13px] font-semibold text-accent-700">{t("passport.kicker")}</p>
          <h1 id="passport-title" className="page-title break-words print:text-[19px]" dir="auto">{t("passport.heading", { name })}</h1>
          {about && <p className="text-[15px] text-neutral-600 print:text-[11px]" dir="auto">{about}</p>}
          {active.isDemo && (
            <p><span className="badge bg-amber-100 text-amber-800">{t("app.demoBadge")}</span></p>
          )}
        </div>
      </header>

      <p className="text-[15px] leading-relaxed text-neutral-800 print:text-[11px]">{t("passport.intro", { name })}</p>

      <section aria-labelledby="pp-signs">
        <h2 id="pp-signs" className={h2}>{t("passport.showsPain", { name })}</h2>
        {active.communicates && <p className="mb-3 text-[15px] text-neutral-800 print:text-[11px]" dir="auto">{active.communicates}</p>}
        {signs.length > 0 && (
          <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-4 gap-y-1.5 text-[15px] print:gap-y-0.5 print:text-[11px]">
            {signs.map((c) => (
              <div key={c} className="contents">
                <dt className="font-medium text-neutral-700" {...scaleAttrs}>{t(`flacc.${c}`)}</dt>
                <dd className="text-neutral-800" dir="auto">{active.customDescriptors[c].trim()}</dd>
              </div>
            ))}
          </dl>
        )}
        {!active.communicates && signs.length === 0 && (
          <p className="text-[15px] text-neutral-600">
            {t("passport.noSigns")}{" "}
            <Link to={`/child/${active.id}/edit`} className="font-medium text-accent-700 underline underline-offset-2 print:hidden">
              {t("passport.addSigns")}
            </Link>
          </p>
        )}
        {calm != null && <p className="mt-3 text-[13px] text-neutral-600 print:mt-1.5 print:text-[10.5px]">{t("passport.calm", { name, score: calm })}</p>}
      </section>

      <section aria-labelledby="pp-helps">
        <h2 id="pp-helps" className={h2}>{t("passport.helps")}</h2>
        {helps.length > 0 ? (
          <ul className="space-y-1 text-[15px] print:text-[11px]">
            {helps.map(([type, v]) => (
              <li key={type} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3">
                <span className="font-medium text-neutral-800">{t(`interventions.${type}`, { defaultValue: type })}</span>
                <span className="whitespace-nowrap text-[13px] text-neutral-600 print:text-[10.5px]">{t("passport.helpsRate", { yes: v.yes, n: v.n })}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[15px] text-neutral-600">{t("passport.helpsNone")}</p>
        )}
      </section>

      {watch.length > 0 && (
        <section aria-labelledby="pp-watch">
          <h2 id="pp-watch" className={h2}>{t("passport.watch")}</h2>
          <ul className="list-disc space-y-1 ps-5 text-[15px] text-neutral-800 print:text-[11px]">
            {watch.map((w) => <li key={w}>{w}</li>)}
          </ul>
        </section>
      )}

      <section aria-labelledby="pp-steps">
        <h2 id="pp-steps" className={h2}>{t("passport.steps", { name })}</h2>
        <ol className="list-decimal space-y-1 ps-5 text-[15px] text-neutral-800 print:text-[11px]">
          {(t("passport.stepsItems", { returnObjects: true }) as string[]).map((step) => <li key={step}>{step}</li>)}
        </ol>
      </section>

      <section aria-labelledby="pp-emergency" className="rounded-xl border border-red-300 bg-red-50 p-4 print:break-inside-avoid print:p-3">
        <h2 id="pp-emergency" className="mb-2 text-[15px] font-semibold text-red-700 print:mb-1 print:text-[12.5px]">{t("passport.emergency")}</h2>
        <ul className="list-disc space-y-0.5 ps-5 text-[15px] text-neutral-800 print:text-[11px]">
          {(t("redflags.items", { returnObjects: true }) as string[]).map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>

      {/* Filled in by hand on paper — Owly never stores contact details. */}
      <section aria-labelledby="pp-contacts" className="hidden print:block print:break-inside-avoid">
        <h2 id="pp-contacts" className={h2}>{t("passport.contacts")}</h2>
        {[t("passport.contactFamily"), t("passport.contactDoctor")].map((who) => (
          <p key={who} className="flex gap-3 pt-4 print:pt-3 print:text-[11px]">
            <span className="w-40 shrink-0 font-medium">{who}</span>
            <span className="flex-1 border-b border-neutral-500" />
            <span className="shrink-0 font-medium">{t("passport.phone")}</span>
            <span className="w-32 border-b border-neutral-500" />
          </p>
        ))}
      </section>

      <footer className="border-t border-neutral-200 pt-3 text-[13px] text-neutral-600 print:text-[9.5px]">
        {t("passport.footer", { date: today })}
      </footer>

      <div className="space-y-2 print:hidden">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={() => window.print()}>
            <span aria-hidden><IconPrint /></span>
            {t("passport.print")}
          </button>
          <Link to={`/child/${active.id}/edit`} className="btn-ghost">{t("passport.editProfile")}</Link>
        </div>
        <p className="text-[13px] text-neutral-600">{t("passport.printHint")}</p>
      </div>
    </article>
  );
}
