"""
Redis-backed cache for analytics with in-memory fallback.
"""
import os
import json
import logging
from time import time
logger = logging.getLogger(__name__)

try:
    import redis
    _HAS_REDIS = True
except Exception:
    redis = None
    _HAS_REDIS = False

# Simple in-memory fallback cache: key -> (expiry_ts, value_json)
_in_memory_cache = {}


def _now_ts():
    # Use floating point seconds for higher precision to avoid off-by-one second TTL expiry
    return time()


def _make_key(project_id: str):
    return f"snapshot:{project_id}"


def set_cached_snapshot(project_id: str, snapshot: dict, ttl: int = 1800) -> bool:
    """Set cached snapshot; try Redis first, fallback to in-memory."""
    key = _make_key(project_id)
    val = json.dumps(snapshot)
    if _HAS_REDIS:
        try:
            url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
            # Use short timeouts to fail fast in CI/environments without Redis
            client = redis.from_url(url, socket_connect_timeout=0.1, socket_timeout=0.1)
            client.setex(key, ttl, val)
            return True
        except Exception as e:
            logger.warning(f"Redis set failed: {e}")
    # fallback
    _in_memory_cache[key] = (_now_ts() + ttl, val)
    return True


def get_cached_snapshot(project_id: str):
    """Return parsed snapshot dict or None if missing/expired."""
    key = _make_key(project_id)
    if _HAS_REDIS:
        try:
            url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
            client = redis.from_url(url, socket_connect_timeout=0.1, socket_timeout=0.1)
            raw = client.get(key)
            if raw is not None:
                try:
                    return json.loads(raw)
                except Exception:
                    return None
            # if raw is None, fallthrough to in-memory fallback
        except Exception as e:
            logger.warning(f"Redis get failed: {e}")
    # fallback
    data = _in_memory_cache.get(key)
    if not data:
        return None
    expiry, val = data
    if _now_ts() > expiry:
        del _in_memory_cache[key]
        return None
    try:
        return json.loads(val)
    except Exception:
        return None


def get_threshold_cache_key(project_id: str, metric_type: str):
    return f"threshold:{project_id}:{metric_type}"


def set_cached_threshold(project_id: str, metric_type: str, threshold: dict, ttl: int = 1800) -> bool:
    key = get_threshold_cache_key(project_id, metric_type)
    val = json.dumps(threshold)
    if _HAS_REDIS:
        try:
            url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
            client = redis.from_url(url, socket_connect_timeout=0.1, socket_timeout=0.1)
            client.setex(key, ttl, val)
            return True
        except Exception as e:
            logger.warning(f"Redis set failed: {e}")
    _in_memory_cache[key] = (_now_ts() + ttl, val)
    return True


def get_cached_threshold(project_id: str, metric_type: str):
    key = get_threshold_cache_key(project_id, metric_type)
    if _HAS_REDIS:
        try:
            url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
            client = redis.from_url(url, socket_connect_timeout=0.1, socket_timeout=0.1)
            raw = client.get(key)
            if raw is not None:
                try:
                    return json.loads(raw)
                except Exception:
                    return None
            # fallthrough to in-memory fallback if raw is None
        except Exception as e:
            logger.warning(f"Redis get failed: {e}")
    data = _in_memory_cache.get(key)
    if not data:
        return None
    expiry, val = data
    if _now_ts() > expiry:
        del _in_memory_cache[key]
        return None
    try:
        return json.loads(val)
    except Exception:
        return None
