"""
Benchmark: create many snapshots to measure MonitoringEngine throughput.

Usage:
    python analytics/benchmarks/benchmark_ingest.py --projects 100 --snapshots 100

This script runs in-process (no HTTP) and measures snapshots/sec.
"""
import argparse
import time
from analytics.monitoring.monitoring_engine import MonitoringEngine, get_engine


def run(projects: int, snapshots_per_project: int):
    engine = get_engine()
    start = time.time()
    total = 0
    for p in range(projects):
        pid = f"bench_proj_{p}"
        for s in range(snapshots_per_project):
            engine.create_snapshot(
                project_id=pid,
                semantic_health=0.8,
                graph_metrics={"nodes": 100, "edges": 200},
                risk_score=0.2,
                consistency_score=0.9,
                predictions={"next": "ok"},
                api_latencies={"api": 120}
            )
            total += 1
    end = time.time()
    elapsed = end - start
    print(f"Created {total} snapshots in {elapsed:.2f}s — {total/elapsed:.2f} snapshots/s")


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--projects', type=int, default=10)
    parser.add_argument('--snapshots', type=int, default=100)
    args = parser.parse_args()
    run(args.projects, args.snapshots)
