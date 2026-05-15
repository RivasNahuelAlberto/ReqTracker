"""
ETAPA 6: Monitoring Intelligence Module
========================================

Real-time monitoring, alerting, and reporting for analytics metrics.

Public API exports:
- MonitoringEngine: Core monitoring engine
- Alert/AlertThreshold/AnalyticsSnapshot: Data models
- AlertSeverity/AlertType/MetricType: Enums
- router: FastAPI routes
"""

from .monitoring_engine import (
    # Engine
    MonitoringEngine,
    get_engine,
    reset_engine,
    
    # Data Models
    MetricValue,
    AlertThreshold,
    Alert,
    AnalyticsSnapshot,
    MonitoringReport,
    
    # Enums
    AlertSeverity,
    AlertType,
    MetricType,
    
    # Webhook
    WebhookHandler,
    SimpleWebhookHandler,
)

from .routes import (
    router,
)

__version__ = "6.0"
__all__ = [
    # Engine
    "MonitoringEngine",
    "get_engine",
    "reset_engine",
    
    # Data Models
    "MetricValue",
    "AlertThreshold",
    "Alert",
    "AnalyticsSnapshot",
    "MonitoringReport",
    
    # Enums
    "AlertSeverity",
    "AlertType",
    "MetricType",
    
    # Webhook
    "WebhookHandler",
    "SimpleWebhookHandler",
    
    # Routes
    "router",
]


def setup_monitoring_routes(app):
    """
    Setup monitoring routes in FastAPI app
    
    Usage:
        from analytics.monitoring import setup_monitoring_routes
        setup_monitoring_routes(app)
    """
    app.include_router(router)
    return app
