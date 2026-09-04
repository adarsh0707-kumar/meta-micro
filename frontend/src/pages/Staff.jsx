import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { staffApi } from "../api/api";
import Modal from "../components/Modal";
import { useAuth } from "../context/AuthContext";

const emptyForm = { name: "", email: "", phone: "", temp_password: "", role: "teacher" };

export default function Staff() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [staff, setStaff] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);

  const load = async () => {
    const { data } = await staffApi.list();
    setStaff(data);
  };

  useEffect(() => {
    load();
  }, []);

  // The API refuses to strand an institute without an admin; surfacing the same
  // rule here means the button is disabled rather than failing on click.
  const activeAdmins = staff.filter((s) => s.role === "admin" && s.is_active).length;
  const isLastActiveAdmin = (s) => s.role === "admin" && s.is_active && activeAdmins <= 1;

  const act = async (fn) => {
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong.");
    }
  };

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({ name: s.name, email: s.email, phone: s.phone || "", temp_password: "", role: s.role });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await act(async () => {
      if (editing) {
        await staffApi.update(editing.id, { name: form.name, email: form.email, phone: form.phone || null });
      } else {
        await staffApi.create({ ...form, phone: form.phone || null });
      }
      setModalOpen(false);
    });
  };

  const handleResetPassword = (s) => {
    const pwd = prompt(`New temporary password for ${s.name} (at least 8 characters):`);
    if (!pwd) return;
    act(async () => {
      await staffApi.resetPassword(s.id, pwd);
      alert(`Password reset. Give ${s.name} this password directly — it is not emailed.`);
    });
  };

  const handleDelete = (s) => {
    if (!confirm(`Delete ${s.name}? This cannot be undone.`)) return;
    act(() => staffApi.remove(s.id));
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h2">{t("nav.staff")}</h1>
        <button type="button" className="btn-primary" onClick={openAdd}>
          + {t("staff.add")}
        </button>
      </div>

      {error && (
        <div className="card mb-5 border-2 border-primary bg-primary/5">
          <p className="font-semibold text-primary">{error}</p>
        </div>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="border-b-2 border-ink/10 text-sm text-ink/60">
              <th className="px-5 py-3">{t("staff.name")}</th>
              <th className="px-5 py-3">{t("staff.email")}</th>
              <th className="px-5 py-3">{t("staff.role")}</th>
              <th className="px-5 py-3">{t("common.status")}</th>
              <th className="px-5 py-3">{t("staff.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className="border-b border-ink/5 last:border-0">
                <td className="px-5 py-3">
                  <span className="font-medium">{s.name}</span>
                  {s.id === user?.id && <span className="ml-2 text-sm text-ink/50">({t("staff.you")})</span>}
                  {s.phone && <div className="text-sm text-ink/50">{s.phone}</div>}
                </td>
                <td className="px-5 py-3 text-sm">{s.email}</td>
                <td className="px-5 py-3">
                  <select
                    className="input py-1 text-sm"
                    value={s.role}
                    disabled={isLastActiveAdmin(s)}
                    title={isLastActiveAdmin(s) ? t("staff.last_admin_hint") : undefined}
                    onChange={(e) => act(() => staffApi.setRole(s.id, e.target.value))}
                  >
                    <option value="admin">{t("staff.admin")}</option>
                    <option value="teacher">{t("staff.teacher")}</option>
                  </select>
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-semibold ${
                      s.is_active ? "bg-accent/30 text-ink" : "bg-muted text-ink/50"
                    }`}
                  >
                    {s.is_active ? t("staff.active") : t("staff.inactive")}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap gap-3 text-sm font-semibold">
                    <button type="button" className="text-primary hover:underline" onClick={() => openEdit(s)}>
                      {t("common.edit")}
                    </button>
                    <button
                      type="button"
                      className="text-primary hover:underline disabled:cursor-not-allowed disabled:text-ink/30"
                      disabled={isLastActiveAdmin(s)}
                      title={isLastActiveAdmin(s) ? t("staff.last_admin_hint") : undefined}
                      onClick={() => act(() => staffApi.setActive(s.id, !s.is_active))}
                    >
                      {s.is_active ? t("staff.deactivate") : t("staff.reactivate")}
                    </button>
                    <button type="button" className="text-primary hover:underline" onClick={() => handleResetPassword(s)}>
                      {t("staff.reset_password")}
                    </button>
                    <button
                      type="button"
                      className="text-primary hover:underline disabled:cursor-not-allowed disabled:text-ink/30"
                      disabled={s.id === user?.id || isLastActiveAdmin(s)}
                      onClick={() => handleDelete(s)}
                    >
                      {t("common.delete")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {staff.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-ink/50">
                  {t("staff.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t("staff.edit_title") : t("staff.add")}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">{t("staff.name")}</label>
            <input
              className="input"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">{t("staff.email")}</label>
            <input
              className="input"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label">{t("staff.phone")}</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          {!editing && (
            <>
              <div>
                <label className="label">{t("staff.role")}</label>
                <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="teacher">{t("staff.teacher")}</option>
                  <option value="admin">{t("staff.admin")}</option>
                </select>
              </div>
              <div>
                <label className="label">{t("staff.temp_password")}</label>
                <input
                  className="input"
                  type="text"
                  required
                  minLength={8}
                  value={form.temp_password}
                  onChange={(e) => setForm({ ...form, temp_password: e.target.value })}
                />
                <p className="mt-1 text-sm text-ink/50">{t("staff.temp_password_hint")}</p>
              </div>
            </>
          )}
          <button type="submit" className="btn-primary w-full">
            {t("common.save")}
          </button>
        </form>
      </Modal>
    </div>
  );
}
