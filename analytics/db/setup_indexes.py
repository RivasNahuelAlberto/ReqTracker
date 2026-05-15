"""
Utility to ensure MongoDB indexes for analytics collections.
"""
from analytics.db.client import ensure_indexes, get_db
import logging

logger = logging.getLogger(__name__)


def main():
    # Prefer explicit DB from env or default
    try:
        ensure_indexes()
        logger.info("Index setup completed")
    except Exception as e:
        logger.error(f"Index setup failed: {e}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
