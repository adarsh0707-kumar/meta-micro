# Known issues

Found by reading the code at commit `72e030d`. Nothing here has been fixed —
this is a register of what is currently true, ordered by severity.

## Critical — cross-institute data access

The app's tenant isolation depends on every query filtering by
`user.institute_id`. Five endpoints take an id from the request body and trust it.

### 1. Attendance can be written against another institute's student

[`routers/attendance.py:41-45`](../backend/app/routers/attendance.py#L41-L45) —
`submit_attendance` validates that `batch_id` belongs to the caller's institute,
then looks up each entry's existing record by `student_id` and `date` alone:

```python
record = (
    db.query(Attendance)
    .filter(Attendance.student_id == entry.student_id, Attendance.date == payload.date)
    .first()
)
```

A caller who posts a valid batch of their own plus an arbitrary `student_id`
overwrites another institute's attendance record, or creates a new row for that
student under their own batch. **Fix:** load the batch's students once and reject
any `student_id` not in it.

### 2. Test scores can be attached to another institute's student

[`routers/test_scores.py:36`](../backend/app/routers/test_scores.py#L36) —
`create_test_score` checks the batch but never the student, so
`TestScore(institute_id=<caller>, student_id=<foreign>)` is accepted. The score
then appears in the caller's batch report with the foreign student's name,
leaking it. **Fix:** verify the student belongs to the caller's institute and to
the named batch.

### 3. `PUT /students/{id}` does not re-validate `batch_id`

[`routers/students.py:52-66`](../backend/app/routers/students.py#L52-L66) —
`create_student` checks that `batch_id` is in the institute; `update_student`
does not, so a student can be moved into another institute's batch and will show
up in that batch's roster count and attendance screens.

### 4. `POST /setup/import-students` validates nothing

[`routers/setup.py:28`](../backend/app/routers/setup.py#L28) — bulk import
constructs `Student` rows straight from the payload with no `batch_id` check.
Same consequence as (3), in bulk.

### 5. Automations accept another institute's `template_id`

[`routers/automations.py:17`](../backend/app/routers/automations.py#L17) —
`upsert_automation` stores `template_id` without checking ownership. The
scheduler later resolves it with a bare `db.get(Template, ...)`, so an
institute's automated messages would be sent using another institute's template
body.

A durable fix for the whole class of bug is a shared helper — for example
`get_owned(db, Model, id, user)` that raises 404 when the row is missing or out
of tenant — used by every route that accepts an id.

## High

### 6. Duplicate fee period returns 500

`POST /fees` has no guard against `uq_fee_student_period`, so creating a second
fee for the same student and month raises `IntegrityError` and surfaces as an
unhandled 500. Should be a 409 or an upsert.

### 7. Deleting a template or student that has message logs returns 500

`message_logs.template_id` and `student_id` are nullable but have no
`ON DELETE SET NULL` and no ORM relationship. `DELETE /templates/{id}` and
`DELETE /students/{id}` therefore fail with a foreign-key violation once any
message has been sent — which is the normal state of a live institute. Needs
`ondelete="SET NULL"` on the columns (a schema change, so it also needs
migrations).

### 8. Nothing ever marks a fee overdue

`FeeStatus.overdue` exists and `/fees/summary` counts it, but no code path writes
it — no job compares `due_date` to today. The overdue count is permanently 0
unless a row is inserted that way. Either add a daily sweep, or derive status
from `due_date` at read time and drop the stored value.

### 9. Teacher and admin are barely distinguishable

Only automations and teacher invites use `require_admin`. A teacher can create
and delete students, create fee records, mark fees paid, edit templates, and send
WhatsApp broadcasts to every parent. If the role is meant to be a boundary, the
fee and messaging routes need `require_admin` too.

### 10. Default `JWT_SECRET` ships in `.env.example`

`change-me-in-production` is also the code default, so a deployment that forgets
to set it accepts tokens anyone can forge. Consider refusing to start when the
secret is still the default and the app is not in debug.

## Medium

### 11. No migrations

Alembic is a dependency with no `alembic.ini` and no versions directory. Schema
comes from `create_all` at startup, which never alters an existing table. The
fixes in (7) require a schema change and are blocked on this.

### 12. `day_of_month` is unvalidated

`AutomationUpdate.day_of_month` accepts any integer. `31` silently never fires in
February; `0` or `40` never fires at all. Needs `Field(ge=1, le=28)` — 28 being
the highest day guaranteed to exist in every month.

### 13. `mark-paid` replaces rather than accumulates

`fee.amount_paid = payload.amount_paid`. A second partial payment must be sent as
a running total or it silently erases the first. Either rename the field to make
that explicit or add to the existing value.

### 14. Marks are not validated

`marks_obtained` may exceed `max_marks`, and both may be negative. The batch
report will happily print percentages above 100.

### 15. Everything is unpaginated

All list endpoints return every matching row. `/messaging/logs` is capped at 200,
but students, fees, attendance, and test scores are not, and `/fees/summary`
loads every fee for the institute into Python to sum it. Fine at 300 students;
not fine at 3,000.

### 16. Single-replica constraint is undocumented in the deploy config

The in-process scheduler means a second backend replica double-sends every
automated message. Nothing in `docker-compose.yml` or the Dockerfile prevents it.

### 17. Silent fallback to the log provider

`get_whatsapp_provider()` returns the logging provider whenever the access token
is blank, even with `WHATSAPP_PROVIDER=meta_cloud_api`. Message logs read `sent`
and nothing is delivered. A misconfigured production deploy should fail loudly.

## Low

- **`PUT` semantics** — batch, student, and template updates are full replaces
  built from `payload.model_dump()`, so any optional field omitted by the client
  is set to null. The frontend sends complete objects, so this does not bite
  today, but it makes the API hostile to partial updates.
- **Deleting a batch silently unassigns its students** — SQLAlchemy nullifies
  `batch_id` on the loaded children. Reasonable behaviour, but the API gives no
  warning and returns 204.
- **Email is globally unique** — `uq_users_email` is not scoped to the institute,
  so one person cannot be a teacher at two institutes.
- **No password reset and no forced change** — invited teachers keep the
  admin-chosen `temp_password` indefinitely; `invited` is recorded but never acted
  on.
- **Token in `localStorage`** — readable by any XSS on the origin, and there is no
  server-side revocation, so a leaked token is valid for its full 7 days.
- **`Mapped[float]` over `Numeric`** — the annotation lies; the driver returns
  `Decimal`. The `float(...)` casts scattered through the routers are load-bearing.
- **Stray `backend/package-lock.json`** — a Node lockfile in the Python service,
  untracked by any build step. Should be deleted.
- **No test suite** — `smoke_test.py` is a script with asserts, covering only the
  happy path. None of the defects above would be caught by it.
