import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "Naksha 2.0 Ingestion & Processing Core"
    PORT: int = 8000
    HOST: str = "127.0.0.1"

    # PostgreSQL + PostGIS (Phase 2)
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://naksha_user:naksha_pass@localhost:5432/naksha_db"
    )

    # Redis Broker & Result Backend for Celery
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # MinIO / S3 Object Storage (Phase 2)
    S3_ENDPOINT: str = os.getenv("S3_ENDPOINT", "localhost:9000")
    S3_ACCESS_KEY: str = os.getenv("S3_ACCESS_KEY", "minioadmin")
    S3_SECRET_KEY: str = os.getenv("S3_SECRET_KEY", "minioadmin")
    S3_SECURE: bool = os.getenv("S3_SECURE", "false").lower() == "true"

    class Config:
        env_file = ".env"

settings = Settings()
