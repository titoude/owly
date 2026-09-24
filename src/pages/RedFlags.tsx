import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

export default function RedFlags() {
  const { t } = useTranslation();
  const nav = useNavigate();
  return (
    <div className="space-y-6 pt-4">
      <div className="text-center space-y-2">
        <div className="mx-auto grid place-items-center size-16 rounded-full bg-red-500/15 border border-red-400/40">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400" aria-hidden>
            <path d="M12 3.5 2.5 20h19L12 3.5Z" />
            <path d="M12 10v4.5" />
            <path d="M12 17.5v.01" strokeWidth="2.6" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-red-400">{t("redflags.title")}</h1>
      </div>
      <p className="text-neutral-300">{t("redflags.body")}</p>
      <ul className="space-y-3">
        {(t("redflags.items", { returnObjects: true }) as string[]).map((item, i) => (
          <li key={i} className="card p-4 flex gap-3 text-neutral-200">
            <span className="text-red-400 font-bold">!</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-neutral-400 italic">{t("redflags.footer")}</p>
      <button type="button" className="btn-ghost w-full" onClick={() => void nav(-1)}>
        {t("redflags.understood")}
      </button>
    </div>
  );
}
