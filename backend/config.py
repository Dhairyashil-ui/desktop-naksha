"""
Naksha 2.0 — Configuration
Reads from .env file (via python-dotenv/pydantic-settings).
Never hardcode credentials here — use .env or environment variables.
"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings

# Look for .env in current directory or project root
_project_root = Path(__file__).resolve().parent.parent
_env_file = _project_root / ".env"

class Settings(BaseSettings):
    APP_NAME: str = "Naksha 2.0 Ingestion & Processing Core"
    PORT: int = 8000
    HOST: str = "127.0.0.1"
    APP_ENV: str = "development"

    # PostgreSQL + PostGIS (Read from .env)
    DATABASE_URL: str = ""

    # Redis Broker & Result Backend for Celery
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379

    # MinIO / S3 Object Storage (Read from .env)
    STORAGE_ENDPOINT: str = "http://localhost:9000"
    STORAGE_ACCESS_KEY: str = ""
    STORAGE_SECRET_KEY: str = ""
    STORAGE_BUCKET: str = "naksha-data"
    STORAGE_USE_SSL: bool = False

    # App Secrets
    APP_SECRET_KEY: str = "naksha-dev-secret-change-in-prod"

    # Local storage fallback (when MinIO unavailable)
    LOCAL_STORAGE_PATH: str = "./storage_cache"

    class Config:
        env_file = str(_env_file) if _env_file.exists() else ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()

# Ensure local storage directory exists
Path(settings.LOCAL_STORAGE_PATH).mkdir(parents=True, exist_ok=True)
