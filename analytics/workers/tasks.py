"""
Celery tasks for analytics background processing.
If Celery isn't installed, this module will still import but tasks won't be registered.
"""
import logging
logger = logging.getLogger(__name__)

# Optional imports
try:
    from .celery_app import get_celery_app
    _HAS_CELERY = True
except Exception:
    get_celery_app = None
    _HAS_CELERY = False

try:
    # prefer async motor client for worker
    from analytics.db.client import async_save_snapshot, save_snapshot
    _HAS_ASYNC_SAVE = True
except Exception:
    async_save_snapshot = None
    save_snapshot = None
    _HAS_ASYNC_SAVE = False


_celery = None
if _HAS_CELERY:
    _celery = get_celery_app()


if _celery is not None:
    @_celery.task(name='analytics.tasks.persist_snapshot')
    def persist_snapshot(snapshot: dict):
        """Persist snapshot in background. This runs in worker process."""
        try:
            # If async_save_snapshot is available (motor), run it in event loop
            if async_save_snapshot is not None:
                import asyncio
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                res = loop.run_until_complete(async_save_snapshot(snapshot))
                loop.close()
                return res
            elif save_snapshot is not None:
                return save_snapshot(snapshot)
            else:
                logger.warning("No persistence backend available in worker")
                return False
        except Exception as e:
            logger.error(f"persist_snapshot task failed: {e}")
            return False
    @_celery.task(name='analytics.tasks.recompute_snapshots')
    def recompute_snapshots_task(project_ids: list = None):
        try:
            from analytics.pipelines.batch_processing import recompute_snapshots
            return recompute_snapshots(project_ids)
        except Exception as e:
            logger.error(f"recompute_snapshots task failed: {e}")
            return False

    @_celery.task(name='analytics.tasks.prune_old_snapshots')
    def prune_old_snapshots_task(project_id: str, keep: int = 100):
        try:
            from analytics.pipelines.batch_processing import prune_old_snapshots
            return prune_old_snapshots(project_id, keep)
        except Exception as e:
            logger.error(f"prune_old_snapshots task failed: {e}")
            return False
else:
    # Provide a local function fallback for environments without Celery
    def persist_snapshot(snapshot: dict):
        logger.info("Celery not available; persisting snapshot synchronously")
        try:
            if async_save_snapshot is not None:
                import asyncio
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                res = loop.run_until_complete(async_save_snapshot(snapshot))
                loop.close()
                return res
            elif save_snapshot is not None:
                return save_snapshot(snapshot)
            else:
                logger.warning("No persistence backend available")
                return False
        except Exception as e:
            logger.error(f"persist_snapshot fallback failed: {e}")
            return False
    def recompute_snapshots_task(project_ids: list = None):
        from analytics.pipelines.batch_processing import recompute_snapshots
        return recompute_snapshots(project_ids)

    def prune_old_snapshots_task(project_id: str, keep: int = 100):
        from analytics.pipelines.batch_processing import prune_old_snapshots
        return prune_old_snapshots(project_id, keep)
