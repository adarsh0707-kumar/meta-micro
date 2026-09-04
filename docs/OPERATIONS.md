# Operations

## 1. Running the stack

### Docker Compose

```bash
cp backend/.env.example backend/.env     # required — compose reads it via env_file
docker compose up --build
```

- Frontend — http://localhost:4173
- API — http://localhost:8000/api, interactive docs at http://localhost:8000/docs
- Postgres — localhost:5432 (`meta_micro` / `meta_micro` / db `meta_micro`)

`backend/.env` is gitignored and never committed, so a fresh clone has no such
file and `docker compose up` fails on the missing `env_file` until you copy the
example. Compose overrides `DATABASE_URL` to point at the `db` service
regardless of what the file says; every other variable comes from the file.

The backend waits for the database's `pg_isready` healthcheck before starting.

### Without Docker

Backend (needs PostgreSQL, or point `DATABASE_URL` at SQLite for experiments):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173, proxies /api to :8000
npm run build        # production build into dist/
npm run lint
```

Set `VITE_API_PROXY_TARGET` to point the dev proxy somewhere other than
`http://localhost:8000`.

## 2. Configuration

Read by `Settings` in [`core/config.py`](../backend/app/core/config.py) from the
environment or `backend/.env`. Unknown keys are ignored (`extra="ignore"`).

| Variable | Default | Purpose |
| --- | --- | --- |
| `APP_NAME` | `meta-micro` | Shown in the OpenAPI title and `/health` |
| `DATABASE_URL` | local postgres URL | SQLAlchemy URL; Compose overrides it |
| `JWT_SECRET` | `change-me-in-production` | HS256 signing key — **must** be changed before deploying |
| `JWT_ALGORITHM` | `HS256` | |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `10080` (7 days) | Token lifetime |
| `WHATSAPP_PROVIDER` | `log` | `log` or `meta_cloud_api` |
| `WHATSAPP_PHONE_NUMBER_ID` | empty | From the Meta WhatsApp Business Platform |
| `WHATSAPP_ACCESS_TOKEN` | empty | Bearer token for the Cloud API |
| `WHATSAPP_API_BASE_URL` | `https://graph.facebook.com/v20.0` | Graph API version pin |
| `CORS_ORIGINS` | `["http://localhost:5173"]` | **JSON array** — a bare comma-separated string fails to parse and the app will not boot |

Settings are cached with `@lru_cache`, so a change requires a process restart.

### Going live with WhatsApp

1. Set `WHATSAPP_PROVIDER=meta_cloud_api`.
2. Set `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_ACCESS_TOKEN`.
3. Restart the backend and send one message to a known number; confirm the
   `message_logs` row has `status: sent` and a JSON `provider_response`.

If the token is blank the app silently falls back to the log provider — messages
appear to succeed but nothing is delivered. Step 3 is the only way to be sure.

Meta's Cloud API only accepts free-form text within a 24-hour customer service
window; outside it, sends require a pre-approved message template registered with
Meta. `MetaCloudApiProvider` sends `type: "text"` only, so first-contact
reminders to a parent who has not messaged the business number will be rejected
by Meta and recorded as `failed`.

## 3. Logging

There is no logging configuration file. The backend inherits uvicorn's default
handlers writing to stdout, which Docker captures.

Named loggers:

| Logger | Emits |
| --- | --- |
| `meta_micro.whatsapp` | INFO for every message the log provider "sends" (recipient + full body); WARNING when a Cloud API send fails |
| `meta_micro.scheduler` | ERROR with traceback when an automation run raises |

Everything else is uvicorn's access and error logs.

```bash
docker compose logs -f backend                    # follow
docker compose logs backend | grep meta_micro     # app loggers only
docker compose logs backend | grep scheduler      # automation failures
```

Two things worth knowing:

- The log provider writes **message bodies containing parent and student names
  and phone numbers** at INFO. That is fine in development; if the log provider
  is ever left on in an environment with real data, those logs hold personal
  information.
- A successful automation run logs nothing at all. Silence does not distinguish
  "ran, nothing due" from "the scheduler never started". The `message_logs` table
  is the reliable record of what happened.

### Application-level audit trail

`message_logs` is the durable log of outbound communication — rendered body,
recipient, status, and provider response per attempt, never updated after
insert. Query it directly to investigate a delivery complaint:

```sql
SELECT sent_at, recipient_phone, status, provider_response
FROM message_logs
WHERE institute_id = 1
ORDER BY sent_at DESC
LIMIT 50;
```

## 4. Scheduler

One APScheduler cron job at **09:00 server time** (the container's timezone — UTC
unless set), registered as `daily_automations` when the app starts.

It runs in-process in every backend container, so **do not scale the backend past
one replica** — each would fire the same automations and parents would receive
duplicate messages. Moving to multiple replicas requires an external job store
with locking, or extracting the scheduler into its own single-instance service.

To test an automation without waiting for 09:00, set `day_of_month` to today and
call `run_due_automations()` directly:

```bash
docker compose exec backend python -c \
  "from app.services.scheduler import run_due_automations; run_due_automations()"
```

## 5. Database

Schema is created by `Base.metadata.create_all` at startup — new tables and
columns appear only for a fresh database. **There are no migrations**, so an
additive change to an existing deployment must be applied by hand, and a
destructive one means recreating the volume:

```bash
docker compose down -v && docker compose up --build     # DESTROYS ALL DATA
```

Backup and restore:

```bash
docker compose exec db pg_dump -U meta_micro meta_micro > backup.sql
cat backup.sql | docker compose exec -T db psql -U meta_micro meta_micro
```

Adopting Alembic (already a dependency) before this holds real institute data is
the single highest-value operational change available.

## 6. Testing

`backend/smoke_test.py` runs the primary path — health, signup, `/me`, batch,
student, fee, fee summary, template, attendance, fee reminder — against an
in-file SQLite database via `TestClient`:

```bash
cd backend && python smoke_test.py     # writes ./smoke_test.db
```

It asserts on status codes and prints each response. It is not a test suite:
there is no runner, no fixtures, no teardown, and no coverage of authorisation,
tenancy, or failure paths.

## 7. Pre-production checklist

- [ ] `JWT_SECRET` replaced with a random secret; rotating it invalidates every
      issued token, which is the only way to force logout
- [ ] Postgres password changed from `meta_micro` and port 5432 not published
- [ ] `CORS_ORIGINS` set to the real frontend origin as a JSON array
- [ ] WhatsApp credentials set and verified by an end-to-end send
- [ ] Backend running as exactly one replica
- [ ] Backups scheduled
- [ ] The tenancy defects in [KNOWN-ISSUES.md](KNOWN-ISSUES.md) fixed — they are
      cross-institute data leaks
