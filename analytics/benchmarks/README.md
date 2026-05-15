Analytics Benchmarks

benchmark_ingest.py
- Usage: `python analytics/benchmarks/benchmark_ingest.py --projects 100 --snapshots 100`
- Measures in-process snapshot creation throughput (snapshots/sec).

Notes:
- Ensure Python dependencies are installed. The core benchmark runs without Redis/MongoDB.
- For production-like benchmarks, run with a running Redis and MongoDB and set `MONGO_URI` and `REDIS_URL` env vars.
