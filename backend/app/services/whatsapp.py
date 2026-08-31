"""WhatsApp messaging provider abstraction.

meta-micro talks to WhatsApp through a small interface so the dev/test
environment never needs real WhatsApp Business API credentials. Set
WHATSAPP_PROVIDER=meta_cloud_api and the phone-number-id/access-token env
vars to send real messages through Meta's Cloud API in production.
"""

import logging
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


def get_whatsapp_provider() -> WhatsAppProvider:
    settings = get_settings()
    if settings.whatsapp_provider == "meta_cloud_api" and settings.whatsapp_access_token:
        return MetaCloudApiProvider(
            phone_number_id=settings.whatsapp_phone_number_id,
            access_token=settings.whatsapp_access_token,
            api_base_url=settings.whatsapp_api_base_url,
        )
    return LogWhatsAppProvider()


def render_template(body: str, context: dict) -> str:
    rendered = body
    for key, value in context.items():
        rendered = rendered.replace("{" + key + "}", str(value))
    return rendered
