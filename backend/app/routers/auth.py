from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.core.security import create_access_token, hash_password, verify_password
from app.models.models import Institute, User, UserRole
from app.schemas.schemas import InstituteSignup, LoginRequest, MeOut, Token, UserInvite, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", response_model=Token, status_code=status.HTTP_201_CREATED)
def signup(payload: InstituteSignup, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    institute = Institute(
        name=payload.institute_name,
        city=payload.city,
        default_language=payload.default_language,
    )
    db.add(institute)
    db.flush()

    admin = User(
        institute_id=institute.id,
        name=payload.admin_name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=UserRole.admin,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)

    token = create_access_token(str(admin.id))
    return Token(access_token=token)


@router.post("/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")
    token = create_access_token(str(user.id))
    return Token(access_token=token)


@router.get("/me", response_model=MeOut)
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    institute = db.get(Institute, user.institute_id)
    return MeOut(user=UserOut.model_validate(user), institute=institute)


@router.post("/teachers/invite", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def invite_teacher(
    payload: UserInvite,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    teacher = User(
        institute_id=admin.institute_id,
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        hashed_password=hash_password(payload.temp_password),
        role=UserRole.teacher,
        invited=True,
    )
    db.add(teacher)
    db.commit()
    db.refresh(teacher)
    return teacher


@router.get("/teachers", response_model=list[UserOut])
def list_teachers(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return (
        db.query(User)
        .filter(User.institute_id == admin.institute_id, User.role == UserRole.teacher)
        .order_by(User.created_at.desc())
        .all()
    )
