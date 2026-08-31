from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.models import Fee, FeeStatus, Student, User
from app.schemas.schemas import FeeCreate, FeeMarkPaid, FeeOut

router = APIRouter(prefix="/api/fees", tags=["fees"])


def _to_out(fee: Fee) -> FeeOut:
    out = FeeOut.model_validate(fee)
    out.student_name = fee.student.name if fee.student else ""
    out.batch_id = fee.student.batch_id if fee.student else None
    return out


@router.get("", response_model=list[FeeOut])
def list_fees(
    status_filter: FeeStatus | None = None,
    batch_id: int | None = None,
    student_id: int | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Fee).join(Student).filter(Student.institute_id == user.institute_id)
    if status_filter:
        query = query.filter(Fee.status == status_filter)
    if batch_id:
        query = query.filter(Student.batch_id == batch_id)
    if student_id:
        query = query.filter(Fee.student_id == student_id)
    fees = query.order_by(Fee.due_date.asc().nullslast()).all()
    return [_to_out(f) for f in fees]


@router.get("/summary")
def fees_summary(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    fees = db.query(Fee).join(Student).filter(Student.institute_id == user.institute_id).all()
    total_due = sum(float(f.amount_due) - float(f.amount_paid) for f in fees if f.status != FeeStatus.paid)
    overdue_count = sum(1 for f in fees if f.status == FeeStatus.overdue)
    due_count = sum(1 for f in fees if f.status == FeeStatus.due)
    paid_count = sum(1 for f in fees if f.status == FeeStatus.paid)
    return {
        "total_outstanding": total_due,
        "overdue_count": overdue_count,
        "due_count": due_count,
        "paid_count": paid_count,
    }


@router.post("", response_model=FeeOut, status_code=201)
def create_fee(payload: FeeCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    student = (
        db.query(Student)
        .filter(Student.id == payload.student_id, Student.institute_id == user.institute_id)
        .first()
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    fee = Fee(**payload.model_dump())
    db.add(fee)
    db.commit()
    db.refresh(fee)
    return _to_out(fee)


@router.post("/{fee_id}/mark-paid", response_model=FeeOut)
def mark_paid(
    fee_id: int, payload: FeeMarkPaid, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    fee = (
        db.query(Fee)
        .join(Student)
        .filter(Fee.id == fee_id, Student.institute_id == user.institute_id)
        .first()
    )
    if not fee:
        raise HTTPException(status_code=404, detail="Fee record not found")
    fee.amount_paid = payload.amount_paid
    fee.status = FeeStatus.paid if payload.amount_paid >= float(fee.amount_due) else FeeStatus.due
    fee.paid_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(fee)
    return _to_out(fee)
