# API reference

Base path `/api`. Interactive docs are served by FastAPI at
`http://localhost:8000/docs`.

## Conventions

- **Auth** — every endpoint except `/health`, `/auth/signup`, and `/auth/login`
  requires `Authorization: Bearer <token>`. Endpoints marked **admin** also
  require `role == admin`.
- **Tenancy** — reads and writes are scoped to the caller's institute; a resource
  belonging to another institute returns 404, not 403.
- **Errors** — FastAPI's `{"detail": "..."}`. 401 invalid/expired token or bad
  credentials, 403 inactive account or non-admin, 404 not found or out of tenant,
  422 request-body validation failure.
- **Collections** — list endpoints return bare JSON arrays. There is no
  pagination anywhere; `/messaging/logs` is capped at 200 rows.

---

## Health

### `GET /api/health`
No auth. `{"status": "ok", "app": "meta-micro"}`.

---

## Auth — `/api/auth`

### `POST /auth/signup` → 201
Creates an institute and its first admin. No auth.

```json
{ "institute_name": "Bright Future Coaching", "city": "Patna",
  "admin_name": "Adarsh Kumar", "email": "admin@example.in",
  "password": "supersecret123", "default_language": "hi" }
```

→ `{ "access_token": "...", "token_type": "bearer" }`.
400 if the email already exists. `city` defaults to `Patna`, `default_language`
to `en`.

### `POST /auth/login`
`{ "email", "password" }` → the same token payload. 401 on bad credentials, 403
if the account is inactive.

### `GET /auth/me`
→ `{ "user": UserOut, "institute": InstituteOut }`. Used on app boot to restore
the session and apply the institute's language.

### `POST /auth/teachers/invite` → 201 · **admin**
`{ "name", "email", "phone?, "temp_password" }` → `UserOut` with `role: teacher`
and `invited: true`. 400 if the email exists. No email is sent — the admin
communicates the temporary password out of band.

### `GET /auth/teachers` · **admin**
Teachers in the institute, newest first.

---

## Batches — `/api/batches`

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `` | optional `?search=` (case-insensitive name match). Each `BatchOut` includes a computed `student_count` |
| `POST` | `` | 201, body `BatchCreate` |
| `GET` | `/{batch_id}` | 404 outside the institute |
| `PUT` | `/{batch_id}` | full replace — omitted optional fields are set to null |
| `DELETE` | `/{batch_id}` | 204. Students are **not** reassigned or deleted |

`BatchCreate`: `name` (required), `subject?`, `schedule_days?`, `timing?`,
`monthly_fee?`.

---

## Students — `/api/students`

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `` | optional `?search=` and `?batch_id=`, newest first |
| `POST` | `` | 201. 400 if `batch_id` is set but not in the institute |
| `GET` | `/{student_id}` | |
| `PUT` | `/{student_id}` | full replace; `StudentUpdate` adds `is_active` (defaults true) |
| `DELETE` | `/{student_id}` | 204; cascades to fees, attendance, and test scores |

`StudentCreate`: `name` (required), `batch_id?`, `parent_name?`, `parent_phone?`,
`phone?`, `admission_date?`, `monthly_fee?`.

Note: `PUT` does not re-validate `batch_id` against the institute the way `POST`
does (see KNOWN-ISSUES).

---

## Fees — `/api/fees`

### `GET /fees`
Filters: `status_filter` (`due`|`paid`|`overdue`), `batch_id`, `student_id`.
Ordered by due date ascending, nulls last. Each `FeeOut` is enriched with
`student_name` and the student's `batch_id`.

### `GET /fees/summary`
```json
{ "total_outstanding": 12000.0, "overdue_count": 0, "due_count": 8, "paid_count": 14 }
```
`total_outstanding` sums `amount_due - amount_paid` over every fee not marked
paid. Computed in Python over all fees for the institute — fine at this scale,
not a query to keep as the table grows.

### `POST /fees` → 201
`{ "student_id", "period": "YYYY-MM", "amount_due", "due_date"? }`. 404 if the
student is outside the institute. A duplicate (student, period) violates
`uq_fee_student_period` and surfaces as a 500 (see KNOWN-ISSUES).

