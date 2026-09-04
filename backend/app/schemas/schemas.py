from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.models import AttendanceStatus, FeeStatus, Language, TemplateCategory, UserRole


# ---------- Auth / Institute / User ----------
class InstituteSignup(BaseModel):
    institute_name: str
    city: str = "Patna"
    admin_name: str
    email: EmailStr
    password: str
    default_language: Language = Language.en


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class InstituteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    city: str
    default_language: Language


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    institute_id: int
    name: str
    email: str
    phone: str | None
    role: UserRole
    is_active: bool


class UserInvite(BaseModel):
    name: str
    email: EmailStr
    phone: str | None = None
    temp_password: str


class MeOut(BaseModel):
    user: UserOut
    institute: InstituteOut


# ---------- Batch ----------
class BatchCreate(BaseModel):
    name: str
    subject: str | None = None
    schedule_days: str | None = None
    timing: str | None = None
    monthly_fee: float | None = None


class BatchUpdate(BatchCreate):
    pass


class BatchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    institute_id: int
    name: str
    subject: str | None
    schedule_days: str | None
    timing: str | None
    monthly_fee: float | None
    student_count: int = 0


# ---------- Student ----------
class StudentCreate(BaseModel):
    name: str
    batch_id: int | None = None
    parent_name: str | None = None
    parent_phone: str | None = None
    phone: str | None = None
    admission_date: date | None = None
    monthly_fee: float | None = None


class StudentUpdate(StudentCreate):
    is_active: bool = True


class StudentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    institute_id: int
    batch_id: int | None
    name: str
    parent_name: str | None
    parent_phone: str | None
    phone: str | None
    admission_date: date | None
    monthly_fee: float | None
    is_active: bool


# ---------- Fee ----------
class FeeCreate(BaseModel):
    student_id: int
    period: str
    amount_due: float
    due_date: date | None = None


class FeeMarkPaid(BaseModel):
    amount_paid: float


class FeeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    student_id: int
    student_name: str = ""
    batch_id: int | None = None
    period: str
    amount_due: float
    amount_paid: float
    status: FeeStatus
    due_date: date | None
    paid_at: datetime | None


# ---------- Attendance ----------
class AttendanceEntry(BaseModel):
    student_id: int
    status: AttendanceStatus


class AttendanceSubmit(BaseModel):
    batch_id: int
    date: date
    entries: list[AttendanceEntry]


class AttendanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    student_id: int
    batch_id: int
    date: date
    status: AttendanceStatus


# ---------- Test Scores ----------
class TestScoreCreate(BaseModel):
    student_id: int
    batch_id: int
    test_name: str
    subject: str | None = None
    max_marks: float
    marks_obtained: float
    test_date: date
    remarks: str | None = None


class TestScoreOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    student_id: int
    student_name: str = ""
    batch_id: int
    test_name: str
    subject: str | None
    max_marks: float
    marks_obtained: float
    test_date: date
    remarks: str | None


# ---------- Templates ----------
class TemplateCreate(BaseModel):
    name: str
    category: TemplateCategory
    language: Language = Language.en
    body: str


class TemplateUpdate(TemplateCreate):
    pass


class TemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    institute_id: int
    name: str
    category: TemplateCategory
    language: Language
    body: str


# ---------- Messaging ----------
class SendMessageRequest(BaseModel):
    template_id: int
    student_ids: list[int]


class MessageLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    student_id: int | None
    recipient_phone: str
    category: TemplateCategory
    body: str
    status: str
    sent_at: datetime


# ---------- Automations ----------
class AutomationUpdate(BaseModel):
    category: TemplateCategory
    enabled: bool
    # Capped at 28 so the trigger fires in every month, February included.
    day_of_month: int = Field(default=1, ge=1, le=28)
    template_id: int | None = None


class AutomationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    category: TemplateCategory
    enabled: bool
    day_of_month: int
    template_id: int | None
