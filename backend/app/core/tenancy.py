"""Tenant-scoped lookups.

Every domain row belongs to exactly one institute. Routes that accept an id
from the request body must confirm it belongs to the caller's institute before
using it -- otherwise a caller can name another institute's row and read or
overwrite it. Use these helpers rather than hand-writing the filter, so the
check cannot be forgotten.

Out-of-tenant rows are reported as 404 rather than 403: a caller should not be
able to probe which ids exist in other institutes.
"""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.models import Student, User


def get_owned(db: Session, model, obj_id: int, user: User, detail: str | None = None):
    """Returns the row with this id inside the caller's institute, or raises 404.

    `model` must be a mapped class carrying an `institute_id` column.
    """
    obj = (
        db.query(model)
        .filter(model.id == obj_id, model.institute_id == user.institute_id)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail=detail or f"{model.__name__} not found")
    return obj


def assert_students_in_batch(db: Session, student_ids: set[int], batch_id: int, user: User) -> None:
    """Raises 400 unless every id is an existing student of this institute's batch."""
    if not student_ids:
        return
    owned = {
        row[0]
        for row in db.query(Student.id).filter(
            Student.id.in_(student_ids),
            Student.institute_id == user.institute_id,
            Student.batch_id == batch_id,
        )
    }
    unknown = student_ids - owned
    if unknown:
        raise HTTPException(
            status_code=400,
            detail=f"Students not found in this batch: {sorted(unknown)}",
        )
