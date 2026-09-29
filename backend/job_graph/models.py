"""
Data models and DAG representation for the Naksha 2.0 Processing Engine.
"""

import time
from typing import Dict, List, Optional, Any, Set
from enum import Enum
from pydantic import BaseModel, Field

class NodeStatus(str, Enum):
    PENDING = "PENDING"
    READY = "READY"
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"

class JobNode(BaseModel):
    id: str
    name: str
    category: str                    # e.g., "Photogrammetry", "LiDAR", "Fusion", "AI", "Cadastre"
    parent_category: Optional[str] = None
    level: int = 1                   # 1 = top-level node, 2 = sub-step
    dependencies: List[str] = Field(default_factory=list)
    status: NodeStatus = NodeStatus.PENDING
    progress: float = 0.0            # 0.0 to 100.0
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    duration_sec: Optional[float] = None
    metrics: Dict[str, Any] = Field(default_factory=dict)
    error_message: Optional[str] = None
    output_artifacts: Dict[str, str] = Field(default_factory=dict)
    logs: List[str] = Field(default_factory=list)

    def mark_running(self):
        self.status = NodeStatus.RUNNING
        self.started_at = time.time()
        self.progress = 5.0
        self.logs.append(f"[{time.strftime('%X')}] Started execution: {self.name}")

    def update_progress(self, progress: float, message: Optional[str] = None):
        self.progress = min(progress, 99.0)
        if message:
            self.logs.append(f"[{time.strftime('%X')}] {message}")

    def mark_success(self, metrics: Optional[Dict[str, Any]] = None, artifacts: Optional[Dict[str, str]] = None):
        self.status = NodeStatus.SUCCESS
        self.progress = 100.0
        self.completed_at = time.time()
        if self.started_at:
            self.duration_sec = round(self.completed_at - self.started_at, 2)
        if metrics:
            self.metrics.update(metrics)
        if artifacts:
            self.output_artifacts.update(artifacts)
        self.logs.append(f"[{time.strftime('%X')}] Node finished successfully in {self.duration_sec or 0:.2f}s")

    def mark_failed(self, error: str):
        self.status = NodeStatus.FAILED
        self.completed_at = time.time()
        self.error_message = error
        if self.started_at:
            self.duration_sec = round(self.completed_at - self.started_at, 2)
        self.logs.append(f"[{time.strftime('%X')}] Node failed: {error}")

    def mark_skipped(self, reason: str = "Upstream failure"):
        self.status = NodeStatus.SKIPPED
        self.logs.append(f"[{time.strftime('%X')}] Node skipped: {reason}")


class JobGraph(BaseModel):
    job_id: str
    title: str
    project_id: str
    nodes: Dict[str, JobNode] = Field(default_factory=dict)
    created_at: float = Field(default_factory=time.time)
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    overall_progress: float = 0.0
    status: NodeStatus = NodeStatus.PENDING

    def add_node(self, node: JobNode):
        self.nodes[node.id] = node

    def get_runnable_nodes(self) -> List[JobNode]:
        """Returns nodes whose dependencies are all SUCCESS and are currently PENDING."""
        runnable = []
        for node in self.nodes.values():
            if node.status == NodeStatus.PENDING:
                all_deps_satisfied = True
                for dep_id in node.dependencies:
                    dep_node = self.nodes.get(dep_id)
                    if not dep_node or dep_node.status != NodeStatus.SUCCESS:
                        all_deps_satisfied = False
                        break
                if all_deps_satisfied:
                    runnable.append(node)
        return runnable

    def has_active_nodes(self) -> bool:
        return any(n.status == NodeStatus.RUNNING for n in self.nodes.values())

    def is_complete(self) -> bool:
        return all(n.status in (NodeStatus.SUCCESS, NodeStatus.FAILED, NodeStatus.SKIPPED) for n in self.nodes.values())

    def is_success(self) -> bool:
        return all(n.status == NodeStatus.SUCCESS for n in self.nodes.values())

    def compute_overall_progress(self) -> float:
        if not self.nodes:
            return 0.0
        total = sum(n.progress for n in self.nodes.values())
        self.overall_progress = round(total / len(self.nodes), 1)
        return self.overall_progress
