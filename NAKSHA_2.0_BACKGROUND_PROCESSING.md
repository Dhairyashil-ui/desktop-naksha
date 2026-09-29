# Naksha 2.0 — Phase 22: Real Background Processing Architecture

## 1. Executive Summary & Design Mandate

### The Anti-Pattern (Strictly Prohibited)
```
UI
 ↓
run huge Python process (synchronous blocking call)
 ↓
UI freezes (0 FPS, beachball/spinning cursor, browser crash)
```
In heavy geospatial and cadastral pipelines (point cloud registration, bundle adjustment, mesh reconstruction, and topological polygon validation), processing tens of millions of points and thousands of high-resolution images synchronously on the UI thread or blocking the main ASGI web loop is fatal.

### The Naksha 2.0 Real Asynchronous Processing Paradigm
```
UI
 ↓
Create Job (POST /api/v2/jobs/dispatch)
 ↓
Queue (Redis / Celery task queue / PostgreSQL processing_jobs)
 ↓
Worker (Dedicated Celery/Ray/asyncio background worker daemon)
 ↓
Processing (SIFT keypoints, LiDAR ground classification, ICP fusion)
 ↓
Progress events (WebSocket /ws/jobs/{job_id} + SSE / Polling fallback)
 ↓
UI (100% unblocked, 60 FPS responsive navigation across all screens)
```

The user can **continue seeing, inspecting, and navigating the entire application** while intensive 3D and cadastral computation occurs in isolated worker processes.

---

## 2. Visual Specification: The Job Monitor Widget

The Job Monitor is docked in the lower-right viewport, decoupled from route navigation:

```
┌─────────────────────────────────────────────────────────────┐
│ ● JOB #1024                                             [-] │
├─────────────────────────────────────────────────────────────┤
│ Photogrammetry                                     100%  ✓  │
│ LiDAR                                              100%  ✓  │
│ Fusion                                              82%  ●  │
│ Building                                             0%     │
├─────────────────────────────────────────────────────────────┤
│ ASYNC PIPELINE PROGRESS                                 70% │
│ [██████████████████████████████░░░░░░░░░░]                  │
├─────────────────────────────────────────────────────────────┤
│ 🟢 UI Unblocked                              [ RUN PIPELINE ]│
└─────────────────────────────────────────────────────────────┘
```

### Stage States & Glyphs
1. **Completed Stage**: `100% ✓` (Deep emerald glyph, indicating artifact ready).
2. **Active Stage**: `82% ●` (Pulsing cobalt blue glyph with progress % and sub-task log).
3. **Pending Stage**: `0%` (Subtle muted glyph awaiting upstream dependency completion).

---

## 3. Real Backend Architecture (`backend/background_engine.py`)

### 3.1 Data Structures
```python
class StageProgress(BaseModel):
    name: str
    progress: int
    status: str  # "pending" | "running" | "completed" | "failed"
    details: Optional[str] = None

class JobProgressState(BaseModel):
    job_id: str
    title: str
    overall_progress: int
    current_stage: str
    status: str  # "QUEUED" | "RUNNING" | "SUCCESS" | "FAILED"
    stages: List[StageProgress]
    dispatched_at: float
    completed_at: Optional[float] = None
    log_messages: List[str]
```

### 3.2 Non-Blocking Dispatch & WebSocket Event Bus
When a job is dispatched:
1. `POST /api/v2/jobs/dispatch` accepts the payload and immediately writes a record to the PostgreSQL `processing_jobs` table with status `QUEUED`.
2. An asynchronous worker task is spawned via `asyncio.create_task()` (or enqueued to Celery broker).
3. The HTTP response returns status code `200 OK` in `< 15ms`, without waiting for processing to complete.
4. The worker publishes fine-grained progress updates through `asyncio.Queue` channels connected to client WebSockets at `/ws/jobs/{job_id}`.
5. Every stage step updates PostgreSQL `processing_jobs` asynchronously, guaranteeing persistent state recovery.

---

## 4. PostgreSQL Persistence Schema

All jobs are backed by the live PostGIS database:

```sql
CREATE TABLE IF NOT EXISTS processing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    pipeline_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'QUEUED',
    priority INT NOT NULL DEFAULT 10,
    progress_percentage NUMERIC(5, 2) DEFAULT 0.00,
    parameters JSONB NOT NULL DEFAULT '{}',
    error_log TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_jobs_status ON processing_jobs(status);
CREATE INDEX idx_jobs_project ON processing_jobs(project_id);
```

---

## 5. UI Integration (`src/components/JobMonitor.tsx` & `src/App.tsx`)

### 5.1 Zero-UI-Freeze Guarantee
- Computation is completely offloaded from the V8 JavaScript thread.
- The UI maintains active 60 FPS rendering, allowing the surveyor to inspect 3D property models, examine government land records, review preflight diagnostics, or trigger exports while `JOB #1024` computes.
- Dual-channel communication:
  - **Primary**: Real-time bidirectional WebSocket (`/ws/jobs/{job_id}`).
  - **Fallback**: 2.5-second polling interval (`GET /api/v2/jobs/{job_id}`) ensuring resilient operation even if WebSocket is disconnected by proxy firewalls.

### 5.2 Verification Checklist
- [x] Initial state loads `JOB #1024` with:
  - `Photogrammetry: 100% ✓`
  - `LiDAR: 100% ✓`
  - `Fusion: 82% ●`
  - `Building: 0%`
- [x] Triggering `RUN PIPELINE` runs true asynchronous worker pipeline.
- [x] Navigation across all screens (Inputs, Scanner, Pipeline, 3D Property, Record Matching, Validation, Outputs) remains completely fluid.
- [x] Background job state persists in PostgreSQL `processing_jobs`.
