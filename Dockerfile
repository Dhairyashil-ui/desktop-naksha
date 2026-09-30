# ── Naksha 2.0 Backend Dockerfile for Render Cloud & Container Deployments ──
FROM python:3.12-slim-bookworm

# System dependencies for geospatial, GDAL, and headless 3D processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    gdal-bin \
    libgdal-dev \
    libgl1 \
    libegl1 \
    libglvnd0 \
    libglib2.0-0 \
    libgomp1 \
    libx11-6 \
    libspatialindex-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Upgrade pip and install wheel
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# Install Python backend dependencies
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy application source
COPY backend /app/backend
COPY datasets /app/datasets
COPY project_engine.py /app/project_engine.py
COPY schema.sql /app/schema.sql

# Environment configuration
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app:/app/backend \
    PORT=10000

# Health check matching FastAPI endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

EXPOSE 10000

# Start Uvicorn ASGI server with dynamic port assignment from Render
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-10000} --workers 1"]
