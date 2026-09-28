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
  const custom = child.customDescriptors?.[category];

  return (
    <fieldset className="space-y-2">
      <legend className="text-lg font-semibold text-neutral-900">{t(`flacc.${category}`)}</legend>
      {custom ? (
        <p className="text-sm text-teal-700 italic">
          {t("observe.theirs", { name: child.name })} {custom}
        </p>
      ) : null}
      <div className="space-y-2">
        {cat.descriptors.map((d, score) => {
          const sel = value === score;
          return (
            // Native radio input: arrow-key navigation, roving tab stop and
            // AT semantics come for free — no custom keyboard handler needed.
            <label key={score} className="block cursor-pointer">
              <input
                type="radio"
                name={`flacc-${category}`}
                value={score}
                checked={sel}
                onChange={() => onChange(score)}
                className="sr-only peer"
              />
              <span
                className={`flex items-center gap-3 w-full text-left rounded-2xl border px-4 py-3.5 min-h-12 transition-all duration-150
                  peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-teal-700
                  ${sel
                    ? "border-teal-700 bg-teal-50 text-neutral-900 shadow-[0_0_0_3px_rgba(45,212,191,0.15)]"
                    : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-100"}`}
              >
                <span
                  className={`shrink-0 grid place-items-center size-8 rounded-full font-bold text-sm
                  ${sel ? "bg-teal-700 text-white" : "bg-neutral-200 text-neutral-600"}`}
                >
                  {score}
                </span>
                <span className="text-sm leading-snug">{t(`flaccDesc.${category}.${score}`, d)}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
