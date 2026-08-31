from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.models import Template, User
from app.schemas.schemas import TemplateCreate, TemplateOut, TemplateUpdate

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("", response_model=list[TemplateOut])
def list_templates(
    category: str | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    query = db.query(Template).filter(Template.institute_id == user.institute_id)
    if category:
        query = query.filter(Template.category == category)
    return query.order_by(Template.created_at.desc()).all()


@router.post("", response_model=TemplateOut, status_code=201)
def create_template(payload: TemplateCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    template = Template(institute_id=user.institute_id, **payload.model_dump())
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.put("/{template_id}", response_model=TemplateOut)
def update_template(
    template_id: int, payload: TemplateUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    template = (
        db.query(Template)
        .filter(Template.id == template_id, Template.institute_id == user.institute_id)
        .first()
    )
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    for key, value in payload.model_dump().items():
        setattr(template, key, value)
    db.commit()
    db.refresh(template)
    return template


@router.delete("/{template_id}", status_code=204)
def delete_template(template_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    template = (
        db.query(Template)
        .filter(Template.id == template_id, Template.institute_id == user.institute_id)
        .first()
    )
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete(template)
    db.commit()
