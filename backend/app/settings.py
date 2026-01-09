from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "dev"
    log_level: str = "info"
    cors_origins: str = "http://localhost:5173"
    database_url: str = "postgresql+psycopg://user:pass@db:5432/coursetimers"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


def get_settings() -> Settings:
    return Settings()
