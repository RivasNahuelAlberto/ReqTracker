"""
FastAPI Minimal Service - Solo ETAPA 2 + ETAPA 3
Para testing de integration

Run: python analytics/app_minimal.py
"""

from fastapi import FastAPI
import logging
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="ReqTracker Analytics Service - Minimal (ETAPA 2+3 Only)",
    version="2.0.0"
)

# Import ETAPA 2, ETAPA 3, ETAPA 4 routes
logger.info("Importing ETAPA 2, 3, 4 modules...")
try:
    from analytics.semantic import setup_semantic_routes
    logger.info("✓ ETAPA 2 (Semantic Intelligence) imported")
except ImportError as e:
    logger.warning(f"⚠️  Failed to import ETAPA 2: {e}")
    setup_semantic_routes = None

try:
    from analytics.graph import setup_graph_routes
    logger.info("✓ ETAPA 3 (Graph Intelligence) imported")
except ImportError as e:
    logger.warning(f"⚠️  Failed to import ETAPA 3: {e}")
    setup_graph_routes = None

try:
    from analytics.prediction import setup_prediction_routes
    logger.info("✓ ETAPA 4 (Prediction Engine) imported")
except ImportError as e:
    logger.warning(f"⚠️  Failed to import ETAPA 4: {e}")
    setup_prediction_routes = None

try:
    from analytics.advanced import setup_advanced_routes
    logger.info("✓ ETAPA 5 (Advanced Features) imported")
except ImportError as e:
    logger.warning(f"⚠️  Failed to import ETAPA 5: {e}")
    setup_advanced_routes = None

try:
    from analytics.monitoring import setup_monitoring_routes
    logger.info("✓ ETAPA 6 (Real-time Monitoring) imported")
except ImportError as e:
    logger.warning(f"⚠️  Failed to import ETAPA 6: {e}")
    setup_monitoring_routes = None

# Health check endpoint
@app.get("/health")
async def health_check():
    """Basic health check"""
    return {
        "status": "healthy",
        "service": "ReqTracker Analytics (Minimal)",
        "version": "2.0.0"
    }

@app.get("/health/deep")
async def deep_health_check():
    """Deep health check for backwards compatibility"""
    return {
        "status": "healthy",
        "service": "ReqTracker Analytics (Minimal)",
        "version": "2.0.0",
        "modules": {
            "semantic": "ready" if setup_semantic_routes else "unavailable",
            "graph": "ready" if setup_graph_routes else "unavailable"
        }
    }

# Register ETAPA 2: Semantic Intelligence routes
logger.info("\nRegistering ETAPA 2 routes...")
if setup_semantic_routes:
    try:
        setup_semantic_routes(app)
        logger.info("✓ ETAPA 2 (Semantic Intelligence) routes registered")
    except Exception as e:
        logger.error(f"✗ Failed to register ETAPA 2 routes: {e}")
else:
    logger.warning("⚠️  ETAPA 2 (Semantic Intelligence) module not available")

# Register ETAPA 3: Graph Intelligence routes
logger.info("Registering ETAPA 3 routes...")
if setup_graph_routes:
    try:
        setup_graph_routes(app)
        logger.info("✓ ETAPA 3 (Graph Intelligence) routes registered")
    except Exception as e:
        logger.error(f"✗ Failed to register ETAPA 3 routes: {e}")
else:
    logger.warning("⚠️  ETAPA 3 (Graph Intelligence) module not available")

# Register ETAPA 4: Prediction Engine routes
logger.info("Registering ETAPA 4 routes...")
if setup_prediction_routes:
    try:
        setup_prediction_routes(app)
        logger.info("✓ ETAPA 4 (Prediction Engine) routes registered")
    except Exception as e:
        logger.error(f"✗ Failed to register ETAPA 4 routes: {e}")
else:
    logger.warning("⚠️  ETAPA 4 (Prediction Engine) module not available")

