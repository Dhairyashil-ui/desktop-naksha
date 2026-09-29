"""
Asynchronous Directed Acyclic Graph (DAG) Execution Engine.
Orchestrates parallel branches, dependency gates, and live progress events.
"""

import time
import asyncio
from typing import AsyncGenerator, Dict, Any, List
from .models import JobGraph, JobNode, NodeStatus

class JobGraphExecutor:
    def __init__(self, graph: JobGraph, step_delay: float = 0.4):
        self.graph = graph
        self.step_delay = step_delay

    async def run(self) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Executes the graph by continuously resolving ready nodes in topological order.
        Yields execution events as nodes start, progress, and complete.
        """
        self.graph.status = NodeStatus.RUNNING
        self.graph.started_at = time.time()

        yield {
            "type": "GRAPH_STARTED",
            "job_id": self.graph.job_id,
            "title": self.graph.title,
            "total_nodes": len(self.graph.nodes),
            "timestamp": time.time()
        }

        while not self.graph.is_complete():
            runnable = self.graph.get_runnable_nodes()

            if not runnable and not self.graph.has_active_nodes():
                # Deadlock or unresolvable failure
                break

            # Dispatch runnable nodes concurrently
            tasks = []
            for node in runnable:
                node.mark_running()
                yield {
                    "type": "NODE_STARTED",
                    "job_id": self.graph.job_id,
                    "node_id": node.id,
                    "node_name": node.name,
                    "category": node.category,
                    "level": node.level,
                    "progress": node.progress,
                    "timestamp": time.time()
                }
                tasks.append(self._simulate_node_execution(node))

            if tasks:
                # Wait for at least one node to finish or progress
                for coro in asyncio.as_completed(tasks):
                    events = await coro
                    for ev in events:
                        self.graph.compute_overall_progress()
                        ev["overall_progress"] = self.graph.overall_progress
                        yield ev
            else:
                await asyncio.sleep(0.05)

        self.graph.completed_at = time.time()
        self.graph.status = NodeStatus.SUCCESS if self.graph.is_success() else NodeStatus.FAILED

        yield {
            "type": "GRAPH_COMPLETED",
            "job_id": self.graph.job_id,
            "status": self.graph.status.value,
            "overall_progress": 100.0 if self.graph.status == NodeStatus.SUCCESS else self.graph.overall_progress,
            "duration_sec": round(self.graph.completed_at - self.graph.started_at, 2),
            "timestamp": time.time()
        }

    async def _simulate_node_execution(self, node: JobNode) -> List[Dict[str, Any]]:
        """Simulates worker node computation while emitting sub-progress events."""
        events = []
        # Progress from 10% to 90%
        for pct in [30.0, 70.0]:
            await asyncio.sleep(self.step_delay)
            node.update_progress(pct, f"Processing {node.name} ({pct:.0f}%)")
            events.append({
                "type": "NODE_PROGRESS",
                "job_id": self.graph.job_id,
                "node_id": node.id,
                "node_name": node.name,
                "category": node.category,
                "progress": node.progress,
                "timestamp": time.time()
            })

        await asyncio.sleep(self.step_delay)
        node.mark_success()
        events.append({
            "type": "NODE_COMPLETED",
            "job_id": self.graph.job_id,
            "node_id": node.id,
            "node_name": node.name,
            "category": node.category,
            "progress": 100.0,
            "duration_sec": node.duration_sec,
            "metrics": node.metrics,
            "artifacts": node.output_artifacts,
            "timestamp": time.time()
        })
        return events


if __name__ == "__main__":
    import sys
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')

    from .pipeline_definition import create_canonical_job_001

    async def main():
        graph = create_canonical_job_001()
        executor = JobGraphExecutor(graph, step_delay=0.08)

        print("\n" + "=" * 65)
        print("          NAKSHA 2.0 DIRECTED ACYCLIC GRAPH (DAG)")
        print(f"          Pipeline: {graph.title}")
        print("=" * 65 + "\n")

        async for event in executor.run():
            ev_type = event["type"]
            if ev_type == "NODE_STARTED":
                indent = "      ├── " if event.get("level") == 2 else "  ├── "
                print(f"{indent}[STARTED]  {event['node_name']} ({event['category']})")
            elif ev_type == "NODE_COMPLETED":
                indent = "      └── " if event.get("level") == 2 else "  └── "
                dur = event.get("duration_sec", 0)
                print(f"{indent}[DONE ✓]   {event['node_name']:<28} in {dur:.2f}s (Overall: {event.get('overall_progress', 0):.1f}%)")
            elif ev_type == "GRAPH_COMPLETED":
                print("\n" + "=" * 65)
                print(f"  PIPELINE COMPLETE: {event['status']} in {event['duration_sec']}s")
                print("=" * 65 + "\n")

    asyncio.run(main())
