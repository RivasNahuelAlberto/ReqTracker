"""
MongoDB client wrapper for analytics (safe fallback when pymongo not available)
"""
import os
import logging
logger = logging.getLogger(__name__)

try:
    from pymongo import MongoClient, ASCENDING, DESCENDING
    from pymongo.errors import PyMongoError
    _HAS_PYMONGO = True
except Exception:
    MongoClient = None
    PyMongoError = Exception
    _HAS_PYMONGO = False
    # Fallback values so tests can simulate pymongo behavior without the package
    try:
        ASCENDING
    except NameError:
        ASCENDING = 1
    try:
        DESCENDING
    except NameError:
        DESCENDING = -1

_mongo_client = None
_indexes_ensured = False
_motor_client = None


def get_mongo_client():
    global _mongo_client
    if not _HAS_PYMONGO:
        logger.warning("pymongo not available; MongoDB persistence disabled")
        return None

    if _mongo_client is None:
        mongo_uri = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
        try:
            _mongo_client = MongoClient(mongo_uri, serverSelectionTimeoutMS=2000)
            # quick ping
            _mongo_client.admin.command('ping')
            logger.info("Connected to MongoDB")
        except Exception as e:
            logger.warning(f"Could not connect to MongoDB: {e}")
            _mongo_client = None
    return _mongo_client


def get_db(db_name: str = "analytics_db"):
    client = get_mongo_client()
    if client is None:
        return None
    return client[db_name]


# Async support for worker processes: try motor
def get_motor_client():
    global _motor_client
    try:
        import motor.motor_asyncio as _motor
    except Exception:
        return None

    if _motor_client is None:
        mongo_uri = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
        try:
            _motor_client = _motor.AsyncIOMotorClient(mongo_uri, serverSelectionTimeoutMS=2000)
        except Exception:
            _motor_client = None
    return _motor_client


async def async_save_snapshot(snapshot: dict, db_name: str = "analytics_db") -> bool:
    """Async save using motor if available; returns True on success."""
    mc = get_motor_client()
    if mc is None:
        # fallback to sync save
        return save_snapshot(snapshot, db_name)
    try:
        db = mc[db_name]
        coll = db.get_collection("analytics_snapshots")
        # Ensure indexes not available async here (best-effort)
        await coll.insert_one(snapshot)
        return True
    except Exception as e:
        logger.warning(f"Async save snapshot failed: {e}")
        return False


def ensure_indexes(db=None):
    global _indexes_ensured
    if not _HAS_PYMONGO:
        return
    if _indexes_ensured:
        return
    try:
        db = db or get_db()
        if db is None:
            return
        coll = db.get_collection("analytics_snapshots")
        coll.create_index([("project_id", ASCENDING), ("timestamp", DESCENDING)])
        coll.create_index([("project_id", ASCENDING), ("predictionType", ASCENDING)])
        _indexes_ensured = True
        logger.info("MongoDB indexes ensured for analytics_snapshots")
    except PyMongoError as e:
        logger.warning(f"Failed to ensure indexes: {e}")


def save_snapshot(snapshot: dict, db_name: str = "analytics_db") -> bool:
    """Save snapshot dict to MongoDB. Returns True on success, False otherwise."""
    if not _HAS_PYMONGO:
        return False
    try:
        db = get_db(db_name)
        if db is None:
            return False
        coll = db.get_collection("analytics_snapshots")
        # Ensure indexes on first use
        ensure_indexes(db)
        coll.insert_one(snapshot)
        return True
    except PyMongoError as e:
        logger.warning(f"Failed to save snapshot to MongoDB: {e}")
        return False
