import { useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet } from "react-router-dom";

import LanguageToggle from "../components/LanguageToggle";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { to: "/app/students", key: "students", icon: "🎓" },
  { to: "/app/batches", key: "batches", icon: "🗂️" },
  { to: "/app/fees", key: "fees", icon: "💰" },
  { to: "/app/attendance", key: "attendance", icon: "✅" },
  { to: "/app/test-scores", key: "test_scores", icon: "📝" },
  { to: "/app/templates", key: "templates", icon: "💬" },
  { to: "/app/fee-reminders", key: "fee_reminders", icon: "📲" },
  { to: "/app/parent-updates", key: "parent_updates", icon: "👪" },
  { to: "/app/automations", key: "automations", icon: "⚙️" },
  { to: "/app/setup", key: "setup", icon: "🚀" },
];

export default function DashboardLayout() {
  const { t } = useTranslation();
  const { user, institute, logout } = useAuth();
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background md:flex">
      <button
        type="button"
        className="btn-secondary m-3 md:hidden"
        onClick={() => setNavOpen((v) => !v)}
      >
        ☰ Menu
      </button>

      <aside
        className={`w-full shrink-0 border-r-2 border-ink/10 bg-surface p-5 md:block md:w-64 ${
          navOpen ? "block" : "hidden"
        }`}
      >
        <div className="mb-6 flex items-center gap-2">
          <span className="text-2xl">📚</span>
          <span className="font-heading text-h4">{t("app_name")}</span>
        </div>
        <p className="mb-4 truncate text-sm text-ink/60">{institute?.name}</p>

        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setNavOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-4 py-2.5 font-body font-medium transition-colors ${
                  isActive ? "bg-primary text-white" : "text-ink/70 hover:bg-muted"
                }`
              }
            >
              <span>{item.icon}</span>
              <span>{t(`nav.${item.key}`)}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-8 border-t-2 border-ink/10 pt-4">
          <LanguageToggle className="mb-4" />
          <p className="mb-2 truncate text-sm text-ink/60">{user?.name} · {user?.role}</p>
          <button type="button" onClick={logout} className="btn-secondary w-full text-sm">
            {t("nav.logout")}
          </button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
