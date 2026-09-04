import logging
from datetime import date

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.models import AutomationSetting, Fee, FeeStatus, MessageLog, Student, Template
from app.services.whatsapp import (
    WhatsAppConfigError,
    get_whatsapp_provider,
    normalise_phone,
    render_template,
)

logger = logging.getLogger("meta_micro.scheduler")


def run_due_automations() -> None:
    """Fires enabled automations whose day_of_month matches today.

    Fee-reminder automations message every student with a due/overdue fee;
    parent-update automations message every active student. Runs once a day.
    """
    db: Session = SessionLocal()
    try:
        today = date.today()
        settings_due = (
            db.query(AutomationSetting)
            .filter(AutomationSetting.enabled.is_(True), AutomationSetting.day_of_month == today.day)
            .all()
        )
        if not settings_due:
            return

        try:
            provider = get_whatsapp_provider()
        except WhatsAppConfigError as exc:
            logger.error(
                "Skipping %d due automation(s): WhatsApp is not configured -- %s",
                len(settings_due),
                exc,
            )
            return

        logger.info("Running %d due automation(s)", len(settings_due))
        for setting in settings_due:
            if not setting.template_id:
                continue
            template = db.get(Template, setting.template_id)
            if not template:
                continue
            if template.institute_id != setting.institute_id:
                # Should be unreachable -- the API validates ownership on write.
                # Refuse rather than send one institute's message body to another's parents.
                logger.error(
                    "Automation %s references template %s from institute %s; skipping",
                    setting.id,
                    template.id,
                    template.institute_id,
                )
                continue

            if setting.category.value == "fee_reminder":
                fees = (
                    db.query(Fee)
                    .join(Student)
                    .filter(Student.institute_id == setting.institute_id, Fee.status != FeeStatus.paid)
                    .all()
                )
                targets = [(fee.student, {"monthly_fee": fee.amount_due, "period": fee.period}) for fee in fees]
            else:
                students = (
                    db.query(Student)
                    .filter(Student.institute_id == setting.institute_id, Student.is_active.is_(True))
                    .all()
                )
                targets = [(s, {}) for s in students]

            for student, extra_context in targets:
                recipient_phone = normalise_phone(student.parent_phone or student.phone)
                if not recipient_phone:
                    continue
                context = {
                    "student_name": student.name,
                    "parent_name": student.parent_name or "",
                    **extra_context,
                }
                body = render_template(template.body, context)
                success, response = provider.send_message(recipient_phone, body)
                db.add(
                    MessageLog(
                        institute_id=setting.institute_id,
                        template_id=template.id,
                        student_id=student.id,
                        recipient_phone=recipient_phone,
                        category=template.category,
                        body=body,
                        status="sent" if success else "failed",
                        provider_response=response,
                    )
                )
            db.commit()
    except Exception:
        logger.exception("Automation run failed")
    finally:
        db.close()


def start_scheduler() -> BackgroundScheduler:
    scheduler = BackgroundScheduler()
    scheduler.add_job(run_due_automations, "cron", hour=9, minute=0, id="daily_automations")
    scheduler.start()
    return scheduler
