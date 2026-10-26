import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useApp } from "../appContext";
import { seedDemo } from "../demo";
import { importAll } from "../export";
import { isRtl, LANGS, LANG_LABEL, setLang, type Lang } from "../i18n";

export default function Onboarding() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const { refresh } = useApp();
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function exploreDemo() {
    setLoadingDemo(true);
    await seedDemo();
    await refresh();
    nav("/");
  }

  async function restore(file: File) {
    setRestoreError(null);
    try {
      await importAll(await file.text());
      await refresh();
      nav("/");
    } catch {
      setRestoreError(t("onboarding.restoreError"));
    }
  }
  return (
    <div className="pt-10 space-y-8">
      {/* A wrong-detected language shouldn't trap first-run users — the
          settings select is unreachable until a child exists. */}
      <div className="flex justify-center">
        <select
          className="input sm:max-w-[16rem]"
          value={i18n.language}
          onChange={(e) => setLang(e.target.value as Lang)}
          aria-label={t("settings.language")}
        >
          {LANGS.map((l) => (
            <option key={l} value={l} lang={l} dir={isRtl(l) ? "rtl" : "ltr"}>
              {LANG_LABEL[l]}
            </option>
          ))}
        </select>
      </div>
      <div className="text-center space-y-3">
        <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="mx-auto size-24 rounded-3xl" />
        <h1 className="text-3xl font-bold leading-tight">{t("onboarding.title")}</h1>
        <p className="text-neutral-600 text-sm font-medium tracking-wide">{t("app.tagline")}</p>
      </div>
      <p className="text-neutral-600 leading-relaxed">{t("onboarding.body")}</p>
      <ul className="space-y-2">
        {(t("onboarding.points", { returnObjects: true }) as string[]).map((p, i) => (
          <li key={i} className="flex gap-3 text-sm text-neutral-600">
            <span className="text-accent-700">✓</span> {p}
          </li>
        ))}
      </ul>
      <p className="text-[13px] text-neutral-600 border-s-2 border-neutral-300 ps-3">{t("onboarding.notdiagnosis")}</p>
      <div className="space-y-3 pt-2">
        <button type="button" className="btn-primary w-full" onClick={() => void nav("/child/new")}>
          {t("onboarding.cta")}
        </button>
        <button type="button" className="btn-ghost w-full" disabled={loadingDemo} onClick={() => void exploreDemo()}>
          {loadingDemo ? t("common.loading") : t("onboarding.demo")}
        </button>
        <button type="button" className="btn-ghost w-full text-sm" onClick={() => fileRef.current?.click()}>
          {t("onboarding.restore")}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void restore(f); }}
        />
        {restoreError && <p className="text-sm text-red-700 text-center" role="alert">{restoreError}</p>}
      </div>
    </div>
  );
}
