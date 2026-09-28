import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import fr from "./locales/fr.json";
import es from "./locales/es.json";
import pt from "./locales/pt.json";
import de from "./locales/de.json";
import it from "./locales/it.json";
import ar from "./locales/ar.json";
import hi from "./locales/hi.json";
import zhCN from "./locales/zh-CN.json";

export const LANGS = ["en", "fr", "es", "pt", "de", "it", "ar", "hi", "zh-CN"] as const;
export type Lang = (typeof LANGS)[number];

// Display name for each language picker (self-named, so users recognize it).
export const LANG_LABEL: Record<Lang, string> = {
  en: "English",
  fr: "Français",
  es: "Español",
  pt: "Português",
  de: "Deutsch",
  it: "Italiano",
  ar: "العربية",
  hi: "हिन्दी",
  "zh-CN": "简体中文",
};

// BCP-47 locale used for Intl.* formatting (dates, times, numbers).
export const INTL_LOCALE: Record<Lang, string> = {
  en: "en-GB",
  fr: "fr-FR",
  es: "es-ES",
  pt: "pt-PT",
  de: "de-DE",
  it: "it-IT",
  ar: "ar-EG",
  hi: "hi-IN",
  "zh-CN": "zh-CN",
};

const RTL_LANGS: ReadonlySet<string> = new Set(["ar"]);

export function isRtl(lang: string): boolean {
  return RTL_LANGS.has(lang);
}

function detected(): Lang {
  const nav = navigator.language.toLowerCase();
  if (nav.startsWith("zh")) return "zh-CN"; // all zh → Simplified for now
  const base = nav.split("-")[0];
  const hit = (LANGS as readonly string[]).find((l) => l.toLowerCase() === base);
  return (hit as Lang | undefined) ?? "en";
}

const saved = localStorage.getItem("owly-lang") as Lang | null;
const initial: Lang = saved && (LANGS as readonly string[]).includes(saved) ? saved : detected();

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fr: { translation: fr },
    es: { translation: es },
    pt: { translation: pt },
    de: { translation: de },
    it: { translation: it },
    ar: { translation: ar },
    hi: { translation: hi },
    "zh-CN": { translation: zhCN },
  },
  lng: initial,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

function applyDir(l: string) {
  document.documentElement.lang = l;
  document.documentElement.dir = RTL_LANGS.has(l) ? "rtl" : "ltr";
}
applyDir(i18n.language);
i18n.on("languageChanged", applyDir);

export function setLang(lang: Lang) {
  localStorage.setItem("owly-lang", lang);
  void i18n.changeLanguage(lang);
}

/** BCP-47 locale for Intl formatting in the current language. */
export function intlLocale(): string {
  return INTL_LOCALE[(i18n.language as Lang) in INTL_LOCALE ? (i18n.language as Lang) : "en"];
}

/**
 * Language the FLACC scale wording is actually rendered in.
 * Licensed English ships everywhere; French has a pre-existing internal
 * (unvalidated) translation. Other locales fall back to English — mark the
 * rendered element with lang so screen readers use the right pronunciation.
 */
export function scaleLang(): "en" | "fr" {
  return i18n.language === "fr" ? "fr" : "en";
}

export default i18n;
