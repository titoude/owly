import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../appContext";
import { db } from "../db";
import { clearChildDrafts } from "../drafts";
import { FLACC_CATEGORIES, type Child, type CustomDescriptors } from "../types";
import { scaleLang } from "../i18n";

const EMPTY_DESC: CustomDescriptors = { face: "", legs: "", activity: "", cry: "", consolability: "" };

export default function ChildForm() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const { id } = useParams();
  const { refresh, setActive } = useApp();
  const [name, setName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [conditions, setConditions] = useState("");
  const [communicates, setCommunicates] = useState("");
  const [desc, setDesc] = useState<CustomDescriptors>(EMPTY_DESC);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [yearError, setYearError] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const yearRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    const childId = Number(id);
    // Edit URL guessed or the profile was deleted elsewhere — same
    // redirect Observe uses for a bad id, not a dead-end empty form.
    if (!Number.isInteger(childId)) { nav("/settings"); return; }
    void db.children.get(childId).then((c) => {
      if (!c) { nav("/settings"); return; }
      setName(c.name);
      setBirthYear(c.birthYear?.toString() ?? "");
      setConditions(c.conditions);
      setCommunicates(c.communicates);
      setDesc({ ...EMPTY_DESC, ...c.customDescriptors });
    });
  }, [id, nav]);

  const maxYear = new Date().getFullYear();
  const parsedYear = Number(birthYear);
  const yearValid = birthYear === "" || (Number.isInteger(parsedYear) && parsedYear >= 1900 && parsedYear <= maxYear);
  // Zero-width/format chars are invisible — a name made only of them must
  // not validate. trim() alone doesn't strip them.
  const nameOk = name.replace(/[\u200B-\u200D\uFEFF\u00AD]/g, "").trim().length > 0;

  async function save() {
    if (!yearValid) {
      // Never silently drop an invalid year: flag the field, keep the
      // typed value, and move focus to the error instead of saving.
      setYearError(true);
      yearRef.current?.focus();
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      birthYear: birthYear === "" ? null : parsedYear,
      conditions: conditions.trim(),
      communicates: communicates.trim(),
      customDescriptors: desc,
    };
    try {
      let childId: number;
      if (id) {
        childId = Number(id);
        // update() resolves 0 rows for a child deleted elsewhere — the
        // write silently dropped nothing yet, so surface it like the
        // observer flow's CHILD_GONE instead of reporting success.
        if ((await db.children.update(childId, payload)) === 0) {
          setSaving(false);
          setSaveError(t("child.gone"));
          return;
        }
      } else {
        childId = (await db.children.add({ ...payload, createdAt: Date.now() } as Child)) as number;
      }
      await refresh();
      await setActive(childId);
      nav("/");
    } catch {
      setSaving(false);
      setSaveError(t("child.saveError"));
    }
  }

  async function remove() {
    if (!id) return;
    const childId = Number(id);
    const obsIds = (await db.observations.where("childId").equals(childId).primaryKeys()) as number[];
    await db.transaction("rw", [db.children, db.observations, db.settings], async () => {
      await db.observations.where("childId").equals(childId).delete();
      await db.children.delete(childId);
      await clearChildDrafts(childId, obsIds);
      // Don't leave activeChildId dangling at a deleted profile — point it
      // at the next child (or clear it when none remain).
      const rest = await db.children.orderBy("createdAt").toArray();
      await db.settings.put({ key: "activeChildId", value: rest[0]?.id ?? null });
    });
    await refresh();
    nav("/settings");
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <h1 className="page-title">{id ? t("child.editTitle") : t("child.title")}</h1>
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="name">{t("child.name")}</label>
          <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="by">{t("child.birthYear")}</label>
          <input
            ref={yearRef}
            id="by"
            className={`input ${yearError ? "border-red-500" : ""}`}
            inputMode="numeric"
            value={birthYear}
            aria-invalid={yearError || undefined}
            aria-describedby={yearError ? "by-error" : undefined}
            onChange={(e) => { setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4)); setYearError(false); }}
          />
          {yearError && (
            <p id="by-error" className="mt-1.5 text-[13px] text-red-700" role="alert">
              {t("child.birthYearInvalid", { max: maxYear })}
            </p>
          )}
        </div>
      </div>

      {/* Optional context — grouped so the required identity fields read
          first and the submit action stays adjacent to them. */}
      <fieldset className="min-w-0 space-y-4 rounded-xl border border-neutral-200 p-4">
        <legend className="section-title px-1">{t("child.optionalTitle")}</legend>
        <div>
          <label className="label" htmlFor="cond">{t("child.conditions")}</label>
          <input id="cond" className="input" value={conditions} onChange={(e) => setConditions(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="comm">{t("child.communicates")}</label>
          <input
            id="comm"
            className="input"
            placeholder={t("child.communicatesHint")}
            value={communicates}
            onChange={(e) => setCommunicates(e.target.value)}
          />
        </div>
        <div className="space-y-3 border-t border-neutral-100 pt-4">
          <h2 className="text-sm font-semibold text-neutral-800 break-words">{t("customDescriptors.title", { name: name || "…" })}</h2>
          <p className="text-[13px] text-neutral-600">{t("customDescriptors.body")}</p>
          {FLACC_CATEGORIES.map((c) => (
            <div key={c}>
              <label className="label text-[13px]" htmlFor={`d-${c}`} lang={scaleLang() !== i18n.language ? scaleLang() : undefined} dir={scaleLang() !== i18n.language ? "ltr" : undefined}>{t(`flacc.${c}`)}</label>
              <input
                id={`d-${c}`}
                className="input text-sm"
                placeholder={t("customDescriptors.hint")}
                value={desc[c]}
                onChange={(e) => setDesc((d) => ({ ...d, [c]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </fieldset>

      {saveError && <p className="text-sm text-red-700 text-center" role="alert">{saveError}</p>}
      <button type="button" className="btn-primary w-full" disabled={!nameOk || saving} onClick={() => void save()}>
        {saving ? t("common.loading") : id ? t("common.save") : t("child.create")}
      </button>
      {id && !confirmDel && (
        <button type="button" className="btn-ghost w-full text-red-700" onClick={() => setConfirmDel(true)}>
          {t("child.delete")}
        </button>
      )}
      {id && confirmDel && (
        <div className="rounded-xl border border-red-300 p-3 space-y-2">
          <p className="text-[13px] text-neutral-600">{t("child.deleteConfirm")}</p>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost flex-1 text-sm" onClick={() => setConfirmDel(false)}>
              {t("common.cancel")}
            </button>
            <button type="button" className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-semibold text-white min-h-11" onClick={() => void remove()}>
              {t("common.delete")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
