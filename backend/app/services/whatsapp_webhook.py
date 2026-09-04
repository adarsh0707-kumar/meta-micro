"""Ingest for Meta's WhatsApp webhook.

Meta POSTs here for two kinds of event:

- `value.messages[]`  -- a parent messaged the business number. This is what
  opens the 24-hour customer service window in which free-form text is allowed.
- `value.statuses[]`  -- a delivery receipt for something we sent
  (sent / delivered / read / failed), keyed by the same `wamid` the send returned.

The endpoint is public, because Meta calls it. Authenticity comes from the
X-Hub-Signature-256 header, an HMAC of the raw body with the app secret -- so the
raw bytes must be verified before the JSON is trusted.
"""

import hashlib
import hmac
import json
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.models import Student, WhatsAppEvent
from app.services.whatsapp import normalise_phone

logger = logging.getLogger("meta_micro.whatsapp")

# Meta allows free-form text only within 24 hours of the contact's last message.
SERVICE_WINDOW = timedelta(hours=24)


def verify_signature(raw_body: bytes, signature_header: str | None) -> bool:
    """Constant-time check of X-Hub-Signature-256.

    Returns False when no app secret is configured: an unverified public endpoint
    that writes to the database is worse than one that rejects everything, since
    anyone could forge inbound messages and open a send window.
    """
    settings = get_settings()
    if not settings.whatsapp_app_secret:
        return False
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(
        settings.whatsapp_app_secret.encode(),
        raw_body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header.removeprefix("sha256="))


def _resolve_contact(db: Session, phone: str) -> tuple[int | None, int | None]:
    """Best-effort match of a phone number to a student, and so an institute.

    Numbers are stored as typed, so compare on the normalised form. A parent
    number shared across institutes resolves to whichever student matches first;
    that ambiguity is inherent to one WhatsApp account serving every institute.
    """
    for student in db.query(Student).filter(
        (Student.parent_phone.isnot(None)) | (Student.phone.isnot(None))
    ):
        for candidate in (student.parent_phone, student.phone):
            if candidate and normalise_phone(candidate) == phone:
                return student.institute_id, student.id
    return None, None


def process_payload(payload: dict, db: Session) -> int:
    """Records every message and status in the payload. Returns the count stored."""
    stored = 0
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            metadata = value.get("metadata", {})
            phone_number_id = metadata.get("phone_number_id")

            # Profile names arrive alongside the messages, keyed by wa_id.
            names = {
                normalise_phone(c.get("wa_id")): c.get("profile", {}).get("name")
                for c in value.get("contacts", [])
                if c.get("wa_id")
            }

            for message in value.get("messages", []):
                phone = normalise_phone(message.get("from"))
                if not phone:
                    continue
                institute_id, student_id = _resolve_contact(db, phone)
                db.add(
                    WhatsAppEvent(
                        event_type="inbound",
                        wa_message_id=message.get("id"),
                        contact_phone=phone,
                        contact_name=names.get(phone),
                        phone_number_id=phone_number_id,
                        # Only text bodies are read; media and interactive replies
                        # are still recorded, with the type as the body.
                        body=message.get("text", {}).get("body") or f"[{message.get('type')}]",
                        institute_id=institute_id,
                        student_id=student_id,
                        occurred_at=_ts(message.get("timestamp")),
                        raw=json.dumps(message),
                    )
                )
                stored += 1
                logger.info("WhatsApp inbound from %s (student_id=%s)", phone, student_id)

            for status in value.get("statuses", []):
                phone = normalise_phone(status.get("recipient_id"))
                if not phone:
                    continue
                db.add(
                    WhatsAppEvent(
                        event_type="status",
                        wa_message_id=status.get("id"),
                        contact_phone=phone,
                        phone_number_id=phone_number_id,
                        status=status.get("status"),
                        occurred_at=_ts(status.get("timestamp")),
                        raw=json.dumps(status),
                    )
                )
                stored += 1
                if status.get("status") == "failed":
                    logger.warning("WhatsApp delivery failed to %s: %s", phone, status.get("errors"))

    if stored:
        db.commit()
    return stored


def _ts(raw: str | None) -> datetime:
    """Meta sends unix seconds as a string."""
    try:
        return datetime.fromtimestamp(int(raw), tz=timezone.utc)
    except (TypeError, ValueError):
        return datetime.now(timezone.utc)


def last_inbound_at(db: Session, phones: set[str]) -> dict[str, datetime]:
    """Most recent inbound message per phone, for the numbers asked about."""
    if not phones:
        return {}
    rows = (
        db.query(WhatsAppEvent.contact_phone, WhatsAppEvent.occurred_at)
        .filter(WhatsAppEvent.event_type == "inbound", WhatsAppEvent.contact_phone.in_(phones))
        .all()
    )
    latest: dict[str, datetime] = {}
    for phone, occurred_at in rows:
        if occurred_at.tzinfo is None:
            occurred_at = occurred_at.replace(tzinfo=timezone.utc)
        if phone not in latest or occurred_at > latest[phone]:
            latest[phone] = occurred_at
    return latest


def within_service_window(last_inbound: datetime | None) -> bool:
    if last_inbound is None:
        return False
    return datetime.now(timezone.utc) - last_inbound < SERVICE_WINDOW
