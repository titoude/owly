import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { useApp } from "../appContext";
import { db, saneObs } from "../db";
import type { Observation } from "../types";
import { ScoreBadge } from "../components/ScoreBadge";
import { intlLocale } from "../i18n";

export default function History() {
  const { t } = useTranslation();
  const loc = intlLocale();
  const { active } = useApp();
  const [obs, setObs] = useState<Observation[]>([]);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [params] = useSearchParams();
  const focusId = Number(params.get("focus")) || null;
  const didFocus = useRef(false);

  useEffect(() => {
    if (!active?.id) return;
    void db.observations
      .where("childId").equals(active.id)
      .reverse().sortBy("recordedAt")
      .then((list) => setObs(list.map(saneObs)));
  }, [active]);

  // Deep links from the journal point at one record — scroll it into view,
  // ring it, and hand it focus so keyboard/AT users land on the record they
  // chose. Ordinary History visits never get this treatment.
  useEffect(() => {
    if (didFocus.current || !focusId || obs.length === 0) return;
    const el = document.getElementById(`obs-${focusId}`);
    if (!el) return;
    didFocus.current = true;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    el.focus({ preventScroll: true });
  }, [focusId, obs]);

  async function remove(id: number) {
    await db.observations.delete(id);
    setObs((o) => o.filter((x) => x.id !== id));
  }

  if (!active) return null;

  if (obs.length === 0) {
    return (
      <div className="text-center space-y-4 pt-20">
        <img src="/icon.svg" alt="" className="mx-auto size-16 rounded-2xl opacity-70" />
        <h1 className="page-title">{t("history.title")}</h1>
        <p className="text-neutral-600">{t("history.empty")}</p>
        <Link to="/observe" className="btn-primary inline-block">
          {t("history.emptyCta")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">{t("history.title")}</h1>
        <p className="mt-1 text-sm text-neutral-600">
          <span dir="auto">{active.name}</span> · {obs.length} {t("history.observations")}
        </p>
      </div>
      {obs.map((o) => (
        <div
          key={o.id}
          id={`obs-${o.id}`}
          tabIndex={focusId === o.id ? -1 : undefined}
          className={`card p-4 space-y-2 scroll-mt-24 focus:outline-none ${focusId === o.id ? "ring-2 ring-accent-600" : ""}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-medium">
                {new Date(o.startedAt).toLocaleDateString(loc)}{" "}
                {new Date(o.startedAt).toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" })}
                {o.baseline && (
                  <span className="ms-2 text-[13px] text-emerald-700">· {t("history.baseline")}</span>
                )}
              </div>
              <div className="text-[13px] text-neutral-600">
                {o.durationMinutes ? `${o.durationMinutes} min` : ""}
                {o.bodyZones.length > 0 && ` · ${o.bodyZones.map((z) => t(`zones.${z}`)).join(", ")}`}
                {o.suspectedCause && ` · ${o.suspectedCause}`}
              </div>
            </div>
            <ScoreBadge total={o.total} />
          </div>
          {o.interventions.length > 0 && (
            <div className="text-[13px] text-neutral-600">
              {o.interventions.map((i) => t(`interventions.${i.type}`)).join(", ")}
              {o.interventions.some((i) => i.helped === "yes") && " ✓"}
            </div>
          )}
          {o.note && <div className="text-sm text-neutral-600 italic break-words line-clamp-6" dir="auto">“{o.note}”</div>}
          {confirmId === o.id ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => o.id && void remove(o.id)}
                className="min-h-11 rounded-lg px-3 text-sm font-semibold text-red-700"
              >
                {t("history.deleteConfirm")}
              </button>
              <button
                type="button"
                onClick={() => setConfirmId(null)}
                className="min-h-11 rounded-lg px-3 text-sm text-neutral-700"
              >
                {t("common.cancel")}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Link
                to={`/observe/${o.id}/edit`}
                className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-neutral-700 underline-offset-2 hover:bg-neutral-50 hover:text-accent-700 hover:underline"
              >
                {t("common.edit")}
              </Link>
              <button
                type="button"
                onClick={() => setConfirmId(o.id ?? null)}
                className="min-h-11 rounded-lg px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 hover:text-red-700"
              >
                {t("common.delete")}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
