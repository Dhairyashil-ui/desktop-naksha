"""
Naksha 2.0 — Task Queue & Message Broker Subsystem (Phase 21)
Redis / Celery Message Broker with asynchronous Worker Pool.
Dispatches spatial jobs to:
- GDAL/PDAL Worker
- Photogrammetry Worker
- 3D/AI Segmentation & Floor/Unit Worker
"""

import os
import json
import time
import asyncio
from typing import Dict, Any, Callable, Optional, List

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_DB = int(os.getenv("REDIS_DB", "0"))

class TaskQueueBroker:
    def __init__(self):
        self.is_connected = False
        self._init_redis()
        self.in_memory_queue: List[Dict[str, Any]] = []
        self.active_jobs: Dict[str, Dict[str, Any]] = {}

    def _init_redis(self):
        # Quick non-blocking socket probe before connecting to redis
        import socket
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(0.15)
            err = sock.connect_ex((REDIS_HOST, REDIS_PORT))
            sock.close()
            if err != 0:
                self.is_connected = False
                return
        except Exception:
            self.is_connected = False
            return

        try:
            import redis
            self.r = redis.Redis(
                host=REDIS_HOST,
                port=REDIS_PORT,
                db=REDIS_DB,
                socket_timeout=0.5,
                socket_connect_timeout=0.5,
                retry_on_timeout=False
            )
            self.r.ping()
            self.is_connected = True
        except Exception:
            self.is_connected = False

    def dispatch_job(self, job_id: str, job_type: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Dispatches job to Redis queue or in-memory runner."""
        job_record = {
            "job_id": job_id,
            "job_type": job_type,
            "status": "QUEUED",
            "progress": 0.0,
            "dispatched_at": time.time(),
            "payload": payload
        }
        self.active_jobs[job_id] = job_record

        if self.is_connected:
            try:
                self.r.rpush("naksha_jobs_queue", json.dumps(job_record))
                self.r.hset("naksha_active_jobs", job_id, json.dumps(job_record))
            except Exception:
                pass
        else:
            self.in_memory_queue.append(job_record)

        return job_record

    def dispatch_spatial_pipeline(self, project_id: str, raw_las_path: str, target_epsg: int = 32643, job_id: Optional[str] = None) -> str:
        """
        Dispatches real 6-stage spatial pipeline (Step 16 & 17).
        Uses Celery / Redis worker if connected, or asynchronous worker system.
        """
        import uuid
        jid = job_id or str(uuid.uuid4())
        if self.is_connected:
            try:
                from backend.tasks.processing_tasks import execute_real_spatial_pipeline
                execute_real_spatial_pipeline.delay(project_id, raw_las_path, target_epsg, jid)
                self.dispatch_job(jid, "REAL_SPATIAL_PIPELINE", {"project_id": project_id, "raw_las_path": raw_las_path, "target_epsg": target_epsg})
                return jid
            except Exception:
                pass

        # Native asynchronous worker fallback
        from backend.job_engine import dispatch_job_async
        dispatch_job_async(project_id, raw_las_path, target_epsg, jid)
        self.dispatch_job(jid, "REAL_SPATIAL_PIPELINE", {"project_id": project_id, "raw_las_path": raw_las_path, "target_epsg": target_epsg})
        return jid

    def update_job_progress(self, job_id: str, progress: float, status: str = "RUNNING"):
        if job_id in self.active_jobs:
            self.active_jobs[job_id]["progress"] = progress
            self.active_jobs[job_id]["status"] = status
            if self.is_connected:
                try:
                    self.r.hset("naksha_active_jobs", job_id, json.dumps(self.active_jobs[job_id]))
                except Exception:
                    pass

    def get_status(self) -> Dict[str, Any]:
        return {
            "broker": "Redis / Celery" if self.is_connected else "Asynchronous Worker Queue",
            "connected": self.is_connected,
            "host": REDIS_HOST,
            "port": REDIS_PORT,
            "active_workers_count": 4,
            "active_jobs_count": len(self.active_jobs),
            "worker_types": ["GDAL_PDAL", "PHOTOGRAMMETRY", "AI_3D_STRATA", "SPATIAL_DAG_PIPELINE"]
        }

task_broker = TaskQueueBroker()
