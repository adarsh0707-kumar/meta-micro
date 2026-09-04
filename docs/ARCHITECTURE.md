# Architecture

## 1. System shape

Three containers, defined in [`docker-compose.yml`](../docker-compose.yml):

```
                    ┌──────────────────────────────┐
  browser ─────────▶│ frontend  (nginx :4173)      │
                    │  · serves the Vite build      │
                    │  · proxies /api/ → backend    │
                    └───────────────┬──────────────┘
                                    │  /api/...
                                    ▼
                    ┌──────────────────────────────┐        ┌────────────────────┐
                    │ backend  (uvicorn :8000)     │───────▶│ Meta WhatsApp      │
                    │  · FastAPI routers            │  https │ Cloud API (prod)   │
                    │  · APScheduler (daily 09:00)  │        └────────────────────┘
                    └───────────────┬──────────────┘
                                    │  psycopg2
                                    ▼
                    ┌──────────────────────────────┐
                    │ db  (postgres:16-alpine)     │
                    │  volume meta_micro_db_data    │
                    └──────────────────────────────┘
```

The browser only ever calls relative `/api/...` paths. In production nginx
proxies those to `backend:8000`; in development the Vite dev server proxies them
to `http://localhost:8000` (override with `VITE_API_PROXY_TARGET`). Nothing in
the frontend holds an absolute API URL, so the same build runs anywhere.

Port 8000 is also published directly for API access and the FastAPI docs at
`http://localhost:8000/docs`.

## 2. Request path

```
axios client (baseURL "/api")
  └─ request interceptor: attaches Bearer token from localStorage["meta_micro_token"]
  └─ nginx / vite proxy
      └─ FastAPI router  (prefix /api/<resource>)
          └─ Depends(get_current_user)  → decodes JWT, loads User, checks is_active
             Depends(require_admin)     → additionally requires role == admin
          └─ Depends(get_db)            → SessionLocal, closed in a finally block
          └─ SQLAlchemy query, always filtered by user.institute_id
          └─ Pydantic response model (from_attributes=True)
  └─ response interceptor: on 401, clears the token and redirects to /login
```

## 3. Backend

**Framework** — FastAPI 0.115 on uvicorn, SQLAlchemy 2.0 with the typed
`Mapped[]` declarative style, Pydantic v2 for schemas and settings.

**Layout** ([`backend/app/`](../backend/app/)):

| Package | Contents |
| --- | --- |
| `core/config.py` | `Settings` (pydantic-settings, reads `.env`), memoised by `@lru_cache` |
| `core/database.py` | Engine with `pool_pre_ping`, `SessionLocal`, `Base`, the `get_db` dependency |
| `core/security.py` | bcrypt hashing via passlib; JWT encode/decode via python-jose |
| `core/deps.py` | `get_current_user`, `require_admin` |
| `models/models.py` | All nine tables and five enums in one module |
| `schemas/schemas.py` | Request and response models, grouped by resource |
| `routers/` | One router per resource, each with its own `/api/<name>` prefix |
| `services/whatsapp.py` | Provider abstraction + template rendering |
| `services/scheduler.py` | APScheduler job that fires due automations |

**Startup** ([`main.py`](../backend/app/main.py)) — an async lifespan context
calls `Base.metadata.create_all(bind=engine)`, starts the background scheduler,
yields, and shuts the scheduler down on exit. CORS middleware is configured from
`settings.cors_origins`.

**Schema management** — tables are created from the models at startup. Alembic is
in `requirements.txt` but no migration directory exists, so a column change today
means dropping the volume or altering by hand. See KNOWN-ISSUES.

## 4. Multi-tenancy

`Institute` is the tenant. `User`, `Batch`, `Student`, `Template`, `Attendance`,
`TestScore`, `MessageLog`, and `AutomationSetting` all carry `institute_id`
directly; `Fee` reaches it through its student, so fee queries join `Student` and
filter there.

There is no database-level row policy. Isolation is enforced by each route
filtering on `institute_id`, which proved easy to omit — five routes accepted an
id from the request body without checking it. Those are fixed, and the checks now
live in [`core/tenancy.py`](../backend/app/core/tenancy.py): `get_owned` for a
single row, `assert_students_in_batch` for bulk membership. Any new route that
takes an id from the caller should use them rather than hand-writing the filter.

## 5. Authentication

Stateless JWT. `create_access_token` puts the user id in `sub` with an expiry
(default 7 days, `ACCESS_TOKEN_EXPIRE_MINUTES=10080`) signed HS256 with
`JWT_SECRET`. `HTTPBearer` extracts the header; `get_current_user` decodes,
loads the user, and rejects inactive accounts. There is no refresh token,
revocation list, or logout on the server — logout clears `localStorage`.

Passwords are bcrypt-hashed by passlib. Signup creates institute and admin in
one transaction (`db.flush()` to get the institute id, then a single commit).
Teacher invites are admin-only and set a temporary password chosen by the admin;
there is no email delivery and no forced password change on first login.

## 6. Messaging