### `POST /fees/{fee_id}/mark-paid`
`{ "amount_paid" }` → the updated `FeeOut`. Sets `paid_at` to now and `status` to
`paid` when `amount_paid >= amount_due`, otherwise back to `due`. The value
replaces `amount_paid` — it is not added to it, so partial payments must be sent
as a running total.

---

## Attendance — `/api/attendance`

### `GET /attendance?batch_id=&on_date=`
Both parameters required. 404 if the batch is outside the institute.

### `POST /attendance` → 200
```json
{ "batch_id": 1, "date": "2026-08-24",
  "entries": [ { "student_id": 7, "status": "present" } ] }
```
Upserts: an existing row for the same (student, date) has its status updated,
otherwise a new row is inserted with `marked_by` set to the caller. Returns the
full list of affected rows. Status is one of `present`, `absent`, `late`.

---

## Test scores — `/api/test-scores`

### `GET /test-scores`
Optional `batch_id`, `student_id`. Newest test date first. Each row includes
`student_name`.

### `POST /test-scores` → 201
`{ "student_id", "batch_id", "test_name", "subject"?, "max_marks",
"marks_obtained", "test_date", "remarks"? }`. 404 if the batch is outside the
institute.

### `GET /test-scores/report?batch_id=`
Aggregates every score in the batch per student and sorts by percentage
descending:

```json
[ { "student_id": 7, "student_name": "Rahul Kumar", "tests_taken": 3,
    "total_obtained": 231.0, "total_max": 300.0, "percentage": 77.0 } ]
```
`percentage` is 0 when `total_max` is 0.

---

## Templates — `/api/templates`

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `?category=` | filter by `fee_reminder` or `parent_update` |
| `POST` | `` | 201 |
| `PUT` | `/{template_id}` | full replace |
| `DELETE` | `/{template_id}` | 204; fails if a message log references it |

`TemplateCreate`: `name`, `category`, `language` (default `en`), `body`.

**Placeholders** in `body`, substituted by plain string replacement:

| Token | Manual send | Automated fee reminder | Automated parent update |
| --- | --- | --- | --- |
| `{student_name}` | ✓ | ✓ | ✓ |
| `{parent_name}` | ✓ | ✓ | ✓ |
| `{monthly_fee}` | student's fee | the fee's `amount_due` | — |
| `{institute_name}` | ✓ | — | — |
| `{period}` | — | ✓ (`YYYY-MM`) | — |

Unrecognised tokens are left in the message as written.

---

## Messaging — `/api/messaging`

### `POST /messaging/fee-reminders` and `POST /messaging/parent-updates`
Identical handlers; they differ only in intent, and the category recorded comes
from the **template**, not the path.

```json
{ "template_id": 3, "student_ids": [7, 8, 9] }
```

For each student in the institute: resolve `parent_phone or phone` (skip if
neither), render the template, send through the configured provider, and write a
`message_logs` row. Returns the created logs. 404 unknown template, 400 if no
requested student matched the institute.

A provider failure does not fail the request — the log row records
`status: "failed"` with the error in `provider_response`.

### `GET /messaging/logs`
The 200 most recent logs for the institute, newest first. Not filterable by
category server-side — the UI filters client-side.

---

## Automations — `/api/automations` · **admin**

### `GET /automations`
Every setting for the institute (at most one per category).

### `PUT /automations`
Upsert by (institute, category):

```json
{ "category": "fee_reminder", "enabled": true, "day_of_month": 5, "template_id": 3 }
```

`day_of_month` defaults to 1 and is not range-checked. `template_id` may be null,
in which case the scheduler skips the automation. The template is not validated
as belonging to the institute (see KNOWN-ISSUES).

---

## Setup — `/api/setup`

### `GET /setup/status`
Drives the onboarding checklist:

```json
{ "has_batches": true, "has_students": true, "has_templates": false,
  "batch_count": 2, "student_count": 37, "template_count": 0 }
```

### `POST /setup/import-students`
A JSON array of `StudentCreate` objects, created in one transaction under the
caller's institute. Returns the created students. `batch_id` values are not
validated against the institute (see KNOWN-ISSUES).
