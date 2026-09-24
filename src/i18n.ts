import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import fr from "./locales/fr.json";

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr } },
  lng: localStorage.getItem("owly-lang") ?? (navigator.language.startsWith("fr") ? "fr" : "en"),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

document.documentElement.lang = i18n.language;
i18n.on("languageChanged", (l) => {
  document.documentElement.lang = l;
});

export function setLang(lang: "en" | "fr") {
  localStorage.setItem("owly-lang", lang);
  void i18n.changeLanguage(lang);
}

export default i18n;
