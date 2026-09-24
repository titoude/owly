import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../appContext";
import { db } from "../db";
import { FLACC_CATEGORIES, type Child, type CustomDescriptors } from "../types";

const EMPTY_DESC: CustomDescriptors = { face: "", legs: "", activity: "", cry: "", consolability: "" };

export default function ChildForm() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { id } = useParams();
  const { refresh, setActive } = useApp();
  const [name, setName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [conditions, setConditions] = useState("");
  const [communicates, setCommunicates] = useState("");
  const [desc, setDesc] = useState<CustomDescriptors>(EMPTY_DESC);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    void db.children.get(Number(id)).then((c) => {
      if (!c) return;
      setName(c.name);
      setBirthYear(c.birthYear?.toString() ?? "");
      setConditions(c.conditions);
      setCommunicates(c.communicates);
      setDesc({ ...EMPTY_DESC, ...c.customDescriptors });
    });
  }, [id]);

  async function save() {
    setSaving(true);
    const payload = {
      name: name.trim(),
      birthYear: birthYear ? Number(birthYear) : null,
      conditions: conditions.trim(),
      communicates: communicates.trim(),
      customDescriptors: desc,
      passcodeHash: null,
    };
    let childId: number;
    if (id) {
      childId = Number(id);
      await db.children.update(childId, payload);
    } else {
      childId = (await db.children.add({ ...payload, createdAt: Date.now() } as Child)) as number;
    }
    await refresh();
    await setActive(childId);
    nav("/");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">{t("child.title")}</h1>
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="name">{t("child.name")}</label>
          <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="by">{t("child.birthYear")}</label>
          <input
            id="by"
            className="input"
            inputMode="numeric"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
          />
        </div>
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
      </div>

      <div className="card p-4 space-y-3">
        <h2 className="font-semibold">{t("customDescriptors.title", { name: name || "…" })}</h2>
        <p className="text-xs text-neutral-400">{t("customDescriptors.body")}</p>
        {FLACC_CATEGORIES.map((c) => (
          <div key={c}>
            <label className="label text-xs" htmlFor={`d-${c}`}>{t(`flacc.${c}`)}</label>
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

      <button type="button" className="btn-primary w-full" disabled={!name.trim() || saving} onClick={() => void save()}>
        {saving ? t("common.loading") : t("child.create")}
      </button>
    </div>
  );
}
