"""
Optional Celery app factory. If Celery isn't installed, exposing None.
"""
import os
import logging
logger = logging.getLogger(__name__)

try:
    from celery import Celery
    _HAS_CELERY = True
except Exception:
    Celery = None
    _HAS_CELERY = False

_celery_app = None


def get_celery_app():
    global _celery_app
    if not _HAS_CELERY:
        logger.info("Celery not installed; background workers disabled")
        return None

    if _celery_app is None:
        broker = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
        backend = os.environ.get('CELERY_RESULT_BACKEND', broker)
        _celery_app = Celery('analytics_workers', broker=broker, backend=backend)
        # minimal config
        _celery_app.conf.task_serializer = 'json'
        _celery_app.conf.result_serializer = 'json'
        _celery_app.conf.accept_content = ['json']
        logger.info(f"Celery app configured with broker={broker}")
    return _celery_app
