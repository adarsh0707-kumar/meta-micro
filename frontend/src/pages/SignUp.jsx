import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import LanguageToggle from "../components/LanguageToggle";
import { useAuth } from "../context/AuthContext";

export default function SignUp() {
  const { t, i18n } = useTranslation();
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    institute_name: "",
    city: "Patna",
    admin_name: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signup({ ...form, default_language: i18n.language });
      navigate("/app/setup");
    } catch (err) {
      setError(err.response?.data?.detail || "Sign up failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">📚</span>
            <span className="font-heading text-h4">{t("app_name")}</span>
          </Link>
          <LanguageToggle />
        </div>

        <div className="card">
          <h1 className="text-h3">{t("auth.signup_title")}</h1>
          <p className="mt-1 text-ink/60">{t("auth.signup_subtitle")}</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="institute_name">{t("auth.institute_name")}</label>
              <input
                id="institute_name"
                required
                className="input"
                value={form.institute_name}
                onChange={(e) => setForm({ ...form, institute_name: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="city">{t("auth.city")}</label>
              <input
                id="city"
                required
                className="input"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="admin_name">{t("auth.admin_name")}</label>
              <input
                id="admin_name"
                required
                className="input"
                value={form.admin_name}
                onChange={(e) => setForm({ ...form, admin_name: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="email">{t("auth.email")}</label>
              <input
                id="email"
                type="email"
                required
                className="input"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="password">{t("auth.password")}</label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                className="input"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>

            {error && <p className="text-sm font-medium text-primary">{error}</p>}

            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? t("common.loading") : t("auth.signup_button")}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink/60">
            {t("auth.have_account")}{" "}
            <Link to="/login" className="font-semibold text-primary">
              {t("auth.login_link")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
