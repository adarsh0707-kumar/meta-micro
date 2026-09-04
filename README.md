# meta-micro

A micro SaaS for automating coaching-centre operations, built for local
institutes in Patna. Manages students and batches, tracks monthly fees,
records attendance, enters test scores, and sends bilingual (Hindi/English)
fee reminders and parent updates over WhatsApp.

Built from the project's System Requirements Document — see `2a. Product
Interpretation`, `3. Functional Requirements`, and `6. Visuals Colors and
Theme` for the source spec this implementation follows.

## Documentation

Full docs live in [`docs/`](docs/):

- [PRD](docs/PRD.md) — users, scope, flows, success measures
- [Architecture](docs/ARCHITECTURE.md) — system shape, request path, decisions
- [Data model](docs/DATA-MODEL.md) — tables, constraints, enums
- [API reference](docs/API.md) — every endpoint
- [Operations](docs/OPERATIONS.md) — config, logging, scheduler, runbook
- [Known issues](docs/KNOWN-ISSUES.md) — open defects, most severe first

## Stack

- **Frontend**: React (Vite) + Tailwind CSS + react-i18next, talking to the
  API over `/api`.
- **Backend**: FastAPI + SQLAlchemy + PostgreSQL, JWT auth, APScheduler for
  monthly automations.
- **Messaging**: a pluggable WhatsApp provider — logs messages in dev, calls
  Meta's WhatsApp Cloud API in production once credentials are configured.

## Project layout

```
meta-micro/
├── backend/           FastAPI app
│   ├── app/
│   │   ├── core/      config, database, security, auth deps
│   │   ├── models/    SQLAlchemy models (Institute, User, Student, Batch, …)
│   │   ├── schemas/   Pydantic request/response schemas
│   │   ├── routers/   one router per resource (students, batches, fees, …)
│   │   └── services/  WhatsApp provider abstraction + automation scheduler
│   └── requirements.txt
├── frontend/          React app
│   └── src/
│       ├── api/       axios client + typed endpoint calls
│       ├── context/    auth context
│       ├── i18n/       English/Hindi translations
│       ├── layouts/    dashboard shell with sidebar nav
│       └── pages/      Landing, Login, Sign Up, and every dashboard page
└── docker-compose.yml
```

## Running locally

### With Docker Compose (recommended)

```bash
cp backend/.env.example backend/.env
docker compose up --build
```

- Frontend: http://localhost:4173
- Backend API: http://localhost:8000/api (proxied through the frontend's
  nginx config too, so the frontend only ever calls relative `/api/...`
  paths)

### Without Docker

**Backend** (needs a local PostgreSQL, or point `DATABASE_URL` at SQLite for
quick experiments):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # edit DATABASE_URL etc. as needed
uvicorn app.main:app --reload
```

**Frontend**:

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` to `http://localhost:8000` (configurable
via `VITE_API_PROXY_TARGET`).

## WhatsApp integration

`WHATSAPP_PROVIDER` in `backend/.env` controls how outgoing messages are
sent:

- `log` (default): messages are logged instead of sent — safe for local
  development, no WhatsApp credentials required.
- `meta_cloud_api`: sends real messages through Meta's WhatsApp Business
  Cloud API. Requires `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_ACCESS_TOKEN`
  from a Meta Business/WhatsApp Business Platform account.

Every send — manual or automated — is recorded in the `message_logs` table
and visible on the Fee Reminders / Parent Updates pages.

## Core flows

1. **Admin enrollment** — an institute admin signs up on `/signup`, which
   creates the institute and the admin's account, then lands on `/app/setup`.
2. **Setup** — the admin adds batches, students, and bilingual message
   templates (tracked by the Setup page's checklist).
3. **Attendance** — a teacher marks a batch's attendance for a given date.
4. **Test scores** — a teacher enters marks per test; the app aggregates a
   per-student percentage report per batch.
5. **Fee reminders / parent updates** — the admin picks a template and
   recipients and sends a WhatsApp broadcast; every send is logged.
6. **Automations** — the admin enables a monthly day-of-month trigger per
   category (fee reminder / parent update) with a chosen template; a
   background scheduler fires it automatically.

## Design system

Palette, typography, and shape language follow the SRD's "muse":
cream background (`#FAF3E0`), coral primary (`#FF6F61`), gold accent
(`#FFD700`), dark ink text (`#333333`), Sora for headings, Outfit for body
text, chunky rounded cards, and an animated, character-led landing hero.
