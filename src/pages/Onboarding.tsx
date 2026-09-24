import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useApp } from "../appContext";
import { seedDemo } from "../demo";

export default function Onboarding() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { refresh } = useApp();
  const [loadingDemo, setLoadingDemo] = useState(false);

  async function exploreDemo() {
    setLoadingDemo(true);
    await seedDemo();
    await refresh();
    nav("/");
  }
  return (
    <div className="pt-10 space-y-8">
      <div className="text-center space-y-3">
        <img src="/icon.svg" alt="" className="mx-auto size-24 rounded-3xl" />
        <h1 className="text-3xl font-bold leading-tight">{t("onboarding.title")}</h1>
        <p className="text-neutral-500 text-sm font-medium tracking-wide">{t("app.tagline")}</p>
      </div>
      <p className="text-neutral-500 leading-relaxed">{t("onboarding.body")}</p>
      <ul className="space-y-2">
        {(t("onboarding.points", { returnObjects: true }) as string[]).map((p, i) => (
          <li key={i} className="flex gap-3 text-sm text-neutral-500">
            <span className="text-teal-600">✓</span> {p}
          </li>
        ))}
      </ul>
      <p className="text-xs text-neutral-500 border-l-2 border-neutral-300 pl-3">{t("onboarding.notdiagnosis")}</p>
      <div className="space-y-3 pt-2">
        <button type="button" className="btn-primary w-full" onClick={() => void nav("/child/new")}>
          {t("onboarding.cta")}
        </button>
        <button type="button" className="btn-ghost w-full" disabled={loadingDemo} onClick={() => void exploreDemo()}>
          {loadingDemo ? t("common.loading") : t("onboarding.demo")}
        </button>
      </div>
    </div>
  );
}
