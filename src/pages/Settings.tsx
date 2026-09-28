import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "../appContext";
import { db, getSetting, setSetting } from "../db";
import { clearDemo, seedDemo } from "../demo";
import { deleteAll, exportAll, importAll, inspectBackup, type BackupSummary } from "../export";
import { newPinRecord } from "../pin";
import type { Child } from "../types";

function download(name: string, text: string, type = "application/json") {
  const a = document.createElement("a");
  const url = URL.createObjectURL(new Blob([text], { type }));
  a.href = url;
  a.download = name;
  a.click();
  // Revoke only after the browser has picked up the download —
  // revoking synchronously can abort it in some engines.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { children, active, setActive, refresh } = useApp();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pin, setPin] = useState("");
  const [pinSet, setPinSet] = useState<boolean | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [confirmDemoClear, setConfirmDemoClear] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [pendingImport, setPendingImport] = useState<{ file: File; summary: BackupSummary } | null>(null);
  const [obsCount, setObsCount] = useState(0);

  useEffect(() => {
    void getSetting<string>("passcode").then((p) => setPinSet(!!p));
    void db.observations.count().then(setObsCount);
  }, []);

  // ?demo=1 auto-seed (from onboarding)
  useEffect(() => {
    if (params.get("demo") === "1") void loadDemo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  async function changeLang(l: string) {
    await i18n.changeLanguage(l);
    localStorage.setItem("owly-lang", l);
  }

  async function setPasscode() {
    if (pin.length !== 4) return;
    await setSetting("passcode", await newPinRecord(pin));
    setPin("");
    setPinSet(true);
    setMsg({ text: t("settings.pinSaved"), error: false });
    // Arm the lock immediately — not "on next open".
    window.dispatchEvent(new Event("owly:lock"));
  }

  async function clearPasscode() {
    await setSetting("passcode", null);
    setPinSet(false);
  }

  async function doExport() {
    download(`owly-backup-${new Date().toISOString().slice(0, 10)}.json`, await exportAll());
  }

  // Step 1: validate + summarize the backup before anything is replaced.
  async function pickImport(file: File) {
    try {
      const summary = inspectBackup(await file.text());
      setPendingImport({ file, summary });
    } catch {
      setPendingImport(null);
      setMsg({ text: t("settings.importError"), error: true });
    }
  }

  // Step 2: user confirmed the replacement preview — now actually import.
  async function doImport() {
    if (!pendingImport) return;
    try {
      await importAll(await pendingImport.file.text());
      setPendingImport(null);
      await refresh();
      setMsg({ text: t("settings.imported"), error: false });
    } catch {
      setMsg({ text: t("settings.importError"), error: true });
    }
  }

  async function wipe() {
    await deleteAll();
    setConfirmDel(false);
    await refresh();
    nav("/");
    location.reload();
  }

  async function loadDemo() {
    await seedDemo();
    await refresh();
    setMsg({ text: t("settings.demoLoaded"), error: false });
  }

  const hasDemo = children.some((c: Child) => c.isDemo);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">{t("settings.title")}</h1>

      <section className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-neutral-600">{t("settings.children")}</h2>
        {children.map((c) => (
          <div key={c.id} className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => void setActive(c.id!)}
              className={`text-left ${c.id === active?.id ? "font-semibold text-teal-700" : "text-neutral-600"}`}
            >
              {c.name}{" "}
              {c.isDemo ? (
                <span className="ml-1 rounded-full bg-teal-50 text-teal-700 border border-teal-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                  demo
                </span>
              ) : null}
            </button>
            <Link to={`/child/${c.id}/edit`} className="text-xs text-neutral-600 underline">{t("common.edit")}</Link>
          </div>
        ))}
        <Link to="/child/new" className="btn-ghost block text-center">{t("settings.addChild")}</Link>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-neutral-600">{t("settings.language")}</h2>
        <div className="grid grid-cols-2 gap-2">
          {(["en", "fr"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => void changeLang(l)}
              className={`touch-target rounded-xl font-medium transition-all duration-150 ${
                i18n.language === l
                  ? "bg-teal-700 text-white font-semibold shadow-[0_4px_14px_-4px_rgba(45,212,191,0.5)]"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70"
              }`}
            >
              {l === "en" ? "English" : "Français"}
            </button>
          ))}
        </div>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-neutral-600">{t("settings.pin")}</h2>
        <p className="text-xs text-neutral-600">{t("settings.pinBody")}</p>
        {pinSet ? (
          <button type="button" className="btn-ghost w-full" onClick={() => void clearPasscode()}>{t("settings.pinRemove")}</button>
        ) : (
          <div className="flex gap-2">
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              className="input w-28 text-center tracking-[0.4em]"
              aria-label={t("settings.pin")}
              placeholder="••••"
            />
            <button type="button" className="btn-ghost flex-1" disabled={pin.length !== 4} onClick={() => void setPasscode()}>
              {t("settings.pinSet")}
            </button>
          </div>
        )}
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-neutral-600">{t("settings.data")}</h2>
        <button type="button" className="btn-ghost w-full" onClick={() => void doExport()}>{t("settings.export")}</button>
        <button type="button" className="btn-ghost w-full" onClick={() => fileRef.current?.click()}>{t("settings.import")}</button>
        <p className="text-xs text-neutral-500">{t("settings.importWarn")}</p>
        <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void pickImport(f); }} />
        {pendingImport && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2" role="alertdialog" aria-labelledby="import-preview-title">
            <p id="import-preview-title" className="text-sm font-semibold text-amber-900">{t("settings.importPreviewTitle")}</p>
            <p className="text-xs text-amber-900">
              {t("settings.importPreview", {
                children: pendingImport.summary.children,
                observations: pendingImport.summary.observations,
                date: pendingImport.summary.exportedAt ? new Date(pendingImport.summary.exportedAt).toLocaleDateString(i18n.language === "fr" ? "fr-FR" : "en-GB") : "?",
                curChildren: children.length,
                curObs: obsCount,
              })}
            </p>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost flex-1 text-sm" onClick={() => setPendingImport(null)}>{t("common.cancel")}</button>
              <button type="button" className="flex-1 rounded-xl bg-amber-600 py-2 text-sm font-semibold text-white" onClick={() => void doImport()}>
                {t("settings.importConfirm")}
              </button>
            </div>
          </div>
        )}
        {!confirmDel ? (
          <button type="button" className="btn-ghost w-full text-red-700" onClick={() => setConfirmDel(true)}>{t("settings.deleteAll")}</button>
        ) : (
          <div className="rounded-xl border border-red-500/50 p-3 space-y-2">
            <p className="text-sm text-red-700">{t("settings.deleteConfirm")}</p>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost flex-1" onClick={() => setConfirmDel(false)}>{t("common.cancel")}</button>
              <button type="button" className="flex-1 rounded-xl bg-red-600 py-2 font-semibold text-white" onClick={() => void wipe()}>
                {t("common.delete")}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-neutral-600">{t("settings.demo")}</h2>
        <p className="text-xs text-neutral-600">{t("settings.demoBody")}</p>
        {hasDemo ? (
          !confirmDemoClear ? (
            <button type="button" className="btn-ghost w-full" onClick={() => setConfirmDemoClear(true)}>{t("settings.demoClear")}</button>
          ) : (
            <div className="flex gap-2">
              <button type="button" className="btn-ghost flex-1" onClick={() => setConfirmDemoClear(false)}>{t("common.cancel")}</button>
              <button
                type="button"
                className="flex-1 rounded-xl bg-red-600 py-2 font-semibold text-white"
                onClick={() => void clearDemo().then(refresh).then(() => setConfirmDemoClear(false))}
              >
                {t("common.delete")}
              </button>
            </div>
          )
        ) : (
          <button type="button" className="btn-ghost w-full" onClick={() => void loadDemo()}>{t("settings.demoLoad")}</button>
        )}
      </section>

      <section className="card p-4 space-y-2">
        <h2 className="text-sm font-semibold text-neutral-600">{t("settings.about")}</h2>
        <p className="text-xs text-neutral-600 leading-relaxed">{t("settings.privacy")}</p>
        <p className="text-xs text-neutral-600">{t("settings.license")}</p>
      </section>

      {msg && <p className={`text-center text-sm ${msg.error ? "text-red-700" : "text-teal-700"}`} role={msg.error ? "alert" : "status"}>{msg.text}</p>}
    </div>
  );
}