[`services/whatsapp.py`](../backend/app/services/whatsapp.py) defines an abstract
`WhatsAppProvider` with a single method:

```python
send_message(to_phone: str, body: str) -> tuple[bool, str]   # (success, response_or_error)
```

Two implementations:

- **`LogWhatsAppProvider`** — the default. Logs the recipient and body at INFO on
  the `meta_micro.whatsapp` logger and reports success. No credentials needed.
- **`MetaCloudApiProvider`** — POSTs a `text` message to
  `{api_base_url}/{phone_number_id}/messages` with a bearer token, 10s timeout.
  HTTP errors are caught, logged at WARNING, and returned as a failure rather
  than raised, so one bad number cannot abort a broadcast.

`get_whatsapp_provider()` picks per call. With `WHATSAPP_PROVIDER=meta_cloud_api`
it returns the Cloud API provider, or raises `WhatsAppConfigError` when the token
or phone-number id is missing — it does **not** fall back to logging, because a
reminder that was never sent must not look like one that was. The API turns that
into a 503; the scheduler logs it and skips the run. `provider_status()` exposes
the same judgement to the UI so a send screen can say plainly whether messages
will reach a phone.

Outbound numbers pass through `normalise_phone`, which strips punctuation and
adds a country code (`090000-00001` and `+91 90000 00001` both become
`919000000001`). Anything that cannot be made into 10–15 digits is treated as
undeliverable rather than sent into the void.

Sending itself is two-step: `POST /messaging/preview` renders every message and
flags who would be skipped, and the send endpoints refuse a payload without
`confirm: true`. Recipients are capped at 500 per call.

`render_template(body, context)` does plain `{key}` → value string replacement.
Available placeholders: `student_name`, `parent_name`, `monthly_fee`,
`institute_name` for manual sends; automated fee reminders substitute the fee's
`amount_due` for `monthly_fee` and add `period`. Unknown placeholders are left
in the text verbatim.

Recipient resolution is `student.parent_phone or student.phone`; a student with
neither is skipped silently.

## 7. Automations

[`services/scheduler.py`](../backend/app/services/scheduler.py) registers one
APScheduler cron job, `daily_automations`, at 09:00 server time. Each run:

1. Loads every `AutomationSetting` where `enabled` is true and `day_of_month`
   equals today's day — across all institutes, in one query.
2. For each, resolves the template; skips the setting if it has none.
3. Builds the recipient list — for `fee_reminder`, every fee for that institute
   whose status is not `paid`; for `parent_update`, every active student.
4. Renders and sends per recipient, writing a `MessageLog` row for each.
5. Commits per setting. The whole run is wrapped in a try/except that logs the
   traceback to `meta_micro.scheduler`.

The scheduler runs in-process in every backend container. Running more than one
replica would send duplicate messages — there is no leader election or job store.

## 8. Frontend

React 18 + React Router 6 + Tailwind + react-i18next + axios.

- [`App.jsx`](../frontend/src/App.jsx) — `/`, `/login`, `/signup` public;
  everything under `/app` wrapped in `ProtectedRoute` and rendered inside
  `DashboardLayout`; unknown paths redirect to `/`.
- [`context/AuthContext.jsx`](../frontend/src/context/AuthContext.jsx) — holds
  `user` and `institute`, exposes `login`/`signup`/`logout`/`refreshMe`. On mount
  it calls `/auth/me` if a token exists and applies the institute's default
  language. A failed `/auth/me` clears the token.
- [`api/client.js`](../frontend/src/api/client.js) — the axios instance and both
  interceptors. [`api/api.js`](../frontend/src/api/api.js) is a flat map of every
  endpoint grouped by resource; pages never build URLs themselves.
- [`layouts/DashboardLayout.jsx`](../frontend/src/layouts/DashboardLayout.jsx) —
  sidebar with ten nav items, collapsible on mobile, language toggle, and the
  logout button.
- `components/SendMessagePanel.jsx` is shared by the Fee Reminders and Parent
  Updates pages, which are nine-line wrappers differing only in category and
  send function.
- Design tokens live in [`tailwind.config.js`](../frontend/tailwind.config.js) —
  palette, Sora/Outfit families, an `h1`–`h4` type scale, `rounded-chunky`, and
  the offset `card`/`pop` shadows. Component classes (`.btn-primary`, `.card`,
  `.input`, `.label`) are defined in `src/index.css`.

## 9. Key decisions and their trade-offs

| Decision | Why | Cost |
| --- | --- | --- |
| Provider abstraction for WhatsApp | Full local development with no Meta account | Silent fallback to logging if prod config is incomplete |
| JWT in `localStorage` | Simplest thing that works with a static frontend | Readable by any XSS on the origin; no server-side revocation |
| `create_all` at startup | Zero migration setup for a young schema | No path to evolve a schema that holds real data |
| In-process APScheduler | One less service to run | Cannot scale the backend past one replica |
| Per-route tenancy filters | No ORM machinery to learn | Easy to forget — it was missed on five routes; now centralised in `core/tenancy.py` |
| Fee status stored, not derived | Simple queries | Nothing ever transitions a fee to `overdue` |
