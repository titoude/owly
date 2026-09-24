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
      <legend className="text-lg font-semibold text-neutral-100">{t(`flacc.${category}`)}</legend>
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
              className={`w-full text-left rounded-2xl border px-4 py-3.5 min-h-12 transition-all duration-150
                ${sel
                  ? "border-teal-400/70 bg-teal-400/[0.13] text-neutral-50 shadow-[0_0_0_3px_rgba(45,212,191,0.15)]"
                  : "border-white/[0.07] bg-white/[0.04] text-neutral-300 hover:border-white/20 hover:bg-white/[0.07]"}`}
            >
              <span className="flex items-center gap-3">
                <span
                  className={`shrink-0 grid place-items-center size-8 rounded-full font-bold text-sm
                  ${sel ? "bg-teal-400 text-neutral-950" : "bg-white/[0.08] text-neutral-400"}`}
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
