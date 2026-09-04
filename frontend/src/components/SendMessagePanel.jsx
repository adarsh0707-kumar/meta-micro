import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { messagingApi, studentsApi, templatesApi } from "../api/api";

export default function SendMessagePanel({ category, sendFn, title }) {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState("");
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState([]);
  const [logs, setLogs] = useState([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState(null);
  const [provider, setProvider] = useState(null);

  const load = async () => {
    const [templatesRes, studentsRes, logsRes] = await Promise.all([
      templatesApi.list({ category }),
      studentsApi.list(),
      messagingApi.logs(),
    ]);
    setTemplates(templatesRes.data);
    setStudents(studentsRes.data);
    setLogs(logsRes.data.filter((l) => l.category === category));
  };

  useEffect(() => {
    load();
    messagingApi.providerStatus().then(({ data }) => setProvider(data));
  }, []);

  // Any change to the template or recipients invalidates a rendered preview.
  useEffect(() => {
    setPreview(null);
  }, [templateId, selected]);

  const toggle = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const toggleAll = () => {
    setSelected((prev) => (prev.length === students.length ? [] : students.map((s) => s.id)));
  };

  // Sending is two steps on purpose: a broadcast reaches real parents, and
  // there is no way to unsend one. Preview renders every message first.
  const handlePreview = async () => {
    if (!templateId || selected.length === 0) return;
    setSending(true);
    setResult(null);
    try {
      const { data } = await messagingApi.preview({
        template_id: Number(templateId),
        student_ids: selected,
      });
      setPreview(data);
    } catch (err) {
      setResult(err.response?.data?.detail || "Could not build a preview.");
    } finally {
      setSending(false);
    }
  };

  const handleConfirmedSend = async () => {
    setSending(true);
    setResult(null);
    try {
      const { data } = await sendFn({
        template_id: Number(templateId),
        student_ids: selected,
        confirm: true,
      });
      setResult(`Sent to ${data.length} recipient(s).`);
      setPreview(null);
      setSelected([]);
      load();
    } catch (err) {
      setResult(err.response?.data?.detail || "Failed to send.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <h1 className="mb-2 text-h2">{title}</h1>
      {provider && !provider.would_really_send && (
        <p className="mb-6 rounded-2xl bg-muted/60 px-4 py-3 text-sm text-ink/70">
          WhatsApp is not configured — messages are recorded but not delivered. An admin can
          set this up on the Settings page.
        </p>
      )}

      <div className="card mb-6">
        <label className="label">Template</label>
        <select className="input mb-4" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
          <option value="">Select a template…</option>
          {templates.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>{tpl.name} ({tpl.language})</option>
          ))}
        </select>
        {templates.length === 0 && (
          <p className="mb-4 text-sm text-ink/50">No templates for this category yet — add one on the {t("nav.templates")} page.</p>
        )}

        <div className="mb-3 flex items-center justify-between">
          <label className="label mb-0">Recipients</label>
          <button type="button" onClick={toggleAll} className="text-sm font-semibold text-primary">
            {selected.length === students.length ? "Deselect all" : "Select all"}
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto rounded-2xl border-2 border-ink/10">
          {students.map((s) => (
            <label key={s.id} className="flex items-center gap-3 border-b border-ink/5 px-4 py-2 last:border-0 hover:bg-muted/40">
              <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} />
              <span className="font-medium">{s.name}</span>
              <span className="text-sm text-ink/50">{s.parent_phone || s.phone || "no phone"}</span>
            </label>
          ))}
          {students.length === 0 && <p className="px-4 py-6 text-center text-ink/50">No students yet.</p>}
        </div>

        <button
          type="button"
          disabled={!templateId || selected.length === 0 || sending}
          onClick={handlePreview}
          className="btn-primary mt-4"
        >
          {sending ? t("common.loading") : `Preview ${selected.length} message(s)`}
        </button>
        {result && <p className="mt-3 font-semibold text-primary">{result}</p>}
      </div>

      {preview && (
        <div className="card mb-6 border-2 border-accent">
          <h2 className="mb-1 text-h4">Confirm before sending</h2>
          <p className="mb-4 text-sm text-ink/70">
            {preview.deliverable_count} of {preview.total_selected} will be delivered
            {preview.skipped_count > 0 && `, ${preview.skipped_count} skipped`}.{" "}
            {preview.would_really_send ? (
              <strong>These are real WhatsApp messages to parents.</strong>
            ) : (
              <>WhatsApp is not configured, so these will be recorded but not delivered.</>
            )}
          </p>

          <div className="mb-4 max-h-72 overflow-y-auto rounded-2xl border-2 border-ink/10">
            {preview.rows.map((row) => (
              <div key={row.student_id} className="border-b border-ink/5 px-4 py-3 last:border-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{row.student_name}</span>
                  <span className={`text-sm ${row.deliverable ? "text-ink/50" : "font-semibold text-primary"}`}>
                    {row.deliverable ? row.recipient_phone : row.reason}
                  </span>
                </div>
                <p className={`mt-1 text-sm ${row.deliverable ? "text-ink/70" : "text-ink/30 line-through"}`}>
                  {row.body}
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn-primary"
              disabled={sending || preview.deliverable_count === 0}
              onClick={handleConfirmedSend}
            >
              {sending ? t("common.loading") : `Confirm and send to ${preview.deliverable_count}`}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setPreview(null)}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      <h2 className="mb-3 text-h4">Recent messages</h2>
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[520px] text-left">
          <thead>
            <tr className="border-b-2 border-ink/10 text-sm text-ink/60">
              <th className="px-5 py-3">Phone</th>
              <th className="px-5 py-3">Message</th>
              <th className="px-5 py-3">{t("common.status")}</th>
              <th className="px-5 py-3">Sent</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-ink/5 last:border-0">
                <td className="px-5 py-3">{l.recipient_phone}</td>
                <td className="max-w-xs truncate px-5 py-3">{l.body}</td>
                <td className="px-5 py-3">
                  <span className={`badge ${l.status === "sent" ? "bg-primary/10 text-primary" : "bg-muted text-ink/60"}`}>{l.status}</span>
                </td>
                <td className="px-5 py-3">{new Date(l.sent_at).toLocaleString()}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-ink/50">No messages sent yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
