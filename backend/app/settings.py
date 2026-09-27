import ipaddress
from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url


def normalize_database_url(value: str) -> str:
    # Change only the scheme: preserve escaped credentials and query parameters.
    if value.startswith("postgres://"):
        return "postgresql+psycopg://" + value[len("postgres://"):]
    if value.startswith("postgresql://"):
        return "postgresql+psycopg://" + value[len("postgresql://"):]
    return value


class Settings(BaseSettings):
    app_env: Literal["dev", "prod"] = "dev"
    log_level: Literal["critical", "error", "warning", "info", "debug", "trace"] = "info"
    cors_origins: str = "http://localhost:5173"
    database_url: str = "postgresql+psycopg://coursetimers:coursetimers@db:5432/coursetimers"
    session_secret: str = "local-development-session-secret"
    session_max_age_seconds: int = Field(default=604800, ge=60, le=2592000)
    
    db_pool_size: int = Field(default=2, ge=1, le=10)
    db_max_overflow: int = Field(default=3, ge=0, le=10)
    db_pool_timeout: int = Field(default=15, ge=1, le=60)
    db_connect_timeout: int = Field(default=10, ge=1, le=60)
    
    # Production validation
    def validate_production(self) -> None:
        if self.app_env != "prod":
            return
        if "session_secret" not in self.model_fields_set or len(self.session_secret) < 32:
            raise ValueError("Production requires SESSION_SECRET with at least 32 characters")
        if "database_url" not in self.model_fields_set:
            raise ValueError("Production requires explicit DATABASE_URL")
        try:
            url = make_url(normalize_database_url(self.database_url))
            host = url.host or ""
            try:
                local = not ipaddress.ip_address(host).is_global
            except ValueError:
                local = "." not in host or host.endswith((".localhost", ".local"))
            valid = (url.drivername == "postgresql+psycopg" and host and not local
                     and url.database and url.username and url.password
                     and url.query.get("sslmode") in {"require", "verify-ca", "verify-full"})
        except Exception:
            valid = False
        if not valid:
            raise ValueError("Production requires a remote PostgreSQL URL with credentials and TLS")
        origins = self.cors_origins.split(",")
        for origin in origins:
            parsed = urlsplit(origin.strip())
            if (parsed.scheme != "https" or not parsed.hostname or "*" in origin
                    or parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment
                    or parsed.hostname in {"localhost", "127.0.0.1", "::1"}):
                raise ValueError("Production requires exact HTTPS CORS origins")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


def get_settings() -> Settings:
    settings = Settings()
    settings.validate_production()
    return settings
