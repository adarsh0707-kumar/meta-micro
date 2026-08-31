import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { automationsApi, templatesApi } from "../api/api";

const CATEGORIES = [
  { key: "fee_reminder", labelKey: "fee_reminders" },
  { key: "parent_update", labelKey: "parent_updates" },
];

export default function Automations() {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState([]);
  const [settings, setSettings] = useState({});
  const [saving, setSaving] = useState("");

  const load = async () => {
    const [templatesRes, automationsRes] = await Promise.all([templatesApi.list(), automationsApi.list()]);
    setTemplates(templatesRes.data);
    const map = {};
    automationsRes.data.forEach((a) => { map[a.category] = a; });
    CATEGORIES.forEach((c) => {
      if (!map[c.key]) map[c.key] = { category: c.key, enabled: false, day_of_month: 1, template_id: null };
    });
    setSettings(map);
  };

  useEffect(() => {
    load();
  }, []);

  const update = (category, patch) => {
    setSettings((prev) => ({ ...prev, [category]: { ...prev[category], ...patch } }));
  };

  const save = async (category) => {
    setSaving(category);
    const s = settings[category];
    await automationsApi.upsert({
      category,
      enabled: s.enabled,
      day_of_month: Number(s.day_of_month),
      template_id: s.template_id ? Number(s.template_id) : null,
    });
    setSaving("");
    load();
  };

  return (
    <div>
      <h1 className="mb-6 text-h2">{t("nav.automations")}</h1>
      <p className="mb-6 max-w-xl text-ink/70">
        Automatically send WhatsApp messages every month on a chosen day. Fee-reminder automations
        message every student with a due or overdue fee; parent-update automations message every
        active student.
      </p>

      <div className="grid gap-6 sm:grid-cols-2">
        {CATEGORIES.map(({ key, labelKey }) => {
          const s = settings[key];
          if (!s) return null;
          const options = templates.filter((tpl) => tpl.category === key);
          return (
            <div key={key} className="card">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-h4">{t(`nav.${labelKey}`)}</h3>
                <label className="inline-flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={s.enabled} onChange={(e) => update(key, { enabled: e.target.checked })} />
                  <span className="text-sm font-semibold">{s.enabled ? "Enabled" : "Disabled"}</span>
                </label>
              </div>

              <label className="label">Template</label>
              <select
                className="input mb-4"
                value={s.template_id || ""}
                onChange={(e) => update(key, { template_id: e.target.value })}
              >
                <option value="">Select a template…</option>
                {options.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>{tpl.name} ({tpl.language})</option>
                ))}
              </select>

              <label className="label">Day of month to send</label>
              <input
                type="number"
                min={1}
                max={28}
                className="input mb-4"
                value={s.day_of_month}
                onChange={(e) => update(key, { day_of_month: e.target.value })}
              />

              <button type="button" className="btn-primary" onClick={() => save(key)} disabled={saving === key}>
                {saving === key ? t("common.loading") : t("common.save")}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
