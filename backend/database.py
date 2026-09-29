"""
Naksha 2.0 — Database Layer (Phase 21)
PostgreSQL 17+ with PostGIS 3.3+ Connection Manager
Configured for Supabase:
- Direct: postgresql://postgres:y5Q!Rz8._Gbwfv6@db.uztiolyrcmrahgvybbdv.supabase.co:5432/postgres
- IPv4 Pooler: postgresql://postgres.uztiolyrcmrahgvybbdv:y5Q!Rz8._Gbwfv6@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
"""

import os
import time
import socket
from typing import Generator, Dict, Any, Optional
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session

# Supabase Credentials provided in Phase 21
SUPABASE_USER = os.getenv("DB_USER", "postgres")
SUPABASE_PASSWORD = os.getenv("DB_PASSWORD", "y5Q!Rz8._Gbwfv6")
SUPABASE_HOST = os.getenv("DB_HOST", "db.uztiolyrcmrahgvybbdv.supabase.co")
SUPABASE_PORT = int(os.getenv("DB_PORT", "5432"))
SUPABASE_NAME = os.getenv("DB_NAME", "postgres")

# IPv4 Pooler Configuration (Supabase AWS AP-SOUTHEAST-1 Singapore)
POOLER_HOST = os.getenv("DB_POOLER_HOST", "aws-0-ap-southeast-1.pooler.supabase.com")
POOLER_USER = os.getenv("DB_POOLER_USER", "postgres.uztiolyrcmrahgvybbdv")
POOLER_PORT = int(os.getenv("DB_POOLER_PORT", "5432"))

def get_database_url() -> str:
    """
    Determines optimal connection URL.
    Attempts direct connection; if IPv6 DNS fails or is unreachable,
    falls back seamlessly to the verified IPv4 pooler.
    """
    # Check if direct host resolves to IPv4 or reachable IPv6
    try:
        addrinfo = socket.getaddrinfo(SUPABASE_HOST, SUPABASE_PORT, socket.AF_UNSPEC, socket.SOCK_STREAM)
        has_ipv4 = any(a[0] == socket.AF_INET for a in addrinfo)
        if has_ipv4:
            return f"postgresql://{SUPABASE_USER}:{SUPABASE_PASSWORD}@{SUPABASE_HOST}:{SUPABASE_PORT}/{SUPABASE_NAME}"
    except Exception:
        pass

    # Default to IPv4 session pooler (port 5432) for bulletproof connectivity
    return f"postgresql://{POOLER_USER}:{SUPABASE_PASSWORD}@{POOLER_HOST}:{POOLER_PORT}/{SUPABASE_NAME}"

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
