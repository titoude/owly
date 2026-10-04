import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { Observation } from "../types";
import { bandFor } from "../types";
import { BAND_TEXT } from "../flacc";
import { fmtMinutes, intlLocale, scaleLang } from "../i18n";

const DAY = 86_400_000;

function dayLabel(ts: number, loc: string, t: (k: string) => string): string {
  const d = new Date(ts);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(today) - startOf(d)) / DAY);
  if (diff === 0) return t("common.today");
  if (diff === 1) return t("common.yesterday");
  return d.toLocaleDateString(loc, { weekday: "short", day: "numeric", month: "short" });
}

/** One journal row — compact date+time, score + severity, and the recorded
    details (real notes, zones, duration) on shared alignment columns. */
export function ObsRow({ o, to }: { o: Observation; to: string }) {
  const { t, i18n } = useTranslation();
  const loc = intlLocale();
  const sl = scaleLang();
  const band = bandFor(o.total);
  const started = new Date(o.startedAt);
  const details = [
    o.note || null,
    o.bodyZones.length ? o.bodyZones.map((z) => t(`zones.${z}`)).join(", ") : null,
    o.durationMinutes != null ? fmtMinutes(o.durationMinutes) : null,
    o.suspectedCause || null,
  ].filter(Boolean).join(" · ");

  return (
    <Link
      to={to}
      className="-mx-2 grid grid-cols-[5.5rem_auto_minmax(0,1fr)] items-center gap-x-4 rounded-lg px-2 py-2.5 transition-colors hover:bg-neutral-50"
    >
      <span className="leading-tight">
        <span className="block truncate text-[13px] font-medium text-neutral-600">{dayLabel(o.startedAt, loc, t)}</span>
        <span className="block text-[13px] tabular-nums text-neutral-600">
          {started.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" })}
        </span>
      </span>
      <span className="flex items-baseline gap-1.5 whitespace-nowrap">
        <span className="text-[15px] font-semibold tabular-nums text-neutral-900">
          {o.total}
          <span className="text-[13px] font-normal text-neutral-600">/10</span>
        </span>
        <span className={`text-[13px] font-medium ${BAND_TEXT[band]}`} lang={sl !== i18n.language ? sl : undefined} dir={sl !== i18n.language ? "ltr" : undefined}>
          {t(`band.${band}`)}
        </span>
      </span>
      <span className="min-w-0 truncate text-[13px] text-neutral-600 text-start" dir="auto">
        {details}
        {o.baseline && <span className="ms-2 text-emerald-700">· {t("history.baseline")}</span>}
      </span>
    </Link>
  );
}
