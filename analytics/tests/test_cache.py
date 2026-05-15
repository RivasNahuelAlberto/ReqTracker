"""
Unit tests for analytics cache wrapper (in-memory fallback)
"""
import unittest
from analytics.cache import analytics_cache as cache


class TestCache(unittest.TestCase):
    def test_set_get_snapshot_in_memory(self):
        project_id = "test_proj_cache"
        snapshot = {"project_id": project_id, "timestamp": "2026-05-15T00:00:00", "semantic_health": 0.5}
        ok = cache.set_cached_snapshot(project_id, snapshot, ttl=2)
        self.assertTrue(ok)
        got = cache.get_cached_snapshot(project_id)
        self.assertIsNotNone(got)
        self.assertEqual(got.get("project_id"), project_id)

    def test_ttl_expiry(self):
        project_id = "test_proj_ttl"
        snapshot = {"project_id": project_id, "timestamp": "2026-05-15T00:00:00", "semantic_health": 0.5}
        cache.set_cached_snapshot(project_id, snapshot, ttl=1)
        import time
        time.sleep(1.1)
        got = cache.get_cached_snapshot(project_id)
        self.assertIsNone(got)


if __name__ == '__main__':
    unittest.main()
