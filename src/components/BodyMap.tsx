import { BODY_ZONES } from "../flacc";
import { useTranslation } from "react-i18next";

interface Props {
  selected: string[];
  onToggle: (zoneId: string) => void;
}

// A simple symmetric figure, front view. Zones are large tap targets,
// intentionally coarse — a parent taps "roughly ear", not "left pinna".
const FIGURE: { id: string; x: number; y: number; w: number; h: number; rx: number }[] = [
  { id: "head", x: 40, y: 4, w: 20, h: 14, rx: 6 },
  { id: "ears", x: 36, y: 8, w: 28, h: 5, rx: 2 },
  { id: "mouth", x: 45, y: 14, w: 10, h: 3, rx: 1 },
  { id: "throat", x: 46, y: 18, w: 8, h: 4, rx: 2 },
  { id: "chest", x: 40, y: 22, w: 20, h: 12, rx: 4 },
  { id: "stomach", x: 40, y: 34, w: 20, h: 12, rx: 4 },
  { id: "bottom", x: 40, y: 46, w: 20, h: 8, rx: 4 },
  { id: "arm_l", x: 26, y: 22, w: 11, h: 22, rx: 4 },
  { id: "arm_r", x: 63, y: 22, w: 11, h: 22, rx: 4 },
  { id: "hand_l", x: 26, y: 45, w: 11, h: 9, rx: 4 },
  { id: "hand_r", x: 63, y: 45, w: 11, h: 9, rx: 4 },
  { id: "leg_l", x: 41, y: 55, w: 8, h: 24, rx: 3 },
  { id: "leg_r", x: 51, y: 55, w: 8, h: 24, rx: 3 },
  { id: "foot_l", x: 39, y: 80, w: 10, h: 6, rx: 2 },
  { id: "foot_r", x: 51, y: 80, w: 10, h: 6, rx: 2 },
  { id: "back", x: 40, y: 22, w: 20, h: 24, rx: 4 },
  { id: "skin", x: 28, y: 56, w: 8, h: 8, rx: 2 },
];

export function BodyMap({ selected, onToggle }: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <svg
        viewBox="0 0 100 90"
        className="mx-auto w-32 shrink-0 sm:w-36"
        aria-hidden="true"
      >
        {FIGURE.filter((z) => z.id !== "back").map((z) => {
          const sel = selected.includes(z.id);
          return (
            <rect
              key={z.id}
              x={z.x}
              y={z.y}
              width={z.w}
              height={z.h}
              rx={z.rx}
              onClick={() => onToggle(z.id)}
              className={`cursor-pointer transition-colors stroke-2
                ${sel ? "fill-orange-400/70 stroke-orange-500" : "fill-neutral-100 stroke-neutral-400 hover:fill-neutral-200"}`}
            >
              <title>{t(`zones.${z.id}`)}</title>
            </rect>
          );
        })}
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
              className={`rounded-xl border px-3 py-2.5 min-h-11 text-left text-sm leading-tight transition
                ${sel ? "bg-orange-100 text-orange-800 border-orange-300 font-medium" : "bg-[#fffdfa] text-neutral-700 border-neutral-300 hover:bg-neutral-100"}`}
            >
              {t(`zones.${z.id}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
