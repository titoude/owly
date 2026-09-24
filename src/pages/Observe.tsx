import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useApp } from "../appContext";
import { db } from "../db";
import { INTERVENTION_TYPES, totalFlacc } from "../flacc";
import { FLACC_CATEGORIES, type FlaccScores, type Intervention, type Observation } from "../types";
import { FlaccPicker } from "../components/FlaccPicker";
import { BodyMap } from "../components/BodyMap";
import { ScoreBadge } from "../components/ScoreBadge";

const STEPS = 8;

export default function Observe() {
  const { t } = useTranslation();
  const { active } = useApp();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [baseline, setBaseline] = useState(false);
  const [minutesAgo, setMinutesAgo] = useState(0);
  const [scores, setScores] = useState<FlaccScores>({ face: -1, legs: -1, activity: -1, cry: -1, consolability: -1 });
  const [duration, setDuration] = useState<number | null>(null);
  const [zones, setZones] = useState<string[]>([]);
  const [cause, setCause] = useState("");
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const stepHeading = useRef<HTMLDivElement>(null);

  // Move focus to the step region on each step change so keyboard and
  // screen-reader users don't lose their place in the 8-step flow.
  useEffect(() => {
    stepHeading.current?.focus({ preventScroll: true });
  }, [step]);

  const total = useMemo(() => {
    if (Object.values(scores).some((v) => v < 0)) return null;
    return totalFlacc(scores as FlaccScores);
  }, [scores]);

  const cat = step >= 1 && step <= 5 ? FLACC_CATEGORIES[step - 1] : null;
  const canNext =
    step === 0 || step === 6 ? true :
    cat ? scores[cat] >= 0 :
    false;

  async function save() {
    if (!active?.id || total === null) return;
    setSaving(true);
    const obs: Observation = {
      childId: active.id,
      startedAt: Date.now() - minutesAgo * 60_000,
      recordedAt: Date.now(),
      scores: scores as FlaccScores,
      total,
      durationMinutes: duration,
      bodyZones: zones,
      suspectedCause: cause.trim(),
      interventions,
      note: note.trim(),
      baseline,
    };
    await db.observations.add(obs);
    nav("/history");
  }

  if (!active) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between" ref={stepHeading} tabIndex={-1}>
        <h1 className="text-xl font-bold">{t("observe.start")}</h1>
        <span className="text-xs text-neutral-500">
          {step + 1}/{STEPS}
        </span>
      </div>
      <div className="h-1 rounded-full bg-white/[0.07] overflow-hidden">
        <div
          className="h-1 rounded-full bg-teal-400 transition-all duration-300 ease-out"
          style={{ width: `${((step + 1) / STEPS) * 100}%` }}
        />
      </div>

      <div key={step} className="step-in space-y-6">
      {step === 0 && (
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="label">{t("observe.baselineQ")}</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setBaseline(false)}
                className={`card p-4 text-left font-semibold transition-all duration-150 ${!baseline ? "!border-orange-400/60 !bg-orange-400/10 text-orange-200" : "text-neutral-300"}`}
              >
                <span className="mr-1.5 inline-block size-2.5 rounded-full bg-orange-400 align-middle" />
                {t("observe.episode")}
              </button>
              <button
                type="button"
                onClick={() => setBaseline(true)}
                className={`card p-4 text-left font-semibold transition-all duration-150 ${baseline ? "!border-emerald-400/60 !bg-emerald-400/10 text-emerald-200" : "text-neutral-300"}`}
              >
                <span className="mr-1.5 inline-block size-2.5 rounded-full bg-emerald-400 align-middle" />
                {t("observe.baseline")}
              </button>
            </div>
            {baseline && <p className="text-xs text-neutral-400">{t("observe.baselineHint")}</p>}
          </div>
          <div className="space-y-2">
            <p className="label">{t("observe.when")}</p>
            <div className="flex flex-wrap gap-2">
              {[0, 15, 30, 60, 120].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMinutesAgo(m)}
                  className={`btn-ghost text-sm ${minutesAgo === m ? "border border-teal-400/70 !bg-teal-400/[0.13] text-teal-200" : ""}`}
                >
                  {m === 0 ? t("observe.now") : t("observe.minutesAgo", { n: m })}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {cat && (
        <FlaccPicker
          category={cat}
          child={active}
          value={scores[cat]}
          onChange={(v) => setScores((s) => ({ ...s, [cat]: v }))}
        />
      )}

      {step === 6 && (
        <div className="space-y-6">
          <div className="card p-5 grid place-items-center">
            <p className="label">{t("observe.score")}</p>
            {total !== null && <ScoreBadge total={total} big />}
          </div>
          <div className="space-y-2">
            <p className="label">{t("observe.duration")}</p>
            <div className="flex flex-wrap gap-2">
              {[5, 15, 30, 60, 120].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDuration(m)}
                  className={`btn-ghost text-sm ${duration === m ? "border border-teal-400/70 !bg-teal-400/[0.13] text-teal-200" : ""}`}
                >
                  {m} min
                </button>
              ))}
              <button
                type="button"
                onClick={() => setDuration(null)}
                className={`btn-ghost text-sm ${duration === null ? "border border-teal-400/70 !bg-teal-400/[0.13] text-teal-200" : ""}`}
              >
                {t("observe.durationUnknown")}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <p className="label">{t("observe.where")}</p>
            <BodyMap
              selected={zones}
              onToggle={(z) => setZones((zs) => (zs.includes(z) ? zs.filter((x) => x !== z) : [...zs, z]))}
            />
          </div>
          <div>
            <label className="label" htmlFor="cause">{t("observe.cause")}</label>
            <input
              id="cause"
              className="input"
              placeholder={t("observe.causeHint")}
              value={cause}
              onChange={(e) => setCause(e.target.value)}
            />
          </div>
        </div>
      )}

      {step === 7 && (
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="label">{t("observe.tried")}</p>
            {INTERVENTION_TYPES.map((type) => {
              const it = interventions.find((i) => i.type === type);
              return (
                <div key={type} className="card p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setInterventions((iv) =>
                          it ? iv.filter((x) => x.type !== type) : [...iv, { type, label: "", helped: null }],
                        )
                      }
                      className={`flex-1 text-left text-sm ${it ? "text-teal-300" : "text-neutral-400"}`}
                    >
                      {it ? "✓ " : ""}{t(`interventions.${type}`)}
                    </button>
                    {it && (
                      <div className="flex gap-1">
                        {(["yes", "no", "unsure"] as const).map((h) => (
                          <button
                            key={h}
                            type="button"
                            onClick={() =>
                              setInterventions((iv) =>
                                iv.map((x) => (x.type === type ? { ...x, helped: h } : x)),
                              )
                            }
                            className={`rounded-md px-2.5 py-1 text-xs
                              ${it.helped === h ? "bg-teal-400 text-neutral-950 font-semibold" : "bg-white/[0.08] text-neutral-400"}`}
                          >
                            {t(`observe.${h}`)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {it?.type === "medication" && (
                    <input
                      className="input text-sm"
                      placeholder={t("interventions.medLabel")}
                      value={it.label}
                      onChange={(e) =>
                        setInterventions((iv) =>
                          iv.map((x) => (x.type === type ? { ...x, label: e.target.value } : x)),
                        )
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div>
            <label className="label" htmlFor="note">{t("observe.note")}</label>
            <textarea
              id="note"
              className="input min-h-20"
              placeholder={t("observe.noteHint")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
      )}
      </div>

      <div className="flex gap-3 pt-2">
        {step > 0 && (
          <button type="button" className="btn-ghost flex-1" onClick={() => setStep((s) => s - 1)}>
            {t("common.back")}
          </button>
        )}
        {step < STEPS - 1 ? (
          <button
            type="button"
            className="btn-primary flex-1"
            disabled={!canNext}
            onClick={() => setStep((s) => s + 1)}
          >
            {t("common.next")}
          </button>
        ) : (
          <button type="button" className="btn-primary flex-1" disabled={saving} onClick={() => void save()}>
            {saving ? t("common.loading") : t("observe.save")}
          </button>
        )}
      </div>
    </div>
  );
}
