import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { templatesApi } from "../api/api";
import Modal from "../components/Modal";

const emptyForm = { name: "", category: "fee_reminder", language: "en", body: "" };
const PLACEHOLDER_HELP = "Use {student_name}, {parent_name}, {monthly_fee}, {institute_name} as placeholders.";

export default function Templates() {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    const { data } = await templatesApi.list();
    setTemplates(data);
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await templatesApi.create(form);
    setModalOpen(false);
    setForm(emptyForm);
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this template?")) return;
    await templatesApi.remove(id);
    load();
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h2">{t("nav.templates")}</h1>
        <button type="button" className="btn-primary" onClick={() => setModalOpen(true)}>
          + {t("common.add")}
        </button>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {templates.map((tpl) => (
          <div key={tpl.id} className="card">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-h4">{tpl.name}</h3>
              <button type="button" onClick={() => handleDelete(tpl.id)} className="text-sm font-semibold text-primary hover:underline">
                {t("common.delete")}
              </button>
            </div>
            <div className="mb-3 flex gap-2">
              <span className="badge bg-accent/25 text-ink capitalize">{tpl.category.replace("_", " ")}</span>
              <span className="badge bg-muted text-ink/60 uppercase">{tpl.language}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-ink/70">{tpl.body}</p>
          </div>
        ))}
        {templates.length === 0 && <p className="text-ink/50">No templates yet.</p>}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={`${t("common.add")} ${t("nav.templates")}`}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">{t("common.name")}</label>
            <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="fee_reminder">Fee reminder</option>
                <option value="parent_update">Parent update</option>
              </select>
            </div>
            <div>
              <label className="label">{t("common.language")}</label>
              <select className="input" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
                <option value="en">English</option>
                <option value="hi">Hindi</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Message</label>
            <textarea required rows={5} className="input" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            <p className="mt-1 text-xs text-ink/50">{PLACEHOLDER_HELP}</p>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>{t("common.cancel")}</button>
            <button type="submit" className="btn-primary">{t("common.save")}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
