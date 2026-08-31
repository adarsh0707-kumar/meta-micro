import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";

import { batchesApi, studentsApi } from "../api/api";

export default function BatchDetails() {
  const { t } = useTranslation();
  const { batchId } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [students, setStudents] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [batchRes, studentsRes] = await Promise.all([
        batchesApi.get(batchId),
        studentsApi.list({ batch_id: batchId }),
      ]);
      setForm(batchRes.data);
      setStudents(studentsRes.data);
    })();
  }, [batchId]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    await batchesApi.update(batchId, { ...form, monthly_fee: form.monthly_fee ? Number(form.monthly_fee) : null });
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm(`Delete ${form.name}? Students will be unassigned.`)) return;
    await batchesApi.remove(batchId);
    navigate("/app/batches");
  };

  if (!form) return <p className="text-ink/60">{t("common.loading")}</p>;

  return (
    <div className="max-w-3xl">
      <Link to="/app/batches" className="mb-4 inline-block text-sm font-semibold text-primary">← {t("nav.batches")}</Link>
      <h1 className="mb-6 text-h2">{form.name}</h1>

      <form onSubmit={handleSave} className="card space-y-4">
        <div>
          <label className="label">{t("common.name")}</label>
          <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Subject</label>
          <input className="input" value={form.subject || ""} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Schedule days</label>
            <input className="input" value={form.schedule_days || ""} onChange={(e) => setForm({ ...form, schedule_days: e.target.value })} />
          </div>
          <div>
            <label className="label">Timing</label>
            <input className="input" value={form.timing || ""} onChange={(e) => setForm({ ...form, timing: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">Monthly fee (₹)</label>
          <input type="number" className="input" value={form.monthly_fee || ""} onChange={(e) => setForm({ ...form, monthly_fee: e.target.value })} />
        </div>
        <div className="flex justify-between pt-2">
          <button type="button" onClick={handleDelete} className="font-semibold text-primary hover:underline">{t("common.delete")}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t("common.loading") : t("common.save")}</button>
        </div>
      </form>

      <h2 className="mb-3 mt-8 text-h4">Students in this batch</h2>
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[480px] text-left">
          <thead>
            <tr className="border-b-2 border-ink/10 text-sm text-ink/60">
              <th className="px-5 py-3">{t("common.name")}</th>
              <th className="px-5 py-3">Parent</th>
              <th className="px-5 py-3">{t("common.phone")}</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-b border-ink/5 last:border-0 hover:bg-muted/40">
                <td className="px-5 py-3">
                  <Link to={`/app/students/${s.id}`} className="font-semibold text-primary hover:underline">{s.name}</Link>
                </td>
                <td className="px-5 py-3">{s.parent_name || "—"}</td>
                <td className="px-5 py-3">{s.parent_phone || s.phone || "—"}</td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr><td colSpan={3} className="px-5 py-8 text-center text-ink/50">No students yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
