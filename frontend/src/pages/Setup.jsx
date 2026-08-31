import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { setupApi } from "../api/api";

const STEPS = [
  { key: "has_batches", labelKey: "batches", to: "/app/batches" },
  { key: "has_students", labelKey: "students", to: "/app/students" },
  { key: "has_templates", labelKey: "templates", to: "/app/templates" },
];

export default function Setup() {
  const { t } = useTranslation();
  const [status, setStatus] = useState(null);

  useEffect(() => {
    setupApi.status().then(({ data }) => setStatus(data));
  }, []);

  if (!status) return <p className="text-ink/60">{t("common.loading")}</p>;

  const allDone = STEPS.every((s) => status[s.key]);

  return (
    <div className="max-w-2xl">
      <h1 className="mb-2 text-h2">{t("nav.setup")}</h1>
      <p className="mb-8 text-ink/70">
        Get meta-micro ready for your coaching centre. Complete these steps to start sending fee
        reminders and parent updates over WhatsApp.
      </p>

      <div className="space-y-4">
        {STEPS.map((step, i) => {
          const done = status[step.key];
          return (
            <Link
              key={step.key}
              to={step.to}
              className="card flex items-center justify-between transition-transform hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-4">
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full font-heading font-bold ${
                    done ? "bg-primary text-white" : "bg-muted text-ink/60"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </span>
                <div>
                  <h3 className="text-h4">Add your {t(`nav.${step.labelKey}`).toLowerCase()}</h3>
                  <p className="text-sm text-ink/60">
                    {step.key === "has_batches" && "Create batches for your classes."}
                    {step.key === "has_students" && "Add students and assign them to batches."}
                    {step.key === "has_templates" && "Write bilingual WhatsApp message templates."}
                  </p>
                </div>
              </div>
              <span className="text-primary">→</span>
            </Link>
          );
        })}
      </div>

      {allDone && (
        <div className="card mt-6 bg-primary/5">
          <h3 className="text-h4">You're all set! 🎉</h3>
          <p className="mt-1 text-ink/70">
            Head to <Link to="/app/automations" className="font-semibold text-primary">Automations</Link> to
            schedule fee reminders and parent updates.
          </p>
        </div>
      )}
    </div>
  );
}
