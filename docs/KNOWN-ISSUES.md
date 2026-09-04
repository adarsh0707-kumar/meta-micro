# Known issues

Found by reading the code at `72e030d` and by running the stack. The critical
tenancy defects, the logging defect, and two validation gaps have since been
fixed and verified; everything under "Open" is still true.

---

## Fixed

Verified against a running stack with two institutes, one attempting to reach
the other's rows. All five attacks are now rejected; legitimate operations for
the owning institute still succeed, and `smoke_test.py` passes.

| # | Issue | Fix | Result |
| --- | --- | --- | --- |
| 1 | Attendance could be written against another institute's student | `assert_students_in_batch` before the upsert, plus an `institute_id` filter on the existing-record lookup | 400 `Students not found in this batch: [1]` |
| 2 | Test scores could be attached to another institute's student | same helper, applied to `create_test_score` | 400 `Students not found in this batch: [1]` |
| 3 | `PUT /students/{id}` did not re-validate `batch_id` | `_assert_batch_owned`, shared with the create path | 400 `Batch not found` |
| 4 | `POST /setup/import-students` validated nothing | batch ids checked as a set before insert | 400 `Batches not found: [1]` |
| 5 | Automations accepted another institute's `template_id` | `get_owned(...)` on write; the scheduler also refuses a template whose institute does not match and logs an error | 404 `Template not found` |
| 6 | Duplicate fee period returned 500 | `IntegrityError` caught, rolled back, reported as 409 | 409 `A fee for 2026-09 already exists for this student` |
| 9 | Application INFO logs never reached stdout | `logging.basicConfig` at startup, level from the new `LOG_LEVEL` setting | the log provider's message line now appears in `docker compose logs` |
| 13 | `day_of_month` was unvalidated | `Field(ge=1, le=28)` | 422 on `31` |
| 18 | WhatsApp fell back to logging when `meta_cloud_api` was selected but unconfigured, reporting `sent` while delivering nothing | `get_whatsapp_provider()` now raises `WhatsAppConfigError`; the API returns 503 and the scheduler logs and skips | 503 `WhatsApp is not configured: missing WHATSAPP_ACCESS_TOKEN…` |

The tenancy fixes live in [`core/tenancy.py`](../backend/app/core/tenancy.py) —
`get_owned` for single rows and `assert_students_in_batch` for bulk membership.
Routes that accept an id from the request body should use them rather than
hand-writing the filter; that is what made this class of bug easy to introduce
five separate times.

Also removed: the stray `backend/package-lock.json`.

---

## Open

### High

#### 7. Deleting a template or student that has message logs returns 500

`message_logs.template_id` and `student_id` are nullable but have no
`ON DELETE SET NULL` and no ORM relationship. `DELETE /templates/{id}` and
`DELETE /students/{id}` therefore fail with a foreign-key violation once any
message has been sent — the normal state of a live institute. The fix is
`ondelete="SET NULL"` on those columns, which is a schema change and so is
blocked on migrations (#12).

#### 8. Nothing ever marks a fee overdue

`FeeStatus.overdue` exists and `/fees/summary` counts it, but no code path writes
it — nothing compares `due_date` to today. The overdue count is permanently 0
unless a row is inserted that way. Either add a daily sweep alongside the
existing scheduler job, or derive status from `due_date` at read time and drop
the stored column.

#### 10. Teachers can still send broadcasts and edit fees

Staff management, institute settings, and WhatsApp test sends are now
`require_admin`, but a teacher can still create and delete students, create fee
records, mark fees paid, edit templates, and send a WhatsApp broadcast to every
parent. Whether that is wrong depends on how these institutes actually divide
work — narrowing it is a product decision, so it is left as is.

#### 11. Default `JWT_SECRET` ships in `.env.example`

`change-me-in-production` is also the code default, so a deployment that forgets
to set it accepts tokens anyone can forge. Consider refusing to start when the
secret is still the default.

### Medium

#### 12. No migrations

Alembic is a dependency with no `alembic.ini` and no versions directory. Schema
comes from `create_all` at startup, which never alters an existing table. Fix #7
is blocked on this, and so is any future column change once real data exists.

#### 14. `mark-paid` replaces rather than accumulates

`fee.amount_paid = payload.amount_paid`. A second partial payment must be sent as
a running total or it silently erases the first. Either rename the field to make
that explicit or add to the existing value.

#### 15. Marks are not validated

`marks_obtained` may exceed `max_marks`, and both may be negative. The batch
report will happily print percentages above 100.

#### 16. Everything is unpaginated

All list endpoints return every matching row. `/messaging/logs` is capped at 200,
but students, fees, attendance, and test scores are not, and `/fees/summary`
loads every fee for the institute into Python to sum it. Fine at 300 students;
not fine at 3,000.

#### 17. Single-replica constraint is unenforced

The in-process scheduler means a second backend replica double-sends every
automated message. Nothing in `docker-compose.yml` prevents scaling.



### Low

- **`PUT` semantics** — batch, student, and template updates are full replaces
  built from `payload.model_dump()`, so any optional field the client omits is set
  to null. The frontend sends complete objects, so this does not bite today, but
  it makes the API hostile to partial updates.
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
- **No test suite** — `smoke_test.py` is a script with asserts covering the happy
  path. None of the fixed defects above would have been caught by it; the tenancy
  fixes were verified by hand with curl, which is not a regression test.
