"""Institute settings and the caller's own profile.

Institute settings are admin-only. Profile routes act on whoever is logged in,
so they need no role check -- but a password change still requires the current
password, so a borrowed session cannot lock the real owner out.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.core.security import hash_password, verify_password
from app.models.models import Institute, User
from app.schemas.schemas import (
    InstituteOut,
    InstituteUpdate,
    PasswordChange,
    ProfileUpdate,
    UserOut,
)

router = APIRouter(prefix="/api", tags=["institute"])


@router.get("/institute", response_model=InstituteOut)
def get_institute(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.get(Institute, user.institute_id)


@router.put("/institute", response_model=InstituteOut)
def update_institute(
    payload: InstituteUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Name, city, and default language were previously fixed at signup forever."""
    institute = db.get(Institute, admin.institute_id)
    if not institute:
        raise HTTPException(status_code=404, detail="Institute not found")
    institute.name = payload.name
    institute.city = payload.city
    institute.default_language = payload.default_language
    db.commit()
    db.refresh(institute)
    return institute


@router.put("/profile", response_model=UserOut)
def update_profile(
    payload: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user.name = payload.name
    user.phone = payload.phone
    db.commit()
    db.refresh(user)
    return user


@router.post("/profile/password", status_code=204)
def change_password(
    payload: PasswordChange,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    user.hashed_password = hash_password(payload.new_password)
    # Clearing `invited` records that the holder now owns their own password.
    user.invited = False
    db.commit()
