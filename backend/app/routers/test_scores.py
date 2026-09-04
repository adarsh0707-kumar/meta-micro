from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.tenancy import assert_students_in_batch
from app.models.models import Batch, TestScore, User
from app.schemas.schemas import TestScoreCreate, TestScoreOut

router = APIRouter(prefix="/api/test-scores", tags=["test-scores"])


def _to_out(score: TestScore) -> TestScoreOut:
    out = TestScoreOut.model_validate(score)
    out.student_name = score.student.name if score.student else ""
    return out


@router.get("", response_model=list[TestScoreOut])
def list_test_scores(
    batch_id: int | None = None,
    student_id: int | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(TestScore).filter(TestScore.institute_id == user.institute_id)
    if batch_id:
        query = query.filter(TestScore.batch_id == batch_id)
    if student_id:
        query = query.filter(TestScore.student_id == student_id)
    scores = query.order_by(TestScore.test_date.desc()).all()
    return [_to_out(s) for s in scores]


@router.post("", response_model=TestScoreOut, status_code=201)
def create_test_score(
    payload: TestScoreCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    batch = db.query(Batch).filter(Batch.id == payload.batch_id, Batch.institute_id == user.institute_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    assert_students_in_batch(db, {payload.student_id}, payload.batch_id, user)
    score = TestScore(institute_id=user.institute_id, **payload.model_dump())
    db.add(score)
    db.commit()
    db.refresh(score)
    return _to_out(score)


@router.get("/report")
def report(batch_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    scores = (
        db.query(TestScore)
        .filter(TestScore.institute_id == user.institute_id, TestScore.batch_id == batch_id)
        .all()
    )
    by_student: dict[int, list[TestScore]] = {}
    for s in scores:
        by_student.setdefault(s.student_id, []).append(s)

    report_rows = []
    for student_id, entries in by_student.items():
        total_obtained = sum(float(e.marks_obtained) for e in entries)
        total_max = sum(float(e.max_marks) for e in entries)
        percentage = round((total_obtained / total_max) * 100, 2) if total_max else 0
        report_rows.append(
            {
                "student_id": student_id,
                "student_name": entries[0].student.name if entries[0].student else "",
                "tests_taken": len(entries),
                "total_obtained": total_obtained,
                "total_max": total_max,
                "percentage": percentage,
            }
        )
    report_rows.sort(key=lambda r: r["percentage"], reverse=True)
    return report_rows
