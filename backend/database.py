"""
Naksha 2.0 — Database Layer (Phase 21)
PostgreSQL 17+ with PostGIS 3.3+ Connection Manager.
All connection parameters and credentials are read strictly from environment configuration (.env).
Never hardcode credentials or secrets in source code.
"""

import os
import time
import socket
from typing import Generator, Dict, Any, Optional
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session

# Load .env file from project root or current working directory
_project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_env_file = os.path.join(_project_root, ".env")
if os.path.exists(_env_file):
    load_dotenv(dotenv_path=_env_file)
else:
    load_dotenv()

DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "postgres")

# Optional Pooler Configuration
POOLER_HOST = os.getenv("DB_POOLER_HOST", "")
POOLER_USER = os.getenv("DB_POOLER_USER", "")
POOLER_PORT = int(os.getenv("DB_POOLER_PORT", "5432"))

def get_database_url() -> str:
    """
    Determines optimal connection URL from environment variables.
    Prioritizes explicit DATABASE_URL if provided in .env.
    Otherwise builds from DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME.
    """
    env_url = os.getenv("DATABASE_URL")
    if env_url:
        return env_url

    # Check if direct host resolves to IPv4 or reachable IPv6
    if POOLER_HOST and POOLER_USER:
        try:
            addrinfo = socket.getaddrinfo(DB_HOST, DB_PORT, socket.AF_UNSPEC, socket.SOCK_STREAM)
            has_ipv4 = any(a[0] == socket.AF_INET for a in addrinfo)
            if has_ipv4:
                return f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
        except Exception:
            pass
        return f"postgresql://{POOLER_USER}:{DB_PASSWORD}@{POOLER_HOST}:{POOLER_PORT}/{DB_NAME}"

    return f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

DATABASE_URL = get_database_url()

# SQLAlchemy Setup with resilient connection pooling
engine = create_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=300,
    connect_args={
        "connect_timeout": 10,
        "application_name": "Naksha2_FastAPI_Core"
    }
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db() -> Generator[Session, None, None]:
    """FastAPI Dependency for database session management."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def check_database_health() -> Dict[str, Any]:
    """Healthcheck probing live PostgreSQL + PostGIS capabilities and latency."""
    t0 = time.time()
    try:
        with engine.connect() as conn:
            # Query PostgreSQL version
            res_ver = conn.execute(text("SELECT version();")).scalar()
            # Query PostGIS version
            res_gis = conn.execute(text("SELECT PostGIS_Full_Version();")).scalar()
            latency_ms = round((time.time() - t0) * 1000, 2)

            # Query table counts in public schema
            tables_res = conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                ORDER BY table_name;
            """)).fetchall()
            tables = [r[0] for r in tables_res]

            return {
                "status": "ONLINE",
                "connected": True,
                "latency_ms": latency_ms,
                "db_engine": "PostgreSQL 17+ (Supabase)",
                "postgis_version": res_gis.split()[0] if res_gis else "Available",
                "version_string": res_ver,
                "host_active": engine.url.host,
                "port_active": engine.url.port,
                "database": engine.url.database,
                "tables_count": len(tables),
                "tables": tables
            }
    except Exception as e:
        latency_ms = round((time.time() - t0) * 1000, 2)
        return {
            "status": "OFFLINE",
            "connected": False,
            "latency_ms": latency_ms,
            "error": str(e),
            "host_attempted": engine.url.host,
            "port_attempted": engine.url.port
        }
