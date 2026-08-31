import { useTranslation } from "react-i18next";

import { setLanguage } from "../i18n/i18n";

export default function LanguageToggle({ className = "" }) {
  const { i18n } = useTranslation();

  return (
    <div className={`inline-flex rounded-full border-2 border-ink/15 bg-surface p-1 ${className}`}>
      {["en", "hi"].map((lng) => (
        <button
          key={lng}
          type="button"
          onClick={() => setLanguage(lng)}
          className={`rounded-full px-3 py-1 text-sm font-heading font-semibold transition-colors ${
            i18n.language === lng ? "bg-primary text-white" : "text-ink/60 hover:text-ink"
          }`}
        >
          {lng === "en" ? "EN" : "हिं"}
        </button>
      ))}
    </div>
  );
}
