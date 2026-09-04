import enum
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    teacher = "teacher"


class FeeStatus(str, enum.Enum):
    due = "due"
    paid = "paid"
    overdue = "overdue"


class AttendanceStatus(str, enum.Enum):
    present = "present"
    absent = "absent"
    late = "late"


class TemplateCategory(str, enum.Enum):
    fee_reminder = "fee_reminder"
    parent_update = "parent_update"


class Language(str, enum.Enum):
    en = "en"
    hi = "hi"


class Institute(Base):
    __tablename__ = "institutes"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    city: Mapped[str] = mapped_column(String(120), default="Patna")
    default_language: Mapped[Language] = mapped_column(Enum(Language), default=Language.en)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    users: Mapped[list["User"]] = relationship(back_populates="institute", cascade="all, delete-orphan")
    batches: Mapped[list["Batch"]] = relationship(back_populates="institute", cascade="all, delete-orphan")
    students: Mapped[list["Student"]] = relationship(back_populates="institute", cascade="all, delete-orphan")
    templates: Mapped[list["Template"]] = relationship(back_populates="institute", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("email", name="uq_users_email"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    institute_id: Mapped[int] = mapped_column(ForeignKey("institutes.id"))
    name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255), index=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.teacher)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    invited: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    institute: Mapped["Institute"] = relationship(back_populates="users")


class Batch(Base):
    __tablename__ = "batches"

    id: Mapped[int] = mapped_column(primary_key=True)
    institute_id: Mapped[int] = mapped_column(ForeignKey("institutes.id"))
    name: Mapped[str] = mapped_column(String(255))
    subject: Mapped[str | None] = mapped_column(String(120), nullable=True)
    schedule_days: Mapped[str | None] = mapped_column(String(120), nullable=True)
    timing: Mapped[str | None] = mapped_column(String(60), nullable=True)
    monthly_fee: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    institute: Mapped["Institute"] = relationship(back_populates="batches")
    students: Mapped[list["Student"]] = relationship(back_populates="batch")


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(primary_key=True)
    institute_id: Mapped[int] = mapped_column(ForeignKey("institutes.id"))
    batch_id: Mapped[int | None] = mapped_column(ForeignKey("batches.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(255))
    parent_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    parent_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    admission_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    monthly_fee: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    institute: Mapped["Institute"] = relationship(back_populates="students")
    batch: Mapped["Batch | None"] = relationship(back_populates="students")
    fees: Mapped[list["Fee"]] = relationship(back_populates="student", cascade="all, delete-orphan")
    attendance_records: Mapped[list["Attendance"]] = relationship(
        back_populates="student", cascade="all, delete-orphan"
    )
    test_scores: Mapped[list["TestScore"]] = relationship(back_populates="student", cascade="all, delete-orphan")


class Fee(Base):
    __tablename__ = "fees"
    __table_args__ = (UniqueConstraint("student_id", "period", name="uq_fee_student_period"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    period: Mapped[str] = mapped_column(String(7))  # "YYYY-MM"
    amount_due: Mapped[float] = mapped_column(Numeric(10, 2))
    amount_paid: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    status: Mapped[FeeStatus] = mapped_column(Enum(FeeStatus), default=FeeStatus.due)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    student: Mapped["Student"] = relationship(back_populates="fees")


class Attendance(Base):
    __tablename__ = "attendance"
    __table_args__ = (UniqueConstraint("student_id", "date", name="uq_attendance_student_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    institute_id: Mapped[int] = mapped_column(ForeignKey("institutes.id"))
    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id"))
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    date: Mapped[date] = mapped_column(Date)
    status: Mapped[AttendanceStatus] = mapped_column(Enum(AttendanceStatus), default=AttendanceStatus.present)
    marked_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    student: Mapped["Student"] = relationship(back_populates="attendance_records")


class TestScore(Base):
    __tablename__ = "test_scores"

    id: Mapped[int] = mapped_column(primary_key=True)
    institute_id: Mapped[int] = mapped_column(ForeignKey("institutes.id"))
    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id"))
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    test_name: Mapped[str] = mapped_column(String(255))
    subject: Mapped[str | None] = mapped_column(String(120), nullable=True)
    max_marks: Mapped[float] = mapped_column(Numeric(6, 2))
    marks_obtained: Mapped[float] = mapped_column(Numeric(6, 2))
    test_date: Mapped[date] = mapped_column(Date)
    remarks: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    student: Mapped["Student"] = relationship(back_populates="test_scores")


class Template(Base):
    __tablename__ = "templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    institute_id: Mapped[int] = mapped_column(ForeignKey("institutes.id"))
    name: Mapped[str] = mapped_column(String(255))
    category: Mapped[TemplateCategory] = mapped_column(Enum(TemplateCategory))
    language: Mapped[Language] = mapped_column(Enum(Language), default=Language.en)
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    institute: Mapped["Institute"] = relationship(back_populates="templates")


class MessageLog(Base):
    __tablename__ = "message_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    institute_id: Mapped[int] = mapped_column(ForeignKey("institutes.id"))
    template_id: Mapped[int | None] = mapped_column(ForeignKey("templates.id"), nullable=True)
    student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id"), nullable=True)
    recipient_phone: Mapped[str] = mapped_column(String(20))
    category: Mapped[TemplateCategory] = mapped_column(Enum(TemplateCategory))
    body: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="sent")
    provider_response: Mapped[str | None] = mapped_column(Text, nullable=True)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class WhatsAppEvent(Base):
    """Everything Meta's webhook tells us: inbound messages and delivery statuses.

    Kept in its own table rather than as columns on `message_logs` because
    `create_all` cannot add columns to an existing table and this project has no
    migrations yet. Status events are therefore joined to a send by `wa_message_id`
    at read time.
    """

    __tablename__ = "whatsapp_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    # "inbound" for a parent's message, "status" for sent/delivered/read/failed.
    event_type: Mapped[str] = mapped_column(String(20), index=True)
    wa_message_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    # Digits-only, matching the normalisation used when sending.
    contact_phone: Mapped[str] = mapped_column(String(20), index=True)
    contact_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone_number_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    # Best-effort: resolved by matching the contact against student phone numbers.
    institute_id: Mapped[int | None] = mapped_column(ForeignKey("institutes.id"), nullable=True)
    student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id"), nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    raw: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AutomationSetting(Base):
    __tablename__ = "automation_settings"
    __table_args__ = (UniqueConstraint("institute_id", "category", name="uq_automation_institute_category"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    institute_id: Mapped[int] = mapped_column(ForeignKey("institutes.id"))
    category: Mapped[TemplateCategory] = mapped_column(Enum(TemplateCategory))
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    day_of_month: Mapped[int] = mapped_column(default=1)
    template_id: Mapped[int | None] = mapped_column(ForeignKey("templates.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
