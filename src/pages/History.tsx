import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useApp } from "../appContext";
import { db } from "../db";
import type { Observation } from "../types";
import { ScoreBadge } from "../components/ScoreBadge";
import { intlLocale } from "../i18n";

export default function History() {
  const { t } = useTranslation();
  const loc = intlLocale();
  const { active } = useApp();
  const [obs, setObs] = useState<Observation[]>([]);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  useEffect(() => {
    if (!active?.id) return;
    void db.observations
      .where("childId").equals(active.id)
      .reverse().sortBy("recordedAt")
      .then(setObs);
  }, [active]);

  async function remove(id: number) {
    await db.observations.delete(id);
    setObs((o) => o.filter((x) => x.id !== id));
  }

  if (!active) return null;

  if (obs.length === 0) {
    return (
      <div className="text-center space-y-4 pt-20">
        <img src="/icon.svg" alt="" className="mx-auto size-16 rounded-2xl opacity-70" />
        <p className="text-neutral-600">{t("history.empty")}</p>
        <Link to="/observe" className="btn-primary inline-block">
          {t("history.emptyCta")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{t("history.title")}</h1>
      {obs.map((o) => (
        <div key={o.id} className="card p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-medium">
                {new Date(o.startedAt).toLocaleDateString(loc)}{" "}
                {new Date(o.startedAt).toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" })}
                {o.baseline && (
                  <span className="ml-2 text-xs text-emerald-700">· {t("history.baseline")}</span>
                )}
              </div>
              <div className="text-xs text-neutral-600">
                {o.durationMinutes ? `${o.durationMinutes} min` : ""}
                {o.bodyZones.length > 0 && ` · ${o.bodyZones.map((z) => t(`zones.${z}`)).join(", ")}`}
                {o.suspectedCause && ` · ${o.suspectedCause}`}
              </div>
            </div>
            <ScoreBadge total={o.total} />
          </div>
          {o.interventions.length > 0 && (
            <div className="text-xs text-neutral-600">
              {o.interventions.map((i) => t(`interventions.${i.type}`)).join(", ")}
              {o.interventions.some((i) => i.helped === "yes") && " ✓"}
            </div>
          )}
          {o.note && <div className="text-sm text-neutral-600 italic break-words" dir="auto">“{o.note}”</div>}
          {confirmId === o.id ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => o.id && void remove(o.id)}
                className="text-xs font-semibold text-red-700"
              >
                {t("history.deleteConfirm")}
              </button>
              <button
                type="button"
                onClick={() => setConfirmId(null)}
                className="text-xs text-neutral-600"
              >
                {t("common.cancel")}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link to={`/observe/${o.id}/edit`} className="text-xs text-neutral-600 underline hover:text-teal-700">
                {t("common.edit")}
              </Link>
              <button
                type="button"
                onClick={() => setConfirmId(o.id ?? null)}
                className="text-xs text-neutral-600 hover:text-red-700"
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