# Register ETAPA 5: Advanced Features routes
logger.info("Registering ETAPA 5 routes...")
if setup_advanced_routes:
    try:
        setup_advanced_routes(app)
        logger.info("✓ ETAPA 5 (Advanced Features) routes registered")
    except Exception as e:
        logger.error(f"✗ Failed to register ETAPA 5 routes: {e}")
else:
    logger.warning("⚠️  ETAPA 5 (Advanced Features) module not available")

# Register ETAPA 6: Real-time Monitoring routes
logger.info("Registering ETAPA 6 routes...")
if setup_monitoring_routes:
    try:
        setup_monitoring_routes(app)
        logger.info("✓ ETAPA 6 (Real-time Monitoring) routes registered")
    except Exception as e:
        logger.error(f"✗ Failed to register ETAPA 6 routes: {e}")
else:
    logger.warning("⚠️  ETAPA 6 (Real-time Monitoring) module not available")

logger.info("\n" + "="*70)
logger.info("Analytics Service Ready!")
logger.info("Available endpoints:")
logger.info("  GET  /health")
logger.info("  GET  /health/deep")
if setup_semantic_routes:
    logger.info("  POST /semantic/health")
    logger.info("  POST /semantic/ambiguity")
    logger.info("  POST /semantic/drift")
    logger.info("  POST /semantic/topics")
    logger.info("  POST /semantic/batch/health")
    logger.info("  GET  /semantic/health-check")
if setup_graph_routes:
    logger.info("  POST /graph/centrality")
    logger.info("  POST /graph/communities")
    logger.info("  POST /graph/impact")
    logger.info("  POST /graph/cycles")
    logger.info("  POST /graph/metrics")
    logger.info("  GET  /graph/health-check")
if setup_prediction_routes:
    logger.info("  POST /prediction/risk")
    logger.info("  POST /prediction/missing")
    logger.info("  POST /prediction/inconsistencies")
    logger.info("  POST /prediction/comprehensive")
    logger.info("  GET  /prediction/health-check")
if setup_advanced_routes:
    logger.info("  POST /advanced/clustering/analyze")
    logger.info("  POST /advanced/clustering/suggestions")
    logger.info("  GET  /advanced/clustering/health-check")
    logger.info("  POST /advanced/forecasting/project")
    logger.info("  POST /advanced/forecasting/growth")
    logger.info("  POST /advanced/forecasting/anomalies")
    logger.info("  GET  /advanced/forecasting/health-check")
    logger.info("  POST /advanced/explainability/risk")
    logger.info("  POST /advanced/explainability/missing")
    logger.info("  POST /advanced/explainability/inconsistency")
    logger.info("  POST /advanced/explainability/comprehensive")
    logger.info("  GET  /advanced/explainability/health-check")
if setup_monitoring_routes:
    logger.info("  POST /advanced/monitoring/{project_id}/metrics/record")
    logger.info("  GET  /advanced/monitoring/{project_id}/metrics/{metric_type}")
    logger.info("  POST /advanced/monitoring/{project_id}/thresholds")
    logger.info("  GET  /advanced/monitoring/{project_id}/thresholds")
    logger.info("  POST /advanced/monitoring/{project_id}/snapshots")
    logger.info("  GET  /advanced/monitoring/{project_id}/snapshots/latest")
    logger.info("  GET  /advanced/monitoring/{project_id}/snapshots/history")
    logger.info("  POST /advanced/monitoring/{project_id}/alerts/check")
    logger.info("  GET  /advanced/monitoring/{project_id}/alerts/active")
    logger.info("  GET  /advanced/monitoring/{project_id}/alerts/history")
    logger.info("  POST /advanced/monitoring/{project_id}/webhooks")
    logger.info("  DELETE /advanced/monitoring/{project_id}/webhooks")
    logger.info("  GET  /advanced/monitoring/{project_id}/report")
    logger.info("  GET  /advanced/monitoring/{project_id}/dashboard")
    logger.info("  GET  /advanced/monitoring/health-check")
logger.info("="*70 + "\n")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    logger.info(f"Starting server on 0.0.0.0:{port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
