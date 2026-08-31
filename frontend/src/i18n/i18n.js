import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import hi from "./locales/hi.json";

const storedLanguage = (() => {
  try {
    return localStorage.getItem("meta_micro_lang");
  } catch {
    return null;
  }
})();

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, hi: { translation: hi } },
  lng: storedLanguage || "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export function setLanguage(lang) {
  i18n.changeLanguage(lang);
  try {
    localStorage.setItem("meta_micro_lang", lang);
  } catch {
    // ignore storage errors (private browsing, etc.)
  }
}

export default i18n;
