import type { ReactNode } from "react";
import { BODY_ZONES } from "../flacc";
import { useTranslation } from "react-i18next";

interface Props {
  selected: string[];
  onToggle: (zoneId: string) => void;
}

// Front-view human figure in the app's stroke language: one silhouette
// outline over soft zone highlights. The text chips below stay the primary
// controls — zones are intentionally coarse tap regions.
const HEAD = { cx: 50, cy: 14, r: 8.5 };
const BODY_PATH =
  "M50 22 C41 22 34.5 24.5 31.5 29.5 L27.5 51.5 C26.6 55 29.3 56.8 30.8 55.2 " +
  "L35 39.5 L37.5 58 L39.8 101 C39.9 105 41.6 107.5 44.5 107.5 L46.3 107.5 " +
  "C46.8 107.5 47.3 104.5 47.5 67 L52.5 67 C52.7 104.5 53.2 107.5 53.7 107.5 " +
  "L55.5 107.5 C58.4 107.5 60.1 105 60.2 101 L62.5 58 L65 39.5 L69.2 55.2 " +
  "C70.7 56.8 73.4 55 72.5 51.5 L68.5 29.5 C65.5 24.5 59 22 50 22 Z";

const ZONES: Record<string, ReactNode> = {
  head: <circle cx={50} cy={14} r={10} />,
  ears: (
    <>
      <ellipse cx={41.5} cy={14} rx={2.6} ry={3.2} />
      <ellipse cx={58.5} cy={14} rx={2.6} ry={3.2} />
    </>
  ),
  mouth: <ellipse cx={50} cy={17} rx={3.4} ry={2.2} />,
  throat: <rect x={46} y={22.5} width={8} height={4.5} rx={2.2} />,
  chest: <ellipse cx={50} cy={42} rx={13} ry={7.5} />,
  stomach: <ellipse cx={50} cy={53} rx={11.5} ry={6.5} />,
  bottom: <ellipse cx={50} cy={62} rx={10} ry={4.5} />,
  back: <ellipse cx={50} cy={47} rx={12.5} ry={11} />,
  arm_l: <rect x={25.5} y={30} width={7.5} height={24} rx={3.75} transform="rotate(6 29 42)" />,
  arm_r: <rect x={67} y={30} width={7.5} height={24} rx={3.75} transform="rotate(-6 71 42)" />,
  hand_l: <circle cx={29} cy={54} r={4.2} />,
  hand_r: <circle cx={71} cy={54} r={4.2} />,
  leg_l: <rect x={40.5} y={67} width={7} height={35} rx={3.5} />,
  leg_r: <rect x={52.5} y={67} width={7} height={35} rx={3.5} />,
  foot_l: <ellipse cx={43} cy={104.5} rx={5} ry={3} />,
  foot_r: <ellipse cx={57} cy={104.5} rx={5} ry={3} />,
  skin: <circle cx={63} cy={63} r={5} />,
  whole: (
    <>
      <circle cx={HEAD.cx} cy={HEAD.cy} r={HEAD.r} />
      <path d={BODY_PATH} />
    </>
  ),
};

export function BodyMap({ selected, onToggle }: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <svg
        viewBox="0 0 100 114"
        className="mx-auto w-32 shrink-0 sm:w-36"
        aria-hidden="true"
      >
        {/* Clickable highlight regions under the silhouette. */}
        {(Object.keys(ZONES) as (keyof typeof ZONES)[]).map((id) => (
          <g
            key={id}
            onClick={() => onToggle(id)}
            className={`cursor-pointer transition-colors ${
              selected.includes(id) ? "fill-accent-500/40" : "fill-transparent hover:fill-neutral-500/15"
            }`}
          >
            <title>{t(`zones.${id}`)}</title>
            {ZONES[id]}
          </g>
        ))}
        {/* Silhouette outline — decorative top layer. */}
        <g
          className="fill-none stroke-neutral-600"
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
        >
          <circle cx={HEAD.cx} cy={HEAD.cy} r={HEAD.r} />
          <path d={BODY_PATH} />
        </g>
      </svg>
      {/* No nested scroll: the page scrolls, all zones stay visible. */}
      <div className="flex-1 grid grid-cols-2 gap-2">
        {BODY_ZONES.map((z) => {
          const sel = selected.includes(z.id);
          return (
            <button
              key={z.id}
              type="button"
              onClick={() => onToggle(z.id)}
              aria-pressed={sel}
              className={`rounded-xl border px-3 py-2.5 min-h-11 text-start text-sm leading-tight transition
                ${sel ? "bg-accent-50 text-accent-800 border-accent-600 font-medium" : "bg-white text-neutral-700 border-neutral-500 hover:bg-neutral-100 hover:border-neutral-600"}`}
            >
              {t(`zones.${z.id}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
