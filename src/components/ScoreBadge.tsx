import { useTranslation } from "react-i18next";
import { bandFor } from "../types";
import { BAND_TEXT } from "../flacc";

export function ScoreBadge({ total, big }: { total: number; big?: boolean }) {
  const { t } = useTranslation();
  const band = bandFor(total);
  return (
    <div className={`flex items-center gap-2 ${big ? "flex-col gap-1" : ""}`}>
      <span
        className={`font-mono font-bold tabular-nums ${big ? "text-5xl" : "text-xl"} ${BAND_TEXT[band]}`}
      >
        {total}
        <span className="text-neutral-500 text-sm font-normal">/10</span>
      </span>
      <span className={`${big ? "text-base" : "text-xs"} font-medium ${BAND_TEXT[band]}`}>
        {t(`band.${band}`)}
      </span>
    </div>
  );
}
