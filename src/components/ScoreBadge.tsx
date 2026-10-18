import { useTranslation } from "react-i18next";
import { bandFor } from "../types";
import { BAND_TEXT } from "../flacc";
import { scaleLang } from "../i18n";

export function ScoreBadge({ total, big }: { total: number; big?: boolean }) {
  const { t, i18n } = useTranslation();
  const sl = scaleLang();
  const band = bandFor(total);
  return (
    <div className={`flex items-center gap-2 ${big ? "flex-col gap-1" : ""}`}>
      <span
        className={`font-semibold tabular-nums ${big ? "text-4xl" : "text-lg"} ${BAND_TEXT[band]}`}
      >
        {total}
        <span className={`font-normal text-neutral-600 ${big ? "text-xl" : "text-[13px]"}`}>/10</span>
      </span>
      <span className={`${big ? "text-[15px]" : "text-[13px]"} font-medium ${BAND_TEXT[band]}`} lang={sl !== i18n.language ? sl : undefined} dir={sl !== i18n.language ? "ltr" : undefined}>
        {t(`band.${band}`)}
      </span>
    </div>
  );
}
