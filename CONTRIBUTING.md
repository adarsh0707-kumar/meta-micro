# Contributing to meta-micro

This is a small codebase with a few sharp edges that are easy to cut yourself on
— tenant isolation, a schema with no migrations, and a scheduler that must not
be scaled. This guide covers them. For how the system fits together, read
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) first.

## Getting set up

```bash
cp backend/.env.example backend/.env
docker compose up --build
```

Frontend on http://localhost:4173, API on http://localhost:8000, interactive API
docs on http://localhost:8000/docs. `backend/.env` is gitignored, so the copy
step is required — Compose fails on the missing `env_file` without it.

If port 5432 is already taken by another project's Postgres, the `db` container
will not start. Publishing that port is not needed for development — the backend
reaches the database over the Compose network — so either drop the `ports:` entry
from the `db` service locally or remap it with an override file.

For running the pieces outside Docker, see
[`docs/OPERATIONS.md`](docs/OPERATIONS.md).

## The rule that matters most: tenant isolation

Every row belongs to exactly one institute, and a caller must never reach another
institute's data. This has been broken five separate times, in five different
routes, always the same way: **an id arrives in the request body and gets used
without checking who owns it.**

Validating the parent object is not enough. This is the shape of the bug:

```python
# WRONG -- the batch is checked, the student is not
batch = db.query(Batch).filter(Batch.id == payload.batch_id,
                               Batch.institute_id == user.institute_id).first()
score = TestScore(institute_id=user.institute_id, student_id=payload.student_id, ...)
```

Use the helpers in [`backend/app/core/tenancy.py`](backend/app/core/tenancy.py)
instead of hand-writing the filter:

```python
from app.core.tenancy import get_owned, assert_students_in_batch

template = get_owned(db, Template, payload.template_id, user)      # single row -> 404
assert_students_in_batch(db, {e.student_id for e in entries},      # bulk -> 400
                         payload.batch_id, user)
```

Rules of thumb:

- **Every id that comes from the caller gets checked** — path parameters, body
  fields, and query filters alike. Not just the "main" one.
- Out-of-tenant rows return **404, not 403**. A caller should not be able to
  learn which ids exist elsewhere.
- Queries that mutate existing rows need the `institute_id` filter in the lookup
  too, not only in a preceding validation. The attendance bug was a correct
  validation followed by an unscoped `.filter(...).first()`.
- `Fee` has no `institute_id` — it reaches the tenant through `Student`, so fee
  queries must `join(Student)` and filter there.

When you add a route, write the cross-tenant attack against it before you call it
done. Two institutes, one reaching for the other's id, and confirm the 4xx. See
"Verifying a change" below.

## Adding an endpoint

1. Model changes in `models/models.py` — but read the migrations note below first.
2. Request/response models in `schemas/schemas.py`, grouped under the existing
   `# ---------- Resource ----------` comment banners. Use `Field` constraints for
   anything with a valid range; `AutomationUpdate.day_of_month` is the example.
3. The route in `routers/<resource>.py`, with `Depends(get_current_user)` or
   `Depends(require_admin)`, and tenancy checks on every caller-supplied id.
4. Register the router in `main.py` if it is new.
5. Add the call to `frontend/src/api/api.js` — pages import from there and never
   build URLs themselves.
6. Update [`docs/API.md`](docs/API.md) in the same change.

## Schema changes have no migration path

Alembic is in `requirements.txt` but there is no `alembic.ini` and no versions
directory. The schema comes from `Base.metadata.create_all` at startup, which
creates missing tables but **never alters an existing one**. In practice:

- A new table appears on the next restart.
- A new column on an existing table does not. It needs a hand-written `ALTER`, or
  recreating the volume (`docker compose down -v`, which destroys all data).
- Enum values are native Postgres types; adding one needs `ALTER TYPE`.

If your change needs a column, say so in the PR — that is the trigger for
adopting Alembic properly, which is worth doing before this holds real institute
data.

## Code style

There is no Python formatter or linter configured, so match the surrounding code
rather than your editor's defaults:

