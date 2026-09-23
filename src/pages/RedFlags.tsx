import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

export default function RedFlags() {
  const { t } = useTranslation();
  const nav = useNavigate();
  return (
    <div className="space-y-6 pt-4">
      <div className="text-center space-y-2">
        <div className="text-5xl">🚨</div>
        <h1 className="text-2xl font-bold text-red-400">{t("redflags.title")}</h1>
      </div>
      <p className="text-slate-300">{t("redflags.body")}</p>
      <ul className="space-y-3">
        {(t("redflags.items", { returnObjects: true }) as string[]).map((item, i) => (
          <li key={i} className="card p-4 flex gap-3 text-slate-200">
            <span className="text-red-400 font-bold">!</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-slate-400 italic">{t("redflags.footer")}</p>
      <button type="button" className="btn-ghost w-full" onClick={() => void nav(-1)}>
        {t("redflags.understood")}
      </button>
    </div>
  );
}
