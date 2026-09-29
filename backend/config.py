"""
Naksha 2.0 — Configuration
Reads from .env file (via python-dotenv/pydantic-settings).
Never hardcode credentials here — use .env or environment variables.
"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "Naksha 2.0 Ingestion & Processing Core"
    PORT: int = 8000
    HOST: str = "127.0.0.1"
    APP_ENV: str = "development"

    # PostgreSQL + PostGIS
    # Set DATABASE_URL in .env — never hardcode credentials
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/postgres"

    # Redis Broker & Result Backend for Celery
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379

    # MinIO / S3 Object Storage
    STORAGE_ENDPOINT: str = "http://localhost:9000"
    STORAGE_ACCESS_KEY: str = "minioadmin"
    STORAGE_SECRET_KEY: str = "minioadmin"
    STORAGE_BUCKET: str = "naksha-data"
    STORAGE_USE_SSL: bool = False

    # Local storage fallback (when MinIO unavailable)
    LOCAL_STORAGE_PATH: str = "./storage_cache"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()

# Ensure local storage directory exists
Path(settings.LOCAL_STORAGE_PATH).mkdir(parents=True, exist_ok=True)
