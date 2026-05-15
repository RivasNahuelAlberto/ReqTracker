"""
Simple runner for batch processing tasks.
"""
import argparse
import logging
from analytics.pipelines.batch_processing import recompute_snapshots, prune_old_snapshots

logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--recompute", action="store_true", help="Recompute snapshots for all projects")
    parser.add_argument("--prune", nargs=2, metavar=("PROJECT_ID", "KEEP"), help="Prune old snapshots for a project")
    args = parser.parse_args()

    if args.recompute:
        recompute_snapshots()
    if args.prune:
        project_id, keep = args.prune
        prune_old_snapshots(project_id, keep=int(keep))

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
