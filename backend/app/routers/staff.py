"""Staff administration -- admin-only management of the institute's accounts.

Every route here is guarded twice: `require_admin` for the role, and a lookup
scoped to the caller's institute so one institute can never touch another's
accounts. Role and active-state changes additionally refuse to remove the last
way into the institute.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_admin
from app.core.security import hash_password
from app.models.models import User, UserRole
from app.schemas.schemas import (
    StaffActiveUpdate,
    StaffCreate,
    StaffPasswordReset,
    StaffRoleUpdate,
    StaffUpdate,
    UserOut,
)

router = APIRouter(prefix="/api/staff", tags=["staff"])


def _get_staff(db: Session, user_id: int, admin: User) -> User:
    staff = (
        db.query(User)
        .filter(User.id == user_id, User.institute_id == admin.institute_id)
        .first()
    )
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    return staff


def _other_active_admins(db: Session, admin: User, excluding_id: int) -> int:
    return (
        db.query(User)
        .filter(
            User.institute_id == admin.institute_id,
            User.role == UserRole.admin,
            User.is_active.is_(True),
            User.id != excluding_id,
        )
        .count()
    )


def _assert_not_last_admin(db: Session, staff: User, admin: User, action: str) -> None:
    """An institute must always keep one active admin, or nobody can ever
    administer it again -- there is no password reset and no support console."""
    if staff.role != UserRole.admin or not staff.is_active:
        return
    if _other_active_admins(db, admin, staff.id) == 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot {action} the only active administrator. Promote another admin first.",
        )


@router.get("", response_model=list[UserOut])
def list_staff(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Everyone in the institute, admins included -- unlike the older
    /auth/teachers, which only ever listed teachers."""
    return (
        db.query(User)
        .filter(User.institute_id == admin.institute_id)
        .order_by(User.role.asc(), User.created_at.desc())
        .all()
    )


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_staff(payload: StaffCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    staff = User(
        institute_id=admin.institute_id,
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        hashed_password=hash_password(payload.temp_password),
        role=payload.role,
        invited=True,
    )
    db.add(staff)
    db.commit()
    db.refresh(staff)
    return staff


@router.put("/{user_id}", response_model=UserOut)
def update_staff(
    user_id: int,
    payload: StaffUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    staff = _get_staff(db, user_id, admin)
    if payload.email != staff.email and db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    staff.name = payload.name
    staff.email = payload.email
    staff.phone = payload.phone
    db.commit()
    db.refresh(staff)
    return staff


@router.put("/{user_id}/role", response_model=UserOut)
def set_staff_role(
    user_id: int,
    payload: StaffRoleUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    staff = _get_staff(db, user_id, admin)
    if payload.role != UserRole.admin:
        _assert_not_last_admin(db, staff, admin, "demote")
    staff.role = payload.role
    db.commit()
    db.refresh(staff)
    return staff


@router.put("/{user_id}/active", response_model=UserOut)
def set_staff_active(
    user_id: int,
    payload: StaffActiveUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    staff = _get_staff(db, user_id, admin)
    if not payload.is_active:
        _assert_not_last_admin(db, staff, admin, "deactivate")
    staff.is_active = payload.is_active
    db.commit()
    db.refresh(staff)
    return staff


@router.post("/{user_id}/reset-password", response_model=UserOut)
def reset_staff_password(
    user_id: int,
    payload: StaffPasswordReset,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Sets a temporary password the admin communicates out of band.

    Marks the account as invited again, so the UI can show that the holder is
    still on an admin-chosen password.
    """
    staff = _get_staff(db, user_id, admin)
    staff.hashed_password = hash_password(payload.new_password)
    staff.invited = True
    db.commit()
    db.refresh(staff)
    return staff


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_staff(user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    staff = _get_staff(db, user_id, admin)
    if staff.id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    _assert_not_last_admin(db, staff, admin, "delete")
    db.delete(staff)
    db.commit()
