import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { instituteApi, messagingApi } from "../api/api";
import { useAuth } from "../context/AuthContext";

function Card({ title, description, children }) {
  return (
    <div className="card mb-6">
      <h2 className="mb-1 text-h4">{title}</h2>
      {description && <p className="mb-4 text-sm text-ink/60">{description}</p>}
      {children}
    </div>
  );
}

export default function Settings() {
  const { t } = useTranslation();
  const { user, institute, refreshMe } = useAuth();
  const isAdmin = user?.role === "admin";

  const [instituteForm, setInstituteForm] = useState({ name: "", city: "", default_language: "en" });
  const [profileForm, setProfileForm] = useState({ name: "", phone: "" });
  const [passwordForm, setPasswordForm] = useState({ current_password: "", new_password: "" });
  const [provider, setProvider] = useState(null);
  const [testPhone, setTestPhone] = useState("");
  const [testResult, setTestResult] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (institute) {
      setInstituteForm({
        name: institute.name,
        city: institute.city,
        default_language: institute.default_language,
      });
    }
  }, [institute]);

  useEffect(() => {
    if (user) setProfileForm({ name: user.name, phone: user.phone || "" });
  }, [user]);

  useEffect(() => {
    messagingApi.providerStatus().then(({ data }) => setProvider(data));
  }, []);

  const run = async (fn, successMessage) => {
    setNotice(null);
    try {
      await fn();
      setNotice({ ok: true, text: successMessage });
      await refreshMe();
    } catch (err) {
      setNotice({ ok: false, text: err.response?.data?.detail || "Something went wrong." });
    }
  };

  const handleTestSend = async (e) => {
    e.preventDefault();
    setTestResult(null);
    try {
      const { data } = await messagingApi.testSend({ to_phone: testPhone });
      setTestResult({ ok: data.success, data });
    } catch (err) {
      setTestResult({ ok: false, text: err.response?.data?.detail || "Test send failed." });
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-h2">{t("nav.settings")}</h1>

      {notice && (
        <div className={`card mb-6 border-2 ${notice.ok ? "border-accent" : "border-primary bg-primary/5"}`}>
          <p className={`font-semibold ${notice.ok ? "text-ink" : "text-primary"}`}>{notice.text}</p>
        </div>
      )}

      {isAdmin && (
        <Card title={t("settings.institute")} description={t("settings.institute_desc")}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => instituteApi.update(instituteForm), t("settings.saved"));
            }}
          >
            <div>
              <label className="label">{t("settings.institute_name")}</label>
              <input
                className="input"
                required
                value={instituteForm.name}
                onChange={(e) => setInstituteForm({ ...instituteForm, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">{t("settings.city")}</label>
              <input
                className="input"
                value={instituteForm.city}
                onChange={(e) => setInstituteForm({ ...instituteForm, city: e.target.value })}
              />
            </div>
            <div>
              <label className="label">{t("settings.default_language")}</label>
              <select
                className="input"
                value={instituteForm.default_language}
                onChange={(e) => setInstituteForm({ ...instituteForm, default_language: e.target.value })}
              >
                <option value="en">English</option>
                <option value="hi">हिन्दी</option>
              </select>
            </div>
            <button type="submit" className="btn-primary">
              {t("common.save")}
            </button>
          </form>
        </Card>
      )}

      <Card title={t("settings.profile")} description={t("settings.profile_desc")}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => instituteApi.updateProfile({ name: profileForm.name, phone: profileForm.phone || null }),
              t("settings.saved")
            );
          }}
        >
          <div>
            <label className="label">{t("staff.name")}</label>
            <input
              className="input"
              required
              value={profileForm.name}
              onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">{t("staff.phone")}</label>
            <input
              className="input"
              value={profileForm.phone}
              onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
            />
          </div>
          <button type="submit" className="btn-primary">
            {t("common.save")}
          </button>
        </form>
      </Card>

      <Card title={t("settings.password")}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await instituteApi.changePassword(passwordForm);
              setPasswordForm({ current_password: "", new_password: "" });
            }, t("settings.password_changed"));
          }}
        >
          <div>
            <label className="label">{t("settings.current_password")}</label>
            <input
              className="input"
              type="password"
              required
              value={passwordForm.current_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
            />
          </div>
          <div>
            <label className="label">{t("settings.new_password")}</label>
            <input
              className="input"
              type="password"
              required
              minLength={8}
              value={passwordForm.new_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
            />
          </div>
          <button type="submit" className="btn-primary">
            {t("settings.change_password")}
          </button>
        </form>
      </Card>

      {isAdmin && (
        <Card title={t("settings.whatsapp")} description={t("settings.whatsapp_desc")}>
          {provider && (
            <div
              className={`mb-4 rounded-2xl border-2 p-4 ${
                provider.would_really_send ? "border-accent bg-accent/10" : "border-ink/15 bg-muted/40"
              }`}
            >
              <p className="font-semibold">
                {provider.would_really_send ? t("settings.wa_live") : t("settings.wa_not_live")}
              </p>
              <p className="mt-1 text-sm text-ink/70">{provider.detail}</p>
            </div>
          )}

          <form onSubmit={handleTestSend} className="space-y-3">
            <label className="label">{t("settings.test_number")}</label>
            <input
              className="input"
              required
              placeholder="+91 90000 00000"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
            />
            <p className="text-sm text-ink/50">{t("settings.test_hint")}</p>
            <button type="submit" className="btn-secondary">
              {t("settings.send_test")}
            </button>
          </form>

          {testResult && (
            <div className="mt-4 rounded-2xl border-2 border-ink/10 p-4 text-sm">
              {testResult.text ? (
                <p className="font-semibold text-primary">{testResult.text}</p>
              ) : (
                <>
                  {/* "Sent" must mean a phone actually rang. With the log
                      provider nothing leaves the server, so say so plainly. */}
                  <p className="font-semibold">
                    {!testResult.ok
                      ? t("settings.test_failed")
                      : testResult.data.would_really_send
                        ? t("settings.test_ok")
                        : t("settings.test_recorded")}
                  </p>
                  <p className="mt-1 text-ink/60">
                    {testResult.data.would_really_send ? t("settings.sent_to") : t("settings.would_go_to")}:{" "}
                    {testResult.data.to_phone}
                  </p>
                  {!testResult.data.would_really_send && (
                    <p className="mt-2 text-ink/70">{t("settings.test_recorded_hint")}</p>
                  )}
                  <p className="mt-1 break-all text-ink/50">{testResult.data.provider_response}</p>
                </>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
