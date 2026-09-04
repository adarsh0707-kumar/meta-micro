from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.core.tenancy import get_owned
from app.models.models import MessageLog, Student, Template, User
from app.schemas.schemas import (
    MessageLogOut,
    MessagePreviewOut,
    MessagePreviewRow,
    ProviderStatusOut,
    SendMessageRequest,
    TestSendRequest,
)
from app.services.whatsapp import (
    WhatsAppConfigError,
    get_whatsapp_provider,
    normalise_phone,
    provider_status,
    render_template,
)
from app.services.whatsapp_webhook import last_inbound_at, within_service_window

router = APIRouter(prefix="/api/messaging", tags=["messaging"])


def _resolve(payload: SendMessageRequest, user: User, db: Session):
    """Shared by preview and send: the template, and one row per selected student.

    Returns (template, rows) where each row is (student, phone_or_None, body,
    reason_if_undeliverable).
    """
    template = get_owned(db, Template, payload.template_id, user, detail="Template not found")

    students = (
        db.query(Student)
        .filter(Student.id.in_(payload.student_ids), Student.institute_id == user.institute_id)
        .all()
    )
    if not students:
        raise HTTPException(status_code=400, detail="No matching students found for the given recipients")

    by_id = {s.id: s for s in students}
    rows = []
    for student_id in payload.student_ids:
        student = by_id.get(student_id)
        if student is None:
            continue  # not this institute's student -- silently excluded, never messaged
        phone = normalise_phone(student.parent_phone or student.phone)
        body = render_template(
            template.body,
            {
                "student_name": student.name,
                "parent_name": student.parent_name or "",
                "monthly_fee": student.monthly_fee or "",
                "institute_name": user.institute.name,
            },
        )
        if phone is None:
            reason = "No usable phone number on file" if (student.parent_phone or student.phone) else "No phone number"
        elif not student.is_active:
            reason = "Student is inactive"
        else:
            reason = None
        rows.append((student, phone, body, reason))
    return template, rows


@router.get("/provider-status", response_model=ProviderStatusOut)
def get_provider_status(user: User = Depends(get_current_user)):
    """Lets the UI say plainly whether a send would reach a real phone."""
    name, would_send, detail = provider_status()
    return ProviderStatusOut(
        provider=name,
        configured=would_send,
        would_really_send=would_send,
        detail=detail,
    )


@router.post("/preview", response_model=MessagePreviewOut)
def preview(payload: SendMessageRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Renders exactly what a send would deliver, without sending anything."""
    template, rows = _resolve(payload, user, db)
    name, would_send, _ = provider_status()

    # Meta rejects free-form text outside the 24-hour service window, so flag it
    # here rather than letting each send fail at the provider.
    inbound = last_inbound_at(db, {phone for _, phone, _, _ in rows if phone})
    preview_rows = []
    outside = 0
    for student, phone, body, reason in rows:
        in_window = within_service_window(inbound.get(phone)) if phone else False
        warning = None
        if reason is None and would_send and not in_window:
            outside += 1
            warning = (
                "Outside Meta's 24-hour window -- this parent has not messaged the "
                "business number recently, so Meta will reject plain text."
            )
        preview_rows.append(
            MessagePreviewRow(
                student_id=student.id,
                student_name=student.name,
                recipient_phone=phone,
                body=body,
                deliverable=reason is None,
                reason=reason,
                in_service_window=in_window,
                warning=warning,
            )
        )

    return MessagePreviewOut(
        template_name=template.name,
        total_selected=len(rows),
        deliverable_count=sum(1 for _, _, _, reason in rows if reason is None),
        skipped_count=sum(1 for _, _, _, reason in rows if reason is not None),
        provider=name,
        would_really_send=would_send,
        outside_window_count=outside,
        rows=preview_rows,
    )


def _send_to_students(payload: SendMessageRequest, user: User, db: Session) -> list[MessageLog]:
    if not payload.confirm:
        raise HTTPException(
            status_code=400,
            detail="Set confirm=true to send. Call /api/messaging/preview first to see what would go out.",
        )

    template, rows = _resolve(payload, user, db)

    try:
        provider = get_whatsapp_provider()
    except WhatsAppConfigError as exc:
        # Refuse rather than quietly logging: an unsent reminder must not look sent.
        raise HTTPException(status_code=503, detail=f"WhatsApp is not configured: {exc}")

    logs: list[MessageLog] = []
    for student, phone, body, reason in rows:
        if reason is not None:
            continue
        success, response = provider.send_message(phone, body)
        log = MessageLog(
            institute_id=user.institute_id,
            template_id=template.id,
            student_id=student.id,
            recipient_phone=phone,
            category=template.category,
            body=body,
            status="sent" if success else "failed",
            provider_response=response,
        )
        db.add(log)
        logs.append(log)

    if not logs:
        raise HTTPException(
            status_code=400,
            detail="None of the selected students have a usable phone number",
        )

    db.commit()
    for log in logs:
        db.refresh(log)
    return logs


@router.post("/fee-reminders", response_model=list[MessageLogOut])
def send_fee_reminders(payload: SendMessageRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _send_to_students(payload, user, db)


@router.post("/parent-updates", response_model=list[MessageLogOut])
def send_parent_updates(payload: SendMessageRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _send_to_students(payload, user, db)


@router.post("/test-send")
def test_send(payload: TestSendRequest, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Proves credentials work by messaging one number the admin names.

    Deliberately not tied to a student: use it to verify a new access token
    against your own phone before pointing a broadcast at parents.
    """
    phone = normalise_phone(payload.to_phone)
    if phone is None:
        raise HTTPException(status_code=400, detail="That does not look like a valid phone number")

    try:
        provider = get_whatsapp_provider()
    except WhatsAppConfigError as exc:
        raise HTTPException(status_code=503, detail=f"WhatsApp is not configured: {exc}")

    success, response = provider.send_message(phone, payload.body)
    name, would_send, _ = provider_status()
    return {
        "provider": name,
        "would_really_send": would_send,
        "to_phone": phone,
        "success": success,
        "provider_response": response,
    }


@router.get("/logs", response_model=list[MessageLogOut])
def list_logs(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return (
        db.query(MessageLog)
        .filter(MessageLog.institute_id == user.institute_id)
        .order_by(MessageLog.sent_at.desc())
        .limit(200)
        .all()
    )
