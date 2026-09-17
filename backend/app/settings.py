from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "dev"
    log_level: str = "info"
    cors_origins: str = "http://localhost:5173"
    database_url: str = "postgresql+psycopg://coursetimers:coursetimers@db:5432/coursetimers"
    
    # Personal access protection
    owner_username: str | None = None
    access_key: str | None = None
    
    # Production validation
    def validate_production(self) -> None:
        if self.app_env == "prod":
            if not self.owner_username or not self.access_key:
                raise ValueError(
                    "Production mode requires OWNER_USERNAME and ACCESS_KEY to be set"
                )
            if len(self.access_key) < 20:
                raise ValueError(
                    "ACCESS_KEY must be at least 20 characters for production"
                )

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


def get_settings() -> Settings:
    settings = Settings()
    settings.validate_production()
    return settings
