import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { batchesApi, studentsApi } from "../api/api";
import Modal from "../components/Modal";

const emptyForm = { name: "", batch_id: "", parent_name: "", parent_phone: "", phone: "", monthly_fee: "" };

export default function Students() {
  const { t } = useTranslation();
  const [students, setStudents] = useState([]);
  const [batches, setBatches] = useState([]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);

  const load = async (searchTerm = "") => {
    setLoading(true);
    const [studentsRes, batchesRes] = await Promise.all([
      studentsApi.list(searchTerm ? { search: searchTerm } : {}),
      batchesApi.list(),
    ]);
    setStudents(studentsRes.data);
    setBatches(batchesRes.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    load(search);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await studentsApi.create({
      ...form,
      batch_id: form.batch_id ? Number(form.batch_id) : null,
      monthly_fee: form.monthly_fee ? Number(form.monthly_fee) : null,
    });
    setModalOpen(false);
    setForm(emptyForm);
    load(search);
  };

  const batchName = (id) => batches.find((b) => b.id === id)?.name || "—";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h2">{t("nav.students")}</h1>
        <button type="button" className="btn-primary" onClick={() => setModalOpen(true)}>
          + {t("common.add")}
        </button>
      </div>

      <form onSubmit={handleSearch} className="mb-6 flex max-w-md gap-2">
        <input
          className="input"
          placeholder={t("common.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="submit" className="btn-secondary">{t("common.search")}</button>
      </form>

      {loading ? (
        <p className="text-ink/60">{t("common.loading")}</p>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b-2 border-ink/10 text-sm text-ink/60">
                <th className="px-5 py-3">{t("common.name")}</th>
                <th className="px-5 py-3">{t("nav.batches")}</th>
                <th className="px-5 py-3">Parent</th>
                <th className="px-5 py-3">{t("common.phone")}</th>
                <th className="px-5 py-3">{t("common.status")}</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-b border-ink/5 last:border-0 hover:bg-muted/40">
                  <td className="px-5 py-3">
                    <Link to={`/app/students/${s.id}`} className="font-semibold text-primary hover:underline">
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3">{batchName(s.batch_id)}</td>
                  <td className="px-5 py-3">{s.parent_name || "—"}</td>
                  <td className="px-5 py-3">{s.parent_phone || s.phone || "—"}</td>
                  <td className="px-5 py-3">
                    <span className={`badge ${s.is_active ? "bg-primary/10 text-primary" : "bg-muted text-ink/60"}`}>
                      {s.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-ink/50">
                    No students yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={`${t("common.add")} ${t("nav.students")}`}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">{t("common.name")}</label>
            <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">{t("nav.batches")}</label>
            <select
              className="input"
              value={form.batch_id}
              onChange={(e) => setForm({ ...form, batch_id: e.target.value })}
            >
              <option value="">—</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Parent name</label>
            <input className="input" value={form.parent_name} onChange={(e) => setForm({ ...form, parent_name: e.target.value })} />
          </div>
          <div>
            <label className="label">Parent WhatsApp number</label>
            <input className="input" placeholder="+91…" value={form.parent_phone} onChange={(e) => setForm({ ...form, parent_phone: e.target.value })} />
          </div>
          <div>
            <label className="label">Monthly fee (₹)</label>
            <input type="number" className="input" value={form.monthly_fee} onChange={(e) => setForm({ ...form, monthly_fee: e.target.value })} />
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
