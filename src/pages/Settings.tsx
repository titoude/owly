import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "../appContext";
import { db, getSetting, setSetting } from "../db";
import { clearDemo, seedDemo } from "../demo";
import { deleteAll, exportAll, importAll, inspectBackup, type BackupSummary } from "../export";
import { newPinRecord } from "../pin";
import type { Child } from "../types";
import { intlLocale, LANGS, LANG_LABEL, setLang, isRtl, type Lang } from "../i18n";

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
  const importDlgRef = useRef<HTMLDialogElement>(null);
  const importBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!pendingImport) return;
    const dlg = importDlgRef.current;
    if (dlg && !dlg.open) dlg.showModal();
    // The native file picker steals the pre-dialog focus slot, so
    // showModal()'s own restore can land on <body>. Pin the trigger.
    return () => importBtnRef.current?.focus();
  }, [pendingImport]);
  const [obsCount, setObsCount] = useState(0);

  useEffect(() => {
    void getSetting<string>("passcode").then((p) => setPinSet(!!p));
  }, []);

  // Refresh the "current" counts shown in the replacement preview whenever
  // children change (import, demo load/clear, wipe) — never trust a stale mount value.
  useEffect(() => {
    void db.observations.count().then(setObsCount);
  }, [children]);

  // ?demo=1 auto-seed (from onboarding)
  useEffect(() => {
    if (params.get("demo") === "1") void loadDemo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  function changeLang(l: Lang) {
    setLang(l);
  }

  async function setPasscode() {
    if (pin.length !== 4) return;
    await setSetting("passcode", await newPinRecord(pin));
    setPin("");
    setPinSet(true);
    setMsg({ text: t("settings.pinSaved"), error: false });
    // Arm the lock immediately — not "on next open". The storage write
    // reaches already-open tabs; the event arms this one.
    try { localStorage.setItem("owly-lock-signal", String(Date.now())); } catch { /* storage denied — this tab still locks */ }
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
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="page-title">{t("settings.title")}</h1>

      <section className="card p-4 space-y-3">
        <h2 className="section-title">{t("settings.children")}</h2>
        {children.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => void setActive(c.id!)}
              className={`min-w-0 flex-1 min-h-11 rounded-lg px-2 py-1.5 text-start text-[15px] transition-colors hover:bg-neutral-50 ${c.id === active?.id ? "font-semibold text-accent-700" : "text-neutral-700"}`}
            >
              <span dir="auto" className="break-words">{c.name}</span>{" "}
              {c.isDemo ? (
                <span className="ms-1 rounded-full bg-amber-100 px-2 py-0.5 text-[13px] font-semibold text-amber-800">
                  {t("app.demoBadgeShort")}
                </span>
              ) : null}
            </button>
            <Link
              to={`/child/${c.id}/edit`}
              className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm font-medium text-neutral-700 underline-offset-2 hover:bg-neutral-50 hover:text-accent-700 hover:underline"
            >
              {t("common.edit")}
            </Link>
          </div>
        ))}
        <Link to="/child/new" className="btn-ghost block text-center">{t("settings.addChild")}</Link>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="section-title">{t("settings.language")}</h2>
        {/* One compact native select for 9 locales — keeps each label in its
            own lang/dir and stays readable at 320px. */}
        <select
          className="input w-full sm:max-w-xs"
          value={i18n.language}
          onChange={(e) => changeLang(e.target.value as Lang)}
          aria-label={t("settings.language")}
        >
          {LANGS.map((l) => (
            <option key={l} value={l} lang={l} dir={isRtl(l) ? "rtl" : "ltr"}>
              {LANG_LABEL[l]}
            </option>
          ))}
        </select>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="section-title">{t("settings.pin")}</h2>
        <p className="text-[13px] text-neutral-600">{t("settings.pinBody")}</p>
        {pinSet ? (
          <button type="button" className="btn-ghost w-full" onClick={() => void clearPasscode()}>{t("settings.pinRemove")}</button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              className="input !w-24 shrink-0 text-center tracking-[0.4em]"
              aria-label={t("settings.pin")}
              placeholder="••••"
            />
            <button type="button" className="btn-ghost flex-1 whitespace-nowrap" disabled={pin.length !== 4} onClick={() => void setPasscode()}>
              {t("settings.pinSet")}
            </button>
          </div>
        )}
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="section-title">{t("settings.data")}</h2>
        <button type="button" className="btn-ghost w-full" onClick={() => void doExport()}>{t("settings.export")}</button>
        <button ref={importBtnRef} type="button" className="btn-ghost w-full" onClick={() => fileRef.current?.click()}>{t("settings.import")}</button>
        <p className="text-[13px] text-neutral-600">{t("settings.importWarn")}</p>
        <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void pickImport(f); }} />
        {pendingImport && (
          // Native dialog: showModal() supplies focus entry, Tab containment,
          // Escape cancellation and focus restoration. role=alertdialog keeps
          // the assertive announcement semantics on top.
          <dialog
            ref={importDlgRef}
            role="alertdialog"
            aria-labelledby="import-preview-title"
            onCancel={() => setPendingImport(null)}
            className="m-auto rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2 w-full max-w-sm backdrop:bg-neutral-900/40"
          >
            <p id="import-preview-title" className="text-sm font-semibold text-amber-900">{t("settings.importPreviewTitle")}</p>
            <p className="text-[13px] text-amber-900">
              {t("settings.importPreview", {
                children: pendingImport.summary.children,
                observations: pendingImport.summary.observations,
                date: pendingImport.summary.exportedAt ? new Date(pendingImport.summary.exportedAt).toLocaleDateString(intlLocale()) : "?",
                curChildren: children.length,
                curObs: obsCount,
              })}
            </p>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost flex-1 text-sm" onClick={() => setPendingImport(null)}>{t("common.cancel")}</button>
              <button type="button" className="flex-1 rounded-xl bg-amber-800 py-2 text-sm font-semibold text-white" onClick={() => void doImport()}>
                {t("settings.importConfirm")}
              </button>
            </div>
          </dialog>
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
        <h2 className="section-title">{t("settings.demo")}</h2>
        <p className="text-[13px] text-neutral-600">{t("settings.demoBody")}</p>
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

      <section className="card p-4 space-y-3">
        <h2 className="section-title">{t("settings.about")}</h2>
        <div>
          <h3 className="text-sm font-semibold">{t("settings.privacy")}</h3>
          <p className="text-sm text-neutral-600 leading-relaxed">{t("settings.privacyBody")}</p>
        </div>
        <p className="text-sm text-neutral-600">{t("settings.license")}</p>
      </section>

      {msg && <p className={`text-center text-sm ${msg.error ? "text-red-700" : "text-accent-700"}`} role={msg.error ? "alert" : "status"}>{msg.text}</p>}
    </div>
  );
}
