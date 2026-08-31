import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import Character from "../components/Character";
import LanguageToggle from "../components/LanguageToggle";

const FEATURES = [
  { key: "fees", icon: "💰" },
  { key: "attendance", icon: "✅" },
  { key: "scores", icon: "📝" },
  { key: "whatsapp", icon: "📲" },
];

export default function Landing() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📚</span>
          <span className="font-heading text-h4">{t("app_name")}</span>
        </div>
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <Link to="/login" className="hidden font-heading font-semibold text-ink hover:text-primary sm:block">
            {t("auth.login_link")}
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-10 md:grid-cols-2 md:py-20">
        <div className="animate-[fadeInUp_0.6s_ease-out]">
          <p className="mb-4 inline-block rounded-full bg-accent/30 px-4 py-1 font-body text-sm font-semibold text-ink">
            {t("landing.eyebrow")}
          </p>
          <h1 className="text-h1 text-ink">{t("landing.title")}</h1>
          <p className="mt-5 max-w-md text-lg text-ink/70">{t("landing.subtitle")}</p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link to="/signup" className="btn-primary text-lg">
              {t("landing.cta")} →
            </Link>
            <Link to="/login" className="btn-secondary text-lg">
              {t("landing.cta_secondary")}
            </Link>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md motion-safe:animate-[popIn_0.7s_ease-out]">
          <Character className="w-full drop-shadow-xl transition-transform duration-500 hover:scale-105 hover:-rotate-1" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.key} className="card transition-transform hover:-translate-y-1">
              <div className="mb-3 text-3xl">{f.icon}</div>
              <h3 className="text-h4">{t(`landing.feature_${f.key}`)}</h3>
              <p className="mt-2 text-sm text-ink/70">{t(`landing.feature_${f.key}_desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes popIn { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; }
        }
      `}</style>
    </div>
  );
}