- Lines run to about 120 characters.
- Imports in three groups — stdlib, third-party, then `app.*` — alphabetised
  within each.
- SQLAlchemy models use the typed `Mapped[]` declarative style.
- Pydantic response models set `model_config = ConfigDict(from_attributes=True)`.
- Comments explain *why*, and are used sparingly. Follow that.

Frontend has ESLint: `cd frontend && npm run lint`. It must pass clean.

### The `Decimal` trap

Money and marks columns are declared `Mapped[float]` over a SQLAlchemy `Numeric`.
The annotation is a lie — the driver returns `Decimal`. The `float(...)` casts in
`fees.py` and `test_scores.py` are load-bearing; removing one raises `TypeError`
when it meets a `float`. Cast at the boundary before doing arithmetic.

## Verifying a change

Run the smoke script, which exercises the primary path against SQLite:

```bash
docker compose exec backend sh -c 'cd /app && rm -f smoke_test.db && python smoke_test.py'
```

It must end with `ALL SMOKE TESTS PASSED`. Be honest about what it is, though: a
script with asserts covering the happy path. **There is no test suite**, no
runner, no fixtures, and no coverage of authorisation or tenancy. None of the
five tenancy bugs would have been caught by it.

So for anything touching data access, verify by hand as well — create a second
institute and try to reach the first one's rows:

```bash
A=localhost:8000/api
T=$(curl -s -X POST $A/auth/signup -H 'Content-Type: application/json' \
  -d '{"institute_name":"Rival","admin_name":"M","email":"m@rival.in","password":"password12345"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
# now aim a request at institute 1's ids using $T and confirm you get a 4xx
curl -s -X POST $A/test-scores -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
  -d '{"student_id":1,"batch_id":<your own>,"test_name":"x","max_marks":100,"marks_obtained":0,"test_date":"2026-01-01"}'
```

Adding a real test suite is the most valuable contribution available right now,
and would let the checks above stop being manual.

Also confirm your change does not break the *legitimate* path. A tenancy
predicate that is too strict silently blocks the owning institute, which is
harder to notice than a leak.

## Things that will surprise you

- **`CORS_ORIGINS` must be a JSON array.** pydantic-settings parses it as
  `list[str]`; a bare comma-separated string fails to parse and the app will not
  boot.
- **Do not scale the backend past one replica.** APScheduler runs in-process, so
  a second replica double-sends every automated WhatsApp message to parents.
- **The WhatsApp provider falls back silently.** With `WHATSAPP_PROVIDER=meta_cloud_api`
  but a blank token, sends are logged rather than delivered and still report
  `sent`. Check the `message_logs` row, not the HTTP status.
- **`logging.basicConfig` in `main.py` is load-bearing.** uvicorn configures only
  its own loggers and leaves root at WARNING with no handlers; remove that call
  and every `meta_micro.*` INFO line silently disappears.
- **`PUT` routes are full replaces.** Any optional field the client omits is set
  to null. The frontend sends complete objects; new callers should too.

## Docs

Docs live in [`docs/`](docs/) and describe what the code does *today*, not what
it should eventually do. Update the relevant page in the same change:
`API.md` for endpoints, `DATA-MODEL.md` for schema, `ARCHITECTURE.md` for
structure, `OPERATIONS.md` for config or deployment, and `KNOWN-ISSUES.md` when
you fix something on it or find something new.

If you find a defect you are not fixing, add it to `KNOWN-ISSUES.md` with a file
reference and a concrete description of what goes wrong. A known bug that is
written down is worth far more than one that is not.

## Commits and pull requests

- Subject line in the imperative with a `type:` prefix — `fix:`, `docs:`, `feat:`.
- Explain *why* in the body, and what you verified. For a bug fix, state the
  behaviour before and after.
- Branch off `main`; do not push directly to it.
- Say explicitly in the PR if your change needs a schema change, alters tenancy
  checks, or touches the scheduler — those are the three areas where a mistake is
  expensive and hard to reverse.
