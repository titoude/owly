import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../appContext";
import { db } from "../db";
import { clearDraft, draftEditKey, draftKey, loadDraft, saveDraft, type ObsDraft } from "../drafts";
import { INTERVENTION_TYPES, totalFlacc } from "../flacc";
import { FLACC_CATEGORIES, type FlaccScores, type Intervention, type Observation } from "../types";
import { FlaccPicker } from "../components/FlaccPicker";
import { BodyMap } from "../components/BodyMap";
import { ScoreBadge } from "../components/ScoreBadge";

const STEPS = 8;
// Step names shown in the caption and desktop rail. FLACC categories reuse
// their existing keys; the three non-category steps get dedicated names.
const STEP_KEYS = [
  "observe.stepNames.when",
  "flacc.face",
  "flacc.legs",
  "flacc.activity",
  "flacc.cry",
  "flacc.consolability",
  "observe.stepNames.details",
  "observe.stepNames.tried",
];

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Observe() {
  const { t } = useTranslation();
  const { active } = useApp();
  const nav = useNavigate();
  const { id } = useParams();
  const editId = id ? Number(id) : null;
  const [step, setStep] = useState(0);
  const [baseline, setBaseline] = useState(false);
  const [minutesAgo, setMinutesAgo] = useState(0);
  const [customAt, setCustomAt] = useState<string | null>(null);
  const [scores, setScores] = useState<FlaccScores>({ face: -1, legs: -1, activity: -1, cry: -1, consolability: -1 });
  const [duration, setDuration] = useState<number | null>(null);
  const [zones, setZones] = useState<string[]>([]);
  const [cause, setCause] = useState("");
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Draft prompt: a stored draft whose resume/discard the user hasn't
  // decided yet. While it sits undecided the wizard stays at step 0 and
  // autosave stays off — we must not clobber it with an empty form.
  const [offer, setOffer] = useState<ObsDraft | null>(null);
  const [offerSeen, setOfferSeen] = useState(false); // true once resolved
  const [draftFailed, setDraftFailed] = useState(false); // draft write rejected (quota/denied)
  const seeded = useRef<string>(""); // JSON of the seeded fields
  const orig = useRef<Observation | null>(null); // edited record, for timestamp preservation
  const seededWhen = useRef<string | null>(null); // customAt string the form was seeded with
  // Absolute epoch-ms the "when" selection refers to. Written ONLY by an
  // explicit when interaction (chip click, custom-time edit, seed, resume)
  // plus the default-Now seed at mount — never recomputed per keystroke or
  // per autosave, so it cannot drift with wall-clock time. It lives in
  // draft state so a same-value reselection still dirties the draft.
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const stepHeading = useRef<HTMLDivElement>(null);

  const key = editId ? draftEditKey(editId) : active?.id ? draftKey(active.id) : null;

  const fields = useMemo<ObsDraft>(() => ({
    step, baseline, minutesAgo, customAt, scores, duration, zones, cause, interventions, note,
    startedAt,
    savedAt: 0,
  }), [step, baseline, minutesAgo, customAt, scores, duration, zones, cause, interventions, note, startedAt]);

  // Seed from an existing record in edit mode (guard: it must belong to
  // the active child — observations never cross profiles), then offer any
  // stored draft. New observations seed empty.
  useEffect(() => {
    if (!active?.id) return;
    let cancelled = false;
    void (async () => {
      if (editId) {
        const o = await db.observations.get(editId);
        if (cancelled) return;
        if (!o || o.childId !== active.id) { nav("/history"); return; }
        orig.current = o;
        seededWhen.current = toLocalInput(new Date(o.startedAt));
        setStartedAt(o.startedAt);
        setBaseline(o.baseline);
        setMinutesAgo(0);
        setCustomAt(seededWhen.current);
        setScores(o.scores);
        setDuration(o.durationMinutes);
        setZones(o.bodyZones);
        setCause(o.suspectedCause);
        setInterventions(o.interventions);
        setNote(o.note);
      } else {
        // New observation: "Now" is the wizard-open instant, pinned here so
        // autosave/save keep it even if the form sits open for hours.
        setStartedAt(Date.now());
      }
      if (cancelled || !key) return;
      const d = await loadDraft(key);
      if (cancelled) return;
      if (d) setOffer(d);
      setOfferSeen(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, editId]);

  // Capture the seeded baseline for the dirty check once the form is
  // populated (edit mode) — autosave only kicks in on real changes.
  useEffect(() => {
    if (offerSeen && !seeded.current) seeded.current = JSON.stringify({ ...fields, savedAt: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerSeen]);

  // Autosave — only after any draft offer is resolved, and only when the
  // form actually differs from what it was seeded with.
  useEffect(() => {
    if (!key || !offerSeen || offer) return;
    if (JSON.stringify(fields) === seeded.current) return;
    // The draft records the instant pinned by the last explicit "when"
    // change — recomputing it here would let clock drift shift the episode.
    saveDraft(key, { ...fields, savedAt: Date.now() })
      .then(() => setDraftFailed(false))
      .catch(() => setDraftFailed(true));
  }, [key, offerSeen, offer, fields]);

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
      ...(editId ? { id: editId } : {}),
      childId: active.id,
      // Edit mode: an untouched "when" keeps the original absolute
      // timestamp — a note-only correction must not move the episode.
      startedAt: editId && orig.current && customAt === seededWhen.current
        ? orig.current.startedAt
        : startedAt ?? (customAt ? Math.min(new Date(customAt).getTime(), Date.now()) : Date.now() - minutesAgo * 60_000),
      recordedAt: editId && orig.current ? orig.current.recordedAt : Date.now(),
      scores: scores as FlaccScores,
      total,
      durationMinutes: duration,
      bodyZones: zones,
      suspectedCause: cause.trim(),
      interventions,
      note: note.trim(),
      baseline,
    };
    try {
      // The write and its draft cleanup commit or roll back together.
      await db.transaction("rw", [db.observations, db.settings], async () => {
        if (editId) await db.observations.put(obs);
        else await db.observations.add(obs);
        if (key) await clearDraft(key);
      });
      nav("/history");
    } catch {
      setSaving(false);
      setSaveError(t("observe.saveError"));
    }
  }

  function resume() {
    if (!offer) return;
    setStep(offer.step);
    setBaseline(offer.baseline);
    // Restore the pinned absolute instant, not the relative "N minutes
    // ago" that would re-anchor against resume time.
    let restored: number | null = null;
    if (offer.startedAt != null) {
      // datetime-local displays only minutes; the pinned instant keeps
      // the exact ms so a resumed save preserves it.
      restored = offer.startedAt;
      setCustomAt(toLocalInput(new Date(offer.startedAt)));
      setMinutesAgo(0);
    } else {
      const ms = offer.customAt ? new Date(offer.customAt).getTime() : NaN;
      restored = Number.isFinite(ms) ? ms : null;
      setMinutesAgo(offer.minutesAgo);
      setCustomAt(offer.customAt);
    }
    setStartedAt(restored);
    setScores(offer.scores);
    setDuration(offer.duration);
    setZones(offer.zones);
    setCause(offer.cause);
    setInterventions(offer.interventions as Intervention[]);
    setNote(offer.note);
    // The resumed state becomes the new baseline for dirty-checking —
    // expressed in the fields' own shape (no startedAt, resolved when).
    seeded.current = JSON.stringify({
      ...offer, savedAt: 0,
      startedAt: restored,
      customAt: offer.startedAt != null ? toLocalInput(new Date(offer.startedAt)) : offer.customAt,
      minutesAgo: offer.startedAt != null ? 0 : offer.minutesAgo,
    });
    setOffer(null);
  }

  function discard() {
    if (key) void clearDraft(key).catch(() => setDraftFailed(true));
    setOffer(null);
  }

  if (!active) return null;

  return (
    <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
      {/* Named step rail — progress you can read, not a bare fraction. */}
      <nav aria-label={t("observe.stepsLabel")} className="hidden lg:block">
        <ol className="sticky top-10 space-y-0.5">
          {STEP_KEYS.map((k, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <li
                key={k}
                aria-current={current ? "step" : undefined}
                className={`flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm
                  ${current ? "bg-teal-50 font-semibold text-teal-800" : done ? "text-neutral-700" : "text-neutral-600"}`}
              >
                <span
                  aria-hidden
                  className={`grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold
                    ${done ? "border-teal-700 bg-teal-700 text-white" : current ? "border-teal-700 text-teal-800" : "border-neutral-300 text-neutral-500"}`}
                >
                  {done ? "✓" : i + 1}
                </span>
                {t(k)}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="min-w-0 space-y-6">
      <div ref={stepHeading} tabIndex={-1}>
        <h1 className="page-title">{editId ? t("observe.editTitle") : t("observe.start")}</h1>
        <p className="mt-1 text-[15px] font-medium text-neutral-600">
          {t(STEP_KEYS[step])} ·{" "}
          <span className="tabular-nums" role="status">
            {step + 1}/{STEPS}
          </span>
        </p>
      </div>
      <div className="h-1 rounded-full bg-neutral-200 overflow-hidden">
        <div
          className="h-1 rounded-full bg-teal-700 transition-all duration-300 ease-out"
          style={{ width: `${((step + 1) / STEPS) * 100}%` }}
        />
      </div>

      {offer && (
        <div className="card p-4 flex items-center justify-between gap-3" role="group" aria-labelledby="draft-title">
          <p id="draft-title" className="text-sm font-medium text-neutral-700">{t("observe.draftPrompt")}</p>
          <div className="flex gap-2">
            <button type="button" className="btn-primary text-sm px-3 py-1.5" onClick={resume}>{t("observe.resume")}</button>
            <button type="button" className="btn-ghost text-sm px-3 py-1.5" onClick={discard}>{t("observe.discard")}</button>
          </div>
        </div>
      )}

      <div key={step} className="step-in space-y-6">
      {step === 0 && (
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="label">{t("observe.baselineQ")}</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setBaseline(false)}
                aria-pressed={!baseline}
                className={`card p-4 text-left font-semibold transition-all duration-150 ${!baseline ? "!border-orange-300 !bg-orange-50 text-orange-800" : "text-neutral-600"}`}
              >
                <span className="mr-1.5 inline-block size-2.5 rounded-full bg-orange-400 align-middle" />
                {t("observe.episode")}
              </button>
              <button
                type="button"
                onClick={() => setBaseline(true)}
                aria-pressed={baseline}
                className={`card p-4 text-left font-semibold transition-all duration-150 ${baseline ? "!border-emerald-300 !bg-emerald-50 text-emerald-700" : "text-neutral-600"}`}
              >
                <span className="mr-1.5 inline-block size-2.5 rounded-full bg-emerald-400 align-middle" />
                {t("observe.baseline")}
              </button>
            </div>
            {baseline && <p className="text-[13px] text-neutral-600">{t("observe.baselineHint")}</p>}
          </div>
          <div className="space-y-2">
            <p className="label">{t("observe.when")}</p>
            <div className="flex flex-wrap gap-2">
              {[0, 15, 30, 60, 120].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMinutesAgo(m); setCustomAt(null); setStartedAt(Date.now() - m * 60_000); }}
                  aria-pressed={minutesAgo === m && customAt === null}
                  className={`btn-ghost text-[15px] ${minutesAgo === m && customAt === null ? "border border-teal-700 !bg-teal-50 text-teal-800" : ""}`}
                >
                  {m === 0 ? t("observe.now") : t("observe.minutesAgo", { n: m })}
                </button>
              ))}
              <button
                type="button"
                onClick={() => { if (customAt === null) { const now = Date.now(); setCustomAt(toLocalInput(new Date(now))); setStartedAt(now); } }}
                aria-pressed={customAt !== null}
                className={`btn-ghost text-[15px] ${customAt !== null ? "border border-teal-700 !bg-teal-50 text-teal-800" : ""}`}
              >
                {t("observe.pickTime")}
              </button>
            </div>
            {customAt !== null && (
              <input
                type="datetime-local"
                aria-label={t("observe.pickTime")}
                className="input text-sm w-full"
                value={customAt}
                max={toLocalInput(new Date())}
                onChange={(e) => {
                  const v = e.target.value === "" ? null : e.target.value;
                  setCustomAt(v);
                  const ms = v ? new Date(v).getTime() : NaN;
                  setStartedAt(Number.isFinite(ms) ? ms : null);
                }}
              />
            )}
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
                  aria-pressed={duration === m}
                  className={`btn-ghost text-[15px] ${duration === m ? "border border-teal-700 !bg-teal-50 text-teal-800" : ""}`}
                >
                  {m} min
                </button>
              ))}
              <button
                type="button"
                onClick={() => setDuration(null)}
                aria-pressed={duration === null}
                className={`btn-ghost text-[15px] ${duration === null ? "border border-teal-700 !bg-teal-50 text-teal-800" : ""}`}
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
            <p className="label">{t("observe.tried")} <span className="font-normal text-neutral-600">{t("observe.didHelp")}</span></p>
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
                      aria-pressed={!!it}
                      className={`flex-1 text-left text-sm min-h-11 flex items-center py-2 ${it ? "text-teal-700 font-semibold" : "text-neutral-600"}`}
                    >
                      {it ? "✓ " : ""}{t(`interventions.${type}`)}
                    </button>
                    {it && (
                      <div className="flex gap-1.5">
                        {(["yes", "no", "unsure"] as const).map((h) => (
                          <button
                            key={h}
                            type="button"
                            onClick={() =>
                              setInterventions((iv) =>
                                iv.map((x) => (x.type === type ? { ...x, helped: h } : x)),
                              )
                            }
                            aria-pressed={it.helped === h}
                            className={`rounded-lg px-3 py-2 text-sm min-h-10
                              ${it.helped === h ? "bg-teal-700 text-white font-semibold" : "bg-neutral-100 border border-neutral-300 text-neutral-600"}`}
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
        {saveError && <p className="text-sm text-red-700 text-center w-full" role="alert">{saveError}</p>}
        {draftFailed && <p className="text-sm text-red-700 text-center w-full" role="alert">{t("observe.draftSaveFailed")}</p>}
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
            {saving ? t("common.loading") : editId ? t("observe.update") : t("observe.save")}
          </button>
        )}
      </div>
      </div>
    </div>
  );
}
