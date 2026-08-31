from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.models import Batch, Student, Template, User
from app.schemas.schemas import StudentCreate, StudentOut

router = APIRouter(prefix="/api/setup", tags=["setup"])


@router.get("/status")
def setup_status(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    batch_count = db.query(Batch).filter(Batch.institute_id == user.institute_id).count()
    student_count = db.query(Student).filter(Student.institute_id == user.institute_id).count()
    template_count = db.query(Template).filter(Template.institute_id == user.institute_id).count()
    return {
        "has_batches": batch_count > 0,
        "has_students": student_count > 0,
        "has_templates": template_count > 0,
        "batch_count": batch_count,
        "student_count": student_count,
        "template_count": template_count,
    }


@router.post("/import-students", response_model=list[StudentOut])
def import_students(students: list[StudentCreate], user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    created = []
    for payload in students:
        student = Student(institute_id=user.institute_id, **payload.model_dump())
        db.add(student)
        created.append(student)
    db.commit()
    for s in created:
        db.refresh(s)
    return created
