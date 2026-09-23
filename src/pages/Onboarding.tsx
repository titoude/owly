import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

export default function Onboarding() {
  const { t } = useTranslation();
  const nav = useNavigate();
  return (
    <div className="pt-10 space-y-8">
      <div className="text-center space-y-3">
        <div className="text-6xl">🦉</div>
        <h1 className="text-3xl font-bold leading-tight">{t("onboarding.title")}</h1>
        <p className="text-slate-400 text-sm font-medium tracking-wide">{t("app.tagline")}</p>
      </div>
      <p className="text-slate-300 leading-relaxed">{t("onboarding.body")}</p>
      <ul className="space-y-2">
        {(t("onboarding.points", { returnObjects: true }) as string[]).map((p, i) => (
          <li key={i} className="flex gap-3 text-sm text-slate-300">
            <span className="text-teal-400">✓</span> {p}
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-500 border-l-2 border-slate-700 pl-3">{t("onboarding.notdiagnosis")}</p>
      <div className="space-y-3 pt-2">
        <button type="button" className="btn-primary w-full" onClick={() => void nav("/child/new")}>
          {t("onboarding.cta")}
        </button>
        <button type="button" className="btn-ghost w-full" onClick={() => void nav("/settings?demo=1")}>
          {t("onboarding.demo")}
        </button>
      </div>
    </div>
  );
}
