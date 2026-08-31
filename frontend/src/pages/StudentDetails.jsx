import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";

import { batchesApi, studentsApi } from "../api/api";

export default function StudentDetails() {
  const { t } = useTranslation();
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [batches, setBatches] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [studentRes, batchesRes] = await Promise.all([
        studentsApi.get(studentId),
        batchesApi.list(),
      ]);
      setForm(studentRes.data);
      setBatches(batchesRes.data);
    })();
  }, [studentId]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    await studentsApi.update(studentId, {
      ...form,
      batch_id: form.batch_id ? Number(form.batch_id) : null,
      monthly_fee: form.monthly_fee ? Number(form.monthly_fee) : null,
    });
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm(`Delete ${form.name}?`)) return;
    await studentsApi.remove(studentId);
    navigate("/app/students");
  };

  if (!form) return <p className="text-ink/60">{t("common.loading")}</p>;

  return (
    <div className="max-w-2xl">
      <Link to="/app/students" className="mb-4 inline-block text-sm font-semibold text-primary">← {t("nav.students")}</Link>
      <h1 className="mb-6 text-h2">{form.name}</h1>

      <form onSubmit={handleSave} className="card space-y-4">
        <div>
          <label className="label">{t("common.name")}</label>
          <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">{t("nav.batches")}</label>
          <select className="input" value={form.batch_id || ""} onChange={(e) => setForm({ ...form, batch_id: e.target.value })}>
            <option value="">—</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Parent name</label>
            <input className="input" value={form.parent_name || ""} onChange={(e) => setForm({ ...form, parent_name: e.target.value })} />
          </div>
          <div>
            <label className="label">Parent WhatsApp number</label>
            <input className="input" value={form.parent_phone || ""} onChange={(e) => setForm({ ...form, parent_phone: e.target.value })} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Student phone</label>
            <input className="input" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="label">Monthly fee (₹)</label>
            <input type="number" className="input" value={form.monthly_fee || ""} onChange={(e) => setForm({ ...form, monthly_fee: e.target.value })} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-ink/80">
          <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
          Active
        </label>

        <div className="flex justify-between pt-2">
          <button type="button" onClick={handleDelete} className="font-semibold text-primary hover:underline">
            {t("common.delete")}
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? t("common.loading") : t("common.save")}
          </button>
        </div>
      </form>
    </div>
  );
}
