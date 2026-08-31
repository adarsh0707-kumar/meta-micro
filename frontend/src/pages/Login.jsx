import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import LanguageToggle from "../components/LanguageToggle";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(form.email, form.password);
      navigate("/app/students");
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed. Please check your credentials.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">📚</span>
            <span className="font-heading text-h4">{t("app_name")}</span>
          </Link>
          <LanguageToggle />
        </div>

        <div className="card">
          <h1 className="text-h3">{t("auth.login_title")}</h1>
          <p className="mt-1 text-ink/60">{t("auth.login_subtitle")}</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
                className="input"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>

            {error && <p className="text-sm font-medium text-primary">{error}</p>}

            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? t("common.loading") : t("auth.login_button")}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink/60">
            {t("auth.no_account")}{" "}
            <Link to="/signup" className="font-semibold text-primary">
              {t("auth.sign_up_link")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
