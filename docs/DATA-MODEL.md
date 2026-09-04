# Data model

All tables are defined in [`backend/app/models/models.py`](../backend/app/models/models.py)
and created at startup by `Base.metadata.create_all`. Every table has an integer
surrogate primary key and a `created_at` timestamp defaulted by the database
(`server_default=func.now()`).

## Entity relationships

```
Institute ─┬─< User                 (institute_id)
           ├─< Batch ──< Student    (institute_id, batch_id)
           ├─< Student ─┬─< Fee            (student_id)
           │            ├─< Attendance     (student_id)
           │            └─< TestScore      (student_id)
           ├─< Template ──< MessageLog     (template_id, nullable)
           ├─< MessageLog                  (institute_id)
           └─< AutomationSetting           (institute_id, template_id nullable)
```

Cascade deletes are declared on the ORM relationships from `Institute` to its
users, batches, students, and templates, and from `Student` to its fees,
attendance, and test scores. `Batch → Student` has no cascade: deleting a batch
leaves its students with a dangling `batch_id` (see KNOWN-ISSUES).

## Enums

| Enum | Values |
| --- | --- |
| `UserRole` | `admin`, `teacher` |
| `FeeStatus` | `due`, `paid`, `overdue` |
| `AttendanceStatus` | `present`, `absent`, `late` |
| `TemplateCategory` | `fee_reminder`, `parent_update` |
| `Language` | `en`, `hi` |

Stored as native PostgreSQL enum types via SQLAlchemy `Enum`. Adding a value
requires a database-level `ALTER TYPE`, which the current no-migration setup does
not provide.

## Tables

### `institutes`
The tenant root.

| Column | Type | Notes |
| --- | --- | --- |
| `name` | varchar(255) | |
| `city` | varchar(120) | defaults to `Patna` |
| `default_language` | Language | applied to the UI on login |

### `users`
Admins and teachers. Unique constraint `uq_users_email` on `email` — email is
globally unique, so one address cannot belong to two institutes.

| Column | Type | Notes |
| --- | --- | --- |
| `institute_id` | FK institutes | |
| `name`, `email` | varchar(255) | `email` is indexed |
| `phone` | varchar(20), null | |
| `hashed_password` | varchar(255) | bcrypt |
| `role` | UserRole | defaults to `teacher`; signup creates `admin` |
| `is_active` | bool | false blocks login and all authenticated requests |
| `invited` | bool | true for teachers created via the invite endpoint |

### `batches`

| Column | Type | Notes |
| --- | --- | --- |
| `institute_id` | FK institutes | |
| `name` | varchar(255) | |
| `subject` | varchar(120), null | |
| `schedule_days` | varchar(120), null | free text, e.g. `Mon-Fri` |
| `timing` | varchar(60), null | free text, e.g. `4-6 PM` |
| `monthly_fee` | numeric(10,2), null | the batch default |

### `students`

| Column | Type | Notes |
| --- | --- | --- |
| `institute_id` | FK institutes | |
| `batch_id` | FK batches, null | a student may be unassigned |
| `name` | varchar(255) | |
| `parent_name` | varchar(255), null | |
| `parent_phone` | varchar(20), null | preferred message recipient |
| `phone` | varchar(20), null | fallback recipient |
| `admission_date` | date, null | |
| `monthly_fee` | numeric(10,2), null | overrides the batch fee |
| `is_active` | bool | parent-update automations target active students only |

### `fees`
One row per student per month. Unique constraint `uq_fee_student_period` on
(`student_id`, `period`).

| Column | Type | Notes |
| --- | --- | --- |
| `student_id` | FK students | no `institute_id`; tenancy is via the join |
| `period` | varchar(7) | `YYYY-MM`, not validated by the schema |
| `amount_due` | numeric(10,2) | |
| `amount_paid` | numeric(10,2) | defaults to 0 |
| `status` | FeeStatus | defaults to `due` |
| `due_date` | date, null | |
| `paid_at` | timestamptz, null | set by mark-paid |

`status` becomes `paid` when `amount_paid >= amount_due`, otherwise stays `due`.
No code path ever writes `overdue`.

### `attendance`
Unique constraint `uq_attendance_student_date` on (`student_id`, `date`) — one
record per student per day, across all batches.

| Column | Type | Notes |
| --- | --- | --- |
| `institute_id`, `batch_id`, `student_id` | FKs | |
| `date` | date | |
| `status` | AttendanceStatus | defaults to `present` |
| `marked_by` | FK users, null | the submitting teacher |

### `test_scores`
No unique constraint — the same test can be recorded twice for a student.

| Column | Type | Notes |
| --- | --- | --- |
| `institute_id`, `batch_id`, `student_id` | FKs | |
| `test_name` | varchar(255) | |
| `subject` | varchar(120), null | |
| `max_marks`, `marks_obtained` | numeric(6,2) | not validated against each other |
| `test_date` | date | |
| `remarks` | varchar(500), null | |

### `templates`

| Column | Type | Notes |
| --- | --- | --- |
| `institute_id` | FK institutes | |
| `name` | varchar(255) | |
| `category` | TemplateCategory | |
| `language` | Language | defaults to `en` |
| `body` | text | contains `{placeholder}` tokens |

### `message_logs`
The audit trail. Never updated after insert; the messaging list endpoint returns
the most recent 200 for the institute.

| Column | Type | Notes |
| --- | --- | --- |
| `institute_id` | FK institutes | |
| `template_id` | FK templates, null | |
| `student_id` | FK students, null | |
| `recipient_phone` | varchar(20) | |
| `category` | TemplateCategory | copied from the template |
| `body` | text | the **rendered** message, not the template |
| `status` | varchar(20) | `sent` or `failed` |
| `provider_response` | text, null | raw API response or the error string |
| `sent_at` | timestamptz | |

`template_id` and `student_id` are nullable but have no `ON DELETE SET NULL`;
deleting a referenced template or student will fail on the FK constraint.

### `automation_settings`
Unique constraint `uq_automation_institute_category` on (`institute_id`,
`category`) — at most one automation per category per institute, so the API
upserts rather than creating.

| Column | Type | Notes |
| --- | --- | --- |
| `institute_id` | FK institutes | |
| `category` | TemplateCategory | |
| `enabled` | bool | defaults to false |
| `day_of_month` | int | defaults to 1; not range-validated (see KNOWN-ISSUES) |
| `template_id` | FK templates, null | the automation is skipped when null |

## A note on numeric columns

Money and marks columns are declared as `Mapped[float]` over a SQLAlchemy
`Numeric`. The annotation says `float` but the driver returns `Decimal`, which is
why routers cast with `float(...)` before arithmetic — for example in
`fees_summary` and the test-score report. Keep the casts; mixing `Decimal` and
`float` raises `TypeError`.
