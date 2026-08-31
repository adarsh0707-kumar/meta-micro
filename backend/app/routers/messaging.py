from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.models import MessageLog, Student, Template, User
from app.schemas.schemas import MessageLogOut, SendMessageRequest
from app.services.whatsapp import get_whatsapp_provider, render_template

router = APIRouter(prefix="/api/messaging", tags=["messaging"])


def _send_to_students(payload: SendMessageRequest, user: User, db: Session) -> list[MessageLog]:
    template = (
        db.query(Template)
        .filter(Template.id == payload.template_id, Template.institute_id == user.institute_id)
        .first()
    )
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    students = (
        db.query(Student)
        .filter(Student.id.in_(payload.student_ids), Student.institute_id == user.institute_id)
        .all()
    )
    if not students:
        raise HTTPException(status_code=400, detail="No matching students found for the given recipients")

    provider = get_whatsapp_provider()
    logs: list[MessageLog] = []
    for student in students:
        recipient_phone = student.parent_phone or student.phone
        if not recipient_phone:
            continue
        body = render_template(
            template.body,
            {
                "student_name": student.name,
                "parent_name": student.parent_name or "",
                "monthly_fee": student.monthly_fee or "",
                "institute_name": user.institute.name,
            },
        )
        success, response = provider.send_message(recipient_phone, body)
        log = MessageLog(
            institute_id=user.institute_id,
            template_id=template.id,
            student_id=student.id,
            recipient_phone=recipient_phone,
            category=template.category,
            body=body,
            status="sent" if success else "failed",
            provider_response=response,
        )
        db.add(log)
        logs.append(log)

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


@router.get("/logs", response_model=list[MessageLogOut])
def list_logs(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return (
        db.query(MessageLog)
        .filter(MessageLog.institute_id == user.institute_id)
        .order_by(MessageLog.sent_at.desc())
        .limit(200)
        .all()
    )
