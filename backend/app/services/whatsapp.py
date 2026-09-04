"""WhatsApp messaging provider abstraction.

meta-micro talks to WhatsApp through a small interface so the dev/test
environment never needs real WhatsApp Business API credentials. Set
WHATSAPP_PROVIDER=meta_cloud_api and the phone-number-id/access-token env
vars to send real messages through Meta's Cloud API in production.
"""

import logging
import re
from abc import ABC, abstractmethod

import httpx

from app.core.config import get_settings

logger = logging.getLogger("meta_micro.whatsapp")


class WhatsAppProvider(ABC):
    @abstractmethod
    def send_message(self, to_phone: str, body: str) -> tuple[bool, str]:
        """Returns (success, provider_response_or_error)."""


class LogWhatsAppProvider(WhatsAppProvider):
    """Development fallback: records the message instead of sending it."""

    def send_message(self, to_phone: str, body: str) -> tuple[bool, str]:
        logger.info("WhatsApp (dev/log provider) -> %s: %s", to_phone, body)
        return True, "logged (no WhatsApp credentials configured)"


class MetaCloudApiProvider(WhatsAppProvider):
    def __init__(self, phone_number_id: str, access_token: str, api_base_url: str):
        self.phone_number_id = phone_number_id
        self.access_token = access_token
        self.api_base_url = api_base_url

    def send_message(self, to_phone: str, body: str) -> tuple[bool, str]:
        url = f"{self.api_base_url}/{self.phone_number_id}/messages"
        headers = {"Authorization": f"Bearer {self.access_token}"}
        payload = {
            "messaging_product": "whatsapp",
            "to": to_phone,
            "type": "text",
            "text": {"body": body},
        }
        try:
            response = httpx.post(url, headers=headers, json=payload, timeout=10.0)
            response.raise_for_status()
            return True, response.text
        except httpx.HTTPError as exc:
            logger.warning("WhatsApp send failed for %s: %s", to_phone, exc)
            return False, str(exc)


class WhatsAppConfigError(RuntimeError):
    """Raised when meta_cloud_api is selected but not usable.

    Previously this case fell back to the log provider, so a misconfigured
    production deploy reported every message as "sent" and delivered nothing.
    Failing is the safer answer: a reminder that was never sent should not look
    like one that was.
    """


def provider_status() -> tuple[str, bool, str]:
    """Returns (provider name, would really send, human-readable detail)."""
    settings = get_settings()
    if settings.whatsapp_provider != "meta_cloud_api":
        return "log", False, "Development log provider: messages are recorded, never delivered."

    missing = [
        name
        for name, value in (
            ("WHATSAPP_ACCESS_TOKEN", settings.whatsapp_access_token),
            ("WHATSAPP_PHONE_NUMBER_ID", settings.whatsapp_phone_number_id),
        )
        if not value
    ]
    if missing:
        return "meta_cloud_api", False, f"Not usable -- missing {', '.join(missing)}."
    return "meta_cloud_api", True, "Meta WhatsApp Cloud API configured; messages are delivered for real."


def get_whatsapp_provider() -> WhatsAppProvider:
    settings = get_settings()
    if settings.whatsapp_provider != "meta_cloud_api":
        return LogWhatsAppProvider()

    _, usable, detail = provider_status()
    if not usable:
        raise WhatsAppConfigError(detail)
    return MetaCloudApiProvider(
        phone_number_id=settings.whatsapp_phone_number_id,
        access_token=settings.whatsapp_access_token,
        api_base_url=settings.whatsapp_api_base_url,
    )


def normalise_phone(raw: str | None, default_country_code: str = "91") -> str | None:
    """Returns the number in the digits-only form the Cloud API expects, or None.

    Meta wants a country code and no punctuation. Indian institutes record
    numbers every which way -- "+91 90000 00001", "090000-00001", "9000000001" --
    so normalise rather than reject, and treat anything still implausible as
    undeliverable instead of sending it into the void.
    """
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return None
    if digits.startswith("00"):
        digits = digits[2:]
    # A bare 10-digit Indian mobile, or one written with a trunk 0.
    if len(digits) == 10:
        digits = default_country_code + digits
    elif len(digits) == 11 and digits.startswith("0"):
        digits = default_country_code + digits[1:]
    if not 10 <= len(digits) <= 15:  # E.164 allows at most 15 digits
        return None
    return digits


def render_template(body: str, context: dict) -> str:
    rendered = body
    for key, value in context.items():
        rendered = rendered.replace("{" + key + "}", str(value))
    return rendered
