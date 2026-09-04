from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.tenancy import assert_students_in_batch
from app.models.models import Attendance, Batch, User
from app.schemas.schemas import AttendanceOut, AttendanceSubmit

router = APIRouter(prefix="/api/attendance", tags=["attendance"])


@router.get("", response_model=list[AttendanceOut])
def list_attendance(
    batch_id: int,
    on_date: date,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    batch = db.query(Batch).filter(Batch.id == batch_id, Batch.institute_id == user.institute_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return (
        db.query(Attendance)
        .filter(Attendance.batch_id == batch_id, Attendance.date == on_date)
        .all()
    )


@router.post("", response_model=list[AttendanceOut])
def submit_attendance(payload: AttendanceSubmit, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == payload.batch_id, Batch.institute_id == user.institute_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    assert_students_in_batch(db, {e.student_id for e in payload.entries}, payload.batch_id, user)

    results = []
    for entry in payload.entries:
        record = (
            db.query(Attendance)
            .filter(
                Attendance.student_id == entry.student_id,
                Attendance.date == payload.date,
                Attendance.institute_id == user.institute_id,
            )
            .first()
        )
        if record:
            record.status = entry.status
        else:
            record = Attendance(
                institute_id=user.institute_id,
                batch_id=payload.batch_id,
                student_id=entry.student_id,
                date=payload.date,
                status=entry.status,
                marked_by=user.id,
            )
            db.add(record)
        results.append(record)
    db.commit()
    for r in results:
        db.refresh(r)
    return results
