"""
Unit tests for MongoDB persistence in analytics/db/client.py
These tests mock get_db to avoid requiring a real MongoDB instance.
"""
import unittest
from unittest.mock import patch, MagicMock
import analytics.db.client as client


class FakeCollection:
    def __init__(self):
        self.create_index_calls = []
        self.inserted = []

    def create_index(self, spec):
        self.create_index_calls.append(spec)

    def insert_one(self, doc):
        self.inserted.append(doc)
        return MagicMock(inserted_id="fakeid")


class FakeDB:
    def __init__(self):
        self.collections = {"analytics_snapshots": FakeCollection()}

    def get_collection(self, name):
        return self.collections.get(name, FakeCollection())


class TestPersistence(unittest.TestCase):
    def test_ensure_indexes_and_save_snapshot(self):
        fake_db = FakeDB()

        with patch("analytics.db.client.get_db", return_value=fake_db):
            # Force indexes not yet ensured and pretend pymongo is present
            client._indexes_ensured = False
            client._HAS_PYMONGO = True
            client.ensure_indexes(fake_db)
            coll = fake_db.get_collection("analytics_snapshots")
            # Ensure create_index was called at least once
            self.assertTrue(len(coll.create_index_calls) >= 1)

            # Test save_snapshot uses get_db and inserts
            sample = {"project_id": "p1", "timestamp": "2026-05-15T00:00:00"}
            ok = client.save_snapshot(sample)
            self.assertTrue(ok)
            self.assertEqual(len(coll.inserted), 1)
            self.assertEqual(coll.inserted[0]["project_id"], "p1")


if __name__ == '__main__':
    unittest.main()
