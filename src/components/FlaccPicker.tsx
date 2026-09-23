import { FLACC } from "../flacc";
import { useTranslation } from "react-i18next";
import type { Child, FlaccCategory } from "../types";

interface Props {
  category: FlaccCategory;
  child: Child;
  value: number;
  onChange: (v: number) => void;
}

export function FlaccPicker({ category, child, value, onChange }: Props) {
  const { t } = useTranslation();
  const cat = FLACC[category];
  const custom = child.customDescriptors[category];

  return (
    <fieldset className="space-y-2">
      <legend className="text-lg font-semibold text-slate-100">{t(`flacc.${category}`)}</legend>
      {custom ? (
        <p className="text-sm text-teal-300/90 italic">
          {t("observe.theirs", { name: child.name })} {custom}
        </p>
      ) : null}
      <div className="space-y-2" role="radiogroup">
        {cat.descriptors.map((d, score) => {
          const sel = value === score;
          return (
            <button
              key={score}
              type="button"
              role="radio"
              aria-checked={sel}
              onClick={() => onChange(score)}
              className={`w-full text-left rounded-xl border px-4 py-3.5 min-h-12 transition
                ${sel
                  ? "border-teal-400 bg-teal-500/15 text-slate-100"
                  : "border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-500"}`}
            >
              <span className="flex items-center gap-3">
                <span
                  className={`shrink-0 grid place-items-center size-8 rounded-lg font-bold
                  ${sel ? "bg-teal-500 text-slate-950" : "bg-slate-700 text-slate-300"}`}
                >
                  {score}
                </span>
                <span className="text-sm leading-snug">{t(`flaccDesc.${category}.${score}`, d)}</span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
