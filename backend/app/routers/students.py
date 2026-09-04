from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.models import Batch, Student, User
from app.schemas.schemas import StudentCreate, StudentOut, StudentUpdate

router = APIRouter(prefix="/api/students", tags=["students"])


def _assert_batch_owned(db: Session, batch_id: int, user: User) -> None:
    """A student may only be placed in a batch belonging to the caller's institute."""
    batch = db.query(Batch).filter(Batch.id == batch_id, Batch.institute_id == user.institute_id).first()
    if not batch:
        raise HTTPException(status_code=400, detail="Batch not found")


@router.get("", response_model=list[StudentOut])
def list_students(
    search: str | None = None,
    batch_id: int | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Student).filter(Student.institute_id == user.institute_id)
    if search:
        query = query.filter(Student.name.ilike(f"%{search}%"))
    if batch_id:
        query = query.filter(Student.batch_id == batch_id)
    return query.order_by(Student.created_at.desc()).all()


@router.post("", response_model=StudentOut, status_code=201)
def create_student(payload: StudentCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.batch_id:
        _assert_batch_owned(db, payload.batch_id, user)
    student = Student(institute_id=user.institute_id, **payload.model_dump())
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


@router.get("/{student_id}", response_model=StudentOut)
def get_student(student_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    student = (
        db.query(Student).filter(Student.id == student_id, Student.institute_id == user.institute_id).first()
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


@router.put("/{student_id}", response_model=StudentOut)
def update_student(
    student_id: int, payload: StudentUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    student = (
        db.query(Student).filter(Student.id == student_id, Student.institute_id == user.institute_id).first()
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if payload.batch_id:
        _assert_batch_owned(db, payload.batch_id, user)
    for key, value in payload.model_dump().items():
        setattr(student, key, value)
    db.commit()
    db.refresh(student)
    return student


@router.delete("/{student_id}", status_code=204)
def delete_student(student_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    student = (
        db.query(Student).filter(Student.id == student_id, Student.institute_id == user.institute_id).first()
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    db.delete(student)
    db.commit()
