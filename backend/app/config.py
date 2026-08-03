from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """API settings loaded from environment / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    database_url: str
    # Signing key for access tokens. Generate with: openssl rand -base64 48
    jwt_secret: str
    jwt_algorithm: str = "HS256"

    # The app has no "remember me" checkbox — every login is remembered. So the
    # access token stays short (a leaked one expires quickly) and the refresh
    # token carries the session for months, silently renewed by the client.
    access_token_ttl_minutes: int = 30
    refresh_token_ttl_days: int = 90

    # Expo serves the app from a dev host that changes with the network, and the
    # native client sends no Origin at all, so dev is wide open. Narrow this to
    # the real origins before anything ships.
    cors_origins: list[str] = ["*"]


settings = Settings()
