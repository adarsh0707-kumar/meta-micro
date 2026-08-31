import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { batchesApi, studentsApi, testScoresApi } from "../api/api";
import Modal from "../components/Modal";

const emptyForm = { student_id: "", test_name: "", subject: "", max_marks: "", marks_obtained: "", test_date: new Date().toISOString().slice(0, 10), remarks: "" };

export default function TestScores() {
  const { t } = useTranslation();
  const [batches, setBatches] = useState([]);
  const [batchId, setBatchId] = useState("");
  const [students, setStudents] = useState([]);
  const [scores, setScores] = useState([]);
  const [report, setReport] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    batchesApi.list().then(({ data }) => {
      setBatches(data);
      if (data.length) setBatchId(String(data[0].id));
    });
  }, []);

  const load = async (id) => {
    if (!id) return;
    const [studentsRes, scoresRes, reportRes] = await Promise.all([
      studentsApi.list({ batch_id: id }),
      testScoresApi.list({ batch_id: id }),
      testScoresApi.report(id),
    ]);
    setStudents(studentsRes.data);
    setScores(scoresRes.data);
    setReport(reportRes.data);
  };

  useEffect(() => {
    load(batchId);
  }, [batchId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await testScoresApi.create({
      ...form,
      batch_id: Number(batchId),
      student_id: Number(form.student_id),
      max_marks: Number(form.max_marks),
      marks_obtained: Number(form.marks_obtained),
    });
    setModalOpen(false);
    setForm(emptyForm);
    load(batchId);
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h2">{t("nav.test_scores")}</h1>
        <button type="button" className="btn-primary" onClick={() => setModalOpen(true)} disabled={!batchId}>
          + {t("common.add")}
        </button>
      </div>

      <select className="input mb-6 max-w-xs" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
        {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>

      <h2 className="mb-3 text-h4">Report card</h2>
      <div className="card mb-8 overflow-x-auto p-0">
        <table className="w-full min-w-[480px] text-left">
          <thead>
            <tr className="border-b-2 border-ink/10 text-sm text-ink/60">
              <th className="px-5 py-3">{t("common.name")}</th>
              <th className="px-5 py-3">Tests taken</th>
              <th className="px-5 py-3">Total</th>
              <th className="px-5 py-3">%</th>
            </tr>
          </thead>
          <tbody>
            {report.map((r) => (
              <tr key={r.student_id} className="border-b border-ink/5 last:border-0">
                <td className="px-5 py-3 font-semibold">{r.student_name}</td>
                <td className="px-5 py-3">{r.tests_taken}</td>
                <td className="px-5 py-3">{r.total_obtained} / {r.total_max}</td>
                <td className="px-5 py-3"><span className="badge bg-accent/25 text-ink">{r.percentage}%</span></td>
              </tr>
            ))}
            {report.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-ink/50">No test scores yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mb-3 text-h4">All entries</h2>
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[560px] text-left">
          <thead>
            <tr className="border-b-2 border-ink/10 text-sm text-ink/60">
              <th className="px-5 py-3">{t("common.name")}</th>
              <th className="px-5 py-3">Test</th>
              <th className="px-5 py-3">Marks</th>
              <th className="px-5 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((s) => (
              <tr key={s.id} className="border-b border-ink/5 last:border-0">
                <td className="px-5 py-3">{s.student_name}</td>
                <td className="px-5 py-3">{s.test_name}</td>
                <td className="px-5 py-3">{s.marks_obtained} / {s.max_marks}</td>
                <td className="px-5 py-3">{s.test_date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={`${t("common.add")} ${t("nav.test_scores")}`}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Student</label>
            <select required className="input" value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })}>
              <option value="">Select…</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Test name</label>
            <input required className="input" value={form.test_name} onChange={(e) => setForm({ ...form, test_name: e.target.value })} />
          </div>
          <div>
            <label className="label">Subject</label>
            <input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Max marks</label>
              <input type="number" required className="input" value={form.max_marks} onChange={(e) => setForm({ ...form, max_marks: e.target.value })} />
            </div>
            <div>
              <label className="label">Marks obtained</label>
              <input type="number" required className="input" value={form.marks_obtained} onChange={(e) => setForm({ ...form, marks_obtained: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Test date</label>
            <input type="date" required className="input" value={form.test_date} onChange={(e) => setForm({ ...form, test_date: e.target.value })} />
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
