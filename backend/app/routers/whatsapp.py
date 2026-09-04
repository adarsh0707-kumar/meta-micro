"""Public webhook endpoints for Meta's WhatsApp Cloud API.

Both routes are unauthenticated because Meta calls them directly. The GET is the
one-time subscription handshake; the POST is verified by HMAC signature instead
of a bearer token.
"""

import json
import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.models import User, WhatsAppEvent
from app.services.whatsapp_webhook import process_payload, verify_signature

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])
logger = logging.getLogger("meta_micro.whatsapp")


@router.get("/webhook")
def verify_webhook(
    mode: str | None = Query(None, alias="hub.mode"),
    token: str | None = Query(None, alias="hub.verify_token"),
    challenge: str | None = Query(None, alias="hub.challenge"),
):
    """Meta's subscription handshake: echo hub.challenge if the token matches.

    The verify token is whatever you type into the Meta dashboard; it must equal
    WHATSAPP_VERIFY_TOKEN here.
    """
    settings = get_settings()
    if not settings.whatsapp_verify_token:
        raise HTTPException(status_code=503, detail="WHATSAPP_VERIFY_TOKEN is not configured")
    if mode == "subscribe" and token == settings.whatsapp_verify_token:
        return Response(content=challenge or "", media_type="text/plain")
    logger.warning("Rejected webhook verification: mode=%s", mode)
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/webhook")
async def receive_webhook(
    request: Request,
    x_hub_signature_256: str | None = Header(None),
    db: Session = Depends(get_db),
):
    """Records inbound messages and delivery statuses.

    Always answers 200 once the signature is valid, even if the body is
    unrecognised -- Meta retries on any non-2xx, and a parse failure would
    otherwise turn into a redelivery loop.
    """
    raw = await request.body()
    if not verify_signature(raw, x_hub_signature_256):
        # Also the response when WHATSAPP_APP_SECRET is unset: without it the
        # endpoint cannot tell Meta apart from anyone else on the internet.
        raise HTTPException(status_code=403, detail="Invalid or unverifiable signature")

    try:
        payload = json.loads(raw)
        stored = process_payload(payload, db)
    except Exception:
        logger.exception("Failed to process WhatsApp webhook payload")
        return {"received": True, "stored": 0}

    return {"received": True, "stored": stored}


@router.get("/inbound")
def list_inbound(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Recent inbound messages belonging to this institute's students."""
    events = (
        db.query(WhatsAppEvent)
        .filter(
            WhatsAppEvent.event_type == "inbound",
            WhatsAppEvent.institute_id == user.institute_id,
        )
        .order_by(WhatsAppEvent.occurred_at.desc())
        .limit(100)
        .all()
    )
    return [
        {
            "id": e.id,
            "contact_phone": e.contact_phone,
            "contact_name": e.contact_name,
            "student_id": e.student_id,
            "body": e.body,
            "occurred_at": e.occurred_at,
        }
        for e in events
    ]
