"""
Batch processing utilities for analytics: recompute snapshots and prune history.
"""
import logging
from typing import List, Optional
from analytics.monitoring.monitoring_engine import get_engine, AnalyticsSnapshot
from datetime import datetime

logger = logging.getLogger(__name__)


def recompute_snapshots(project_ids: Optional[List[str]] = None):
    """Recompute snapshots for given projects (or all known projects).

    This is an idempotent, best-effort recomputation that re-persists and refreshes cache
    for the latest snapshot of each project. In future iterations it will run real
    computations over raw data sources.
    """
    engine = get_engine()
    target_projects = project_ids or list(engine.snapshots.keys())
    logger.info(f"Recomputing snapshots for {len(target_projects)} projects")

    for pid in target_projects:
        latest = engine.get_latest_snapshot(pid)
        if latest is None:
            logger.debug(f"No snapshot for project {pid}, skipping")
            continue
        # Re-save/persist the snapshot to ensure DB/cache consistency
        try:
            # call engine.create_snapshot with same values to trigger persistence/cache
            engine.create_snapshot(
                project_id=latest.project_id,
                semantic_health=latest.semantic_health,
                graph_metrics=latest.graph_metrics,
                risk_score=latest.risk_score,
                consistency_score=latest.consistency_score,
                predictions=latest.predictions,
                api_latencies=latest.api_latencies
            )
            logger.info(f"Recomputed snapshot for {pid}")
        except Exception as e:
            logger.warning(f"Failed to recompute snapshot for {pid}: {e}")


def prune_old_snapshots(project_id: str, keep: int = 100):
    """Prune old snapshots for a project, keeping only the most recent `keep` items."""
    engine = get_engine()
    if project_id not in engine.snapshots:
        return
    if len(engine.snapshots[project_id]) <= keep:
        return
    engine.snapshots[project_id] = engine.snapshots[project_id][-keep:]
    logger.info(f"Pruned snapshots for {project_id} to {keep} items")
