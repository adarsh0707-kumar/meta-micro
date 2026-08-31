import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { batchesApi, feesApi } from "../api/api";
import StatTile from "../components/StatTile";

export default function Fees() {
  const { t } = useTranslation();
  const [fees, setFees] = useState([]);
  const [summary, setSummary] = useState(null);
  const [batches, setBatches] = useState([]);
  const [batchFilter, setBatchFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async (batchId = "") => {
    setLoading(true);
    const [feesRes, summaryRes, batchesRes] = await Promise.all([
      feesApi.list(batchId ? { batch_id: batchId } : {}),
      feesApi.summary(),
      batchesApi.list(),
    ]);
    setFees(feesRes.data);
    setSummary(summaryRes.data);
    setBatches(batchesRes.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleMarkPaid = async (fee) => {
    await feesApi.markPaid(fee.id, { amount_paid: fee.amount_due });
    load(batchFilter);
  };

  const statusColor = { paid: "bg-primary/10 text-primary", due: "bg-accent/25 text-ink", overdue: "bg-primary text-white" };

  return (
    <div>
      <h1 className="mb-6 text-h2">{t("nav.fees")}</h1>

      {summary && (
        <div className="mb-6 grid gap-4 sm:grid-cols-4">
          <StatTile label="Outstanding" value={`₹${summary.total_outstanding.toLocaleString("en-IN")}`} tone="primary" />
          <StatTile label="Overdue" value={summary.overdue_count} tone="primary" />
          <StatTile label="Due" value={summary.due_count} tone="accent" />
          <StatTile label="Paid" value={summary.paid_count} tone="muted" />
        </div>
      )}

      <select
        className="input mb-6 max-w-xs"
        value={batchFilter}
        onChange={(e) => { setBatchFilter(e.target.value); load(e.target.value); }}
      >
        <option value="">All batches</option>
        {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>

      {loading ? (
        <p className="text-ink/60">{t("common.loading")}</p>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b-2 border-ink/10 text-sm text-ink/60">
                <th className="px-5 py-3">{t("common.name")}</th>
                <th className="px-5 py-3">Period</th>
                <th className="px-5 py-3">Amount due</th>
                <th className="px-5 py-3">{t("common.status")}</th>
                <th className="px-5 py-3">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {fees.map((f) => (
                <tr key={f.id} className="border-b border-ink/5 last:border-0 hover:bg-muted/40">
                  <td className="px-5 py-3 font-semibold">{f.student_name}</td>
                  <td className="px-5 py-3">{f.period}</td>
                  <td className="px-5 py-3">₹{f.amount_due}</td>
                  <td className="px-5 py-3"><span className={`badge ${statusColor[f.status]}`}>{f.status}</span></td>
                  <td className="px-5 py-3">
                    {f.status !== "paid" && (
                      <button type="button" onClick={() => handleMarkPaid(f)} className="font-semibold text-primary hover:underline">
                        Mark paid
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {fees.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-ink/50">No fee records yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
