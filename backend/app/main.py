import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.database import Base, engine
from app.routers import (
    attendance,
    auth,
    automations,
    batches,
    fees,
    institute,
    messaging,
    setup,
    staff,
    students,
    templates,
    test_scores,
    whatsapp,
)
from app.services.scheduler import start_scheduler

settings = get_settings()

# uvicorn configures only its own loggers and leaves the root logger at WARNING
# with no handlers, which silently discards everything the app logs at INFO --
# including every message the dev WhatsApp provider reports "sending".
logging.basicConfig(
    level=settings.log_level.upper(),
    format="%(asctime)s %(levelname)-8s %(name)s %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    scheduler = start_scheduler()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(batches.router)
app.include_router(students.router)
app.include_router(fees.router)
app.include_router(attendance.router)
app.include_router(test_scores.router)
app.include_router(templates.router)
app.include_router(messaging.router)
app.include_router(automations.router)
app.include_router(setup.router)
app.include_router(staff.router)
app.include_router(institute.router)
app.include_router(whatsapp.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.app_name}
