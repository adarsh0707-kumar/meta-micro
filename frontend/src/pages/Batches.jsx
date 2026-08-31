import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { batchesApi } from "../api/api";
import Modal from "../components/Modal";

const emptyForm = { name: "", subject: "", schedule_days: "", timing: "", monthly_fee: "" };

export default function Batches() {
  const { t } = useTranslation();
  const [batches, setBatches] = useState([]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);

  const load = async (searchTerm = "") => {
    setLoading(true);
    const { data } = await batchesApi.list(searchTerm ? { search: searchTerm } : {});
    setBatches(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await batchesApi.create({ ...form, monthly_fee: form.monthly_fee ? Number(form.monthly_fee) : null });
    setModalOpen(false);
    setForm(emptyForm);
    load(search);
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h2">{t("nav.batches")}</h1>
        <button type="button" className="btn-primary" onClick={() => setModalOpen(true)}>
          + {t("common.add")}
        </button>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); load(search); }}
        className="mb-6 flex max-w-md gap-2"
      >
        <input className="input" placeholder={t("common.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
        <button type="submit" className="btn-secondary">{t("common.search")}</button>
      </form>

      {loading ? (
        <p className="text-ink/60">{t("common.loading")}</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {batches.map((b) => (
            <Link to={`/app/batches/${b.id}`} key={b.id} className="card block transition-transform hover:-translate-y-1">
              <h3 className="text-h4">{b.name}</h3>
              <p className="mt-1 text-sm text-ink/60">{b.subject || "—"}</p>
              <p className="mt-3 text-sm text-ink/70">{b.schedule_days || "—"} · {b.timing || "—"}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="badge bg-accent/25 text-ink">{b.student_count} students</span>
                {b.monthly_fee && <span className="font-heading font-bold text-primary">₹{b.monthly_fee}</span>}
              </div>
            </Link>
          ))}
          {batches.length === 0 && <p className="text-ink/50">No batches yet.</p>}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={`${t("common.add")} ${t("nav.batches")}`}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">{t("common.name")}</label>
            <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Subject</label>
            <input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Schedule days</label>
              <input className="input" placeholder="Mon-Fri" value={form.schedule_days} onChange={(e) => setForm({ ...form, schedule_days: e.target.value })} />
            </div>
            <div>
              <label className="label">Timing</label>
              <input className="input" placeholder="4-6 PM" value={form.timing} onChange={(e) => setForm({ ...form, timing: e.target.value })} />
            </div>
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
