import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { attendanceApi, batchesApi, studentsApi } from "../api/api";

const today = () => new Date().toISOString().slice(0, 10);
const STATUSES = ["present", "absent", "late"];

export default function Attendance() {
  const { t } = useTranslation();
  const [batches, setBatches] = useState([]);
  const [batchId, setBatchId] = useState("");
  const [date, setDate] = useState(today());
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    batchesApi.list().then(({ data }) => {
      setBatches(data);
      if (data.length) setBatchId(String(data[0].id));
    });
  }, []);

  useEffect(() => {
    if (!batchId) return;
    (async () => {
      setSaved(false);
      const [studentsRes, attendanceRes] = await Promise.all([
        studentsApi.list({ batch_id: batchId }),
        attendanceApi.list({ batch_id: batchId, on_date: date }),
      ]);
      setStudents(studentsRes.data);
      const existing = {};
      attendanceRes.data.forEach((a) => { existing[a.student_id] = a.status; });
      const defaults = {};
      studentsRes.data.forEach((s) => { defaults[s.id] = existing[s.id] || "present"; });
      setMarks(defaults);
    })();
  }, [batchId, date]);

  const handleSubmit = async () => {
    await attendanceApi.submit({
      batch_id: Number(batchId),
      date,
      entries: Object.entries(marks).map(([student_id, status]) => ({ student_id: Number(student_id), status })),
    });
    setSaved(true);
  };

  return (
    <div>
      <h1 className="mb-6 text-h2">{t("nav.attendance")}</h1>

      <div className="mb-6 flex flex-wrap gap-4">
        <select className="input max-w-xs" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
          {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <input type="date" className="input max-w-xs" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[480px] text-left">
          <thead>
            <tr className="border-b-2 border-ink/10 text-sm text-ink/60">
              <th className="px-5 py-3">{t("common.name")}</th>
              <th className="px-5 py-3">{t("common.status")}</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-b border-ink/5 last:border-0">
                <td className="px-5 py-3 font-semibold">{s.name}</td>
                <td className="px-5 py-3">
                  <div className="flex gap-2">
                    {STATUSES.map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setMarks({ ...marks, [s.id]: status })}
                        className={`badge capitalize ${marks[s.id] === status ? "bg-primary text-white" : "bg-muted text-ink/60"}`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr><td colSpan={2} className="px-5 py-8 text-center text-ink/50">No students in this batch.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {students.length > 0 && (
        <div className="mt-6 flex items-center gap-4">
          <button type="button" className="btn-primary" onClick={handleSubmit}>Submit attendance</button>
          {saved && <span className="font-semibold text-primary">Saved ✓</span>}
        </div>
      )}
    </div>
  );
}
