Background workers (Celery)

- To enable background persistence, install Celery and Redis, and set `REDIS_URL` and `MONGO_URI`.

Example (local):

```bash
pip install celery redis motor
export REDIS_URL=redis://localhost:6379/0
export MONGO_URI=mongodb://localhost:27017
# Start worker (from repo root)
celery -A analytics.workers.celery_app.get_celery_app worker --loglevel=info
```

Notes:
- The task `analytics.tasks.persist_snapshot` will persist snapshots in background using motor if available, otherwise fallback to sync save.
- If Celery is not installed, monitoring will fall back to direct save_snapshot (synchronous) as before.
