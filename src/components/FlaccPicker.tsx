import { FLACC } from "../flacc";
import { useTranslation } from "react-i18next";
import { scaleLang } from "../i18n";
import type { Child, FlaccCategory } from "../types";

interface Props {
  category: FlaccCategory;
  child: Child;
  value: number;
  onChange: (v: number) => void;
}

export function FlaccPicker({ category, child, value, onChange }: Props) {
  const { t, i18n } = useTranslation();
  const cat = FLACC[category];
  const custom = child.customDescriptors?.[category];
  // Scale wording ships in en (published wording; redistribution authorization
  // unverified) and fr (pre-existing internal translation, unvalidated). Other
  // locales fall back to English — mark the foreign-language text so assistive
  // tech pronounces it correctly, and explain the situation once above the options.
  const sl = scaleLang();
  const note = i18n.language === "en" ? null : t("observe.scaleNote");

  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-lg font-semibold text-neutral-900" lang={sl !== i18n.language ? sl : undefined} dir={sl !== i18n.language ? "ltr" : undefined}>{t(`flacc.${category}`)}</legend>
      {note ? <p className="text-[13px] text-neutral-600">{note}</p> : null}
      {custom ? (
        <p className="text-sm text-accent-700 italic break-words">
          {t("observe.theirs", { name: child.name })} <span dir="auto" className="break-words">{custom}</span>
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
                className={`flex items-center gap-3 w-full text-left rounded-xl border px-4 py-3.5 min-h-12 transition-all duration-150
                  peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-700
                  ${sel
                    ? "border-accent-600 bg-accent-50 text-neutral-900"
                    : "border-neutral-500 bg-white text-neutral-700 hover:border-neutral-600"}`}
              >
                <span
                  className={`shrink-0 grid place-items-center size-8 rounded-full font-semibold text-sm tabular-nums
                  ${sel ? "bg-accent-600 text-white" : "bg-neutral-100 text-neutral-600"}`}
                >
                  {score}
                </span>
                <span className="text-[15px] leading-snug" lang={sl !== i18n.language ? sl : undefined} dir={sl !== i18n.language ? "ltr" : undefined}>
                  {t(`flaccDesc.${category}.${score}`, d)}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
