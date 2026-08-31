from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_admin
from app.models.models import AutomationSetting, User
from app.schemas.schemas import AutomationOut, AutomationUpdate

router = APIRouter(prefix="/api/automations", tags=["automations"])


@router.get("", response_model=list[AutomationOut])
def list_automations(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return db.query(AutomationSetting).filter(AutomationSetting.institute_id == admin.institute_id).all()


@router.put("", response_model=AutomationOut)
def upsert_automation(payload: AutomationUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    setting = (
        db.query(AutomationSetting)
        .filter(
            AutomationSetting.institute_id == admin.institute_id,
            AutomationSetting.category == payload.category,
        )
        .first()
    )
    if setting:
        setting.enabled = payload.enabled
        setting.day_of_month = payload.day_of_month
        setting.template_id = payload.template_id
    else:
        setting = AutomationSetting(institute_id=admin.institute_id, **payload.model_dump())
        db.add(setting)
    db.commit()
    db.refresh(setting)
    return setting
