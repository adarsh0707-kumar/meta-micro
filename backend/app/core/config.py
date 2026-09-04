from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "meta-micro"
    log_level: str = "INFO"
    database_url: str = "postgresql+psycopg2://meta_micro:meta_micro@localhost:5432/meta_micro"
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7

    # WhatsApp Business Cloud API (Meta). Left blank in dev -> falls back to
    # the "log" provider, which records outgoing messages instead of sending them.
    whatsapp_provider: str = "log"  # "log" | "meta_cloud_api"
    whatsapp_phone_number_id: str = ""
    whatsapp_access_token: str = ""
    whatsapp_api_base_url: str = "https://graph.facebook.com/v20.0"

    cors_origins: list[str] = ["http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
