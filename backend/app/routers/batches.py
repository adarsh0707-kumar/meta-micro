from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.models import Batch, Student, User
from app.schemas.schemas import BatchCreate, BatchOut, BatchUpdate

router = APIRouter(prefix="/api/batches", tags=["batches"])


def _to_out(batch: Batch, db: Session) -> BatchOut:
    count = db.query(func.count(Student.id)).filter(Student.batch_id == batch.id).scalar() or 0
    out = BatchOut.model_validate(batch)
    out.student_count = count
    return out


@router.get("", response_model=list[BatchOut])
def list_batches(search: str | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(Batch).filter(Batch.institute_id == user.institute_id)
    if search:
        query = query.filter(Batch.name.ilike(f"%{search}%"))
    batches = query.order_by(Batch.created_at.desc()).all()
    return [_to_out(b, db) for b in batches]


@router.post("", response_model=BatchOut, status_code=201)
def create_batch(payload: BatchCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    batch = Batch(institute_id=user.institute_id, **payload.model_dump())
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return _to_out(batch, db)


@router.get("/{batch_id}", response_model=BatchOut)
def get_batch(batch_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == batch_id, Batch.institute_id == user.institute_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return _to_out(batch, db)


@router.put("/{batch_id}", response_model=BatchOut)
def update_batch(
    batch_id: int, payload: BatchUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    batch = db.query(Batch).filter(Batch.id == batch_id, Batch.institute_id == user.institute_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    for key, value in payload.model_dump().items():
        setattr(batch, key, value)
    db.commit()
    db.refresh(batch)
    return _to_out(batch, db)


@router.delete("/{batch_id}", status_code=204)
def delete_batch(batch_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == batch_id, Batch.institute_id == user.institute_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    db.delete(batch)
    db.commit()
