"""
ETAPA 6: Real-time Monitoring Engine
======================================

Propósito:
- Monitoreo de métricas en tiempo real
- Alertas basadas en thresholds
- Webhooks y notificaciones
- Histórico de eventos y alertas
- Dashboard API para visualización

Características:
- Real-time metrics collection
- Alert thresholds (configurable)
- Webhook integration
- Performance optimization (Redis caching)
- Graceful degradation
"""

from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Any, Callable
from enum import Enum
from datetime import datetime, timedelta
import json
import logging
import asyncio
from abc import ABC, abstractmethod
import warnings

logger = logging.getLogger(__name__)

# Optional persistence/cache integrations (safe imports)
try:
    from analytics.db.client import save_snapshot as _save_snapshot
except Exception:
    _save_snapshot = None

try:
    from analytics.cache.analytics_cache import set_cached_snapshot as _set_cached_snapshot
    from analytics.cache.analytics_cache import get_cached_snapshot as _get_cached_snapshot
except Exception:
    _set_cached_snapshot = None
    _get_cached_snapshot = None


# ==================== ENUMS ====================

class AlertSeverity(str, Enum):
    """Alert severity levels"""
    CRITICAL = "critical"      # >80% threshold
    HIGH = "high"              # 60-80%
    MEDIUM = "medium"          # 40-60%
    LOW = "low"                # 20-40%
    INFO = "info"              # <20%


class AlertType(str, Enum):
    """Types of alerts that can be triggered"""
    RISK_THRESHOLD = "risk_threshold"
    INCONSISTENCY_SPIKE = "inconsistency_spike"
    MISSING_REQUIREMENTS = "missing_requirements"
    CLUSTER_INSTABILITY = "cluster_instability"
    FORECAST_ANOMALY = "forecast_anomaly"
    METRIC_ANOMALY = "metric_anomaly"
    PERFORMANCE_DEGRADATION = "performance_degradation"
    DATA_QUALITY = "data_quality"


class MetricType(str, Enum):
    """Types of metrics to monitor"""
    REQUIREMENT_COUNT = "requirement_count"
    RISK_SCORE = "risk_score"
    QUALITY_SCORE = "quality_score"
    CONSISTENCY_SCORE = "consistency_score"
    COMPLETION_PERCENTAGE = "completion_percentage"
    GRAPH_DENSITY = "graph_density"
    CLUSTERING_STABILITY = "clustering_stability"
    FORECAST_ERROR = "forecast_error"
    API_LATENCY = "api_latency"
    ERROR_RATE = "error_rate"


# ==================== DATA MODELS ====================

@dataclass
class MetricValue:
    """Single metric data point"""
    type: MetricType
    value: float
    timestamp: datetime
    project_id: str
    details: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self):
        return {
            "type": self.type.value,
            "value": self.value,
            "timestamp": self.timestamp.isoformat(),
            "project_id": self.project_id,
            "details": self.details
        }


@dataclass
class AlertThreshold:
    """Configuration for alert triggers"""
    metric_type: MetricType
    upper_threshold: float
    lower_threshold: float
    severity: AlertSeverity
    enabled: bool = True
    consecutive_violations: int = 1  # Violations needed to trigger
    
    def check_violation(self, value: float) -> bool:
        """Check if value violates threshold"""
        return value > self.upper_threshold or value < self.lower_threshold


@dataclass
class Alert:
    """Alert event generated when threshold is violated"""
    alert_type: AlertType
    severity: AlertSeverity
    metric_type: MetricType
    value: float
    threshold: float
    project_id: str
    timestamp: datetime
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    resolved: bool = False
    resolved_at: Optional[datetime] = None
    
    def to_dict(self):
        return {
            "alert_type": self.alert_type.value,
            "severity": self.severity.value,
            "metric_type": self.metric_type.value,
            "value": self.value,
            "threshold": self.threshold,
            "project_id": self.project_id,
            "timestamp": self.timestamp.isoformat(),
            "message": self.message,
            "details": self.details,
            "resolved": self.resolved,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None
        }


@dataclass
class AnalyticsSnapshot:
    """Complete analytics snapshot at a point in time"""
    project_id: str
    timestamp: datetime
    semantic_health: float
    graph_metrics: Dict[str, float]
    risk_score: float
    consistency_score: float
    predictions: Dict[str, Any]
    active_alerts: List[Alert] = field(default_factory=list)
    api_latencies: Dict[str, float] = field(default_factory=dict)
    cached: bool = False
    
    def to_dict(self):
        return {
            "project_id": self.project_id,
            "timestamp": self.timestamp.isoformat(),
            "semantic_health": self.semantic_health,
            "graph_metrics": self.graph_metrics,
            "risk_score": self.risk_score,
            "consistency_score": self.consistency_score,
            "predictions": self.predictions,
            "active_alerts": [a.to_dict() for a in self.active_alerts],
            "api_latencies": self.api_latencies,
            "cached": self.cached
        }


@dataclass
class MonitoringReport:
    """Comprehensive monitoring report"""
    project_id: str
    snapshot: AnalyticsSnapshot
    trend_analysis: Dict[str, str]  # metric -> trend (increasing/decreasing/stable)
    active_alerts_count: int
    critical_alerts: List[Alert]
    recommendations: List[str]
    timestamp: datetime
    
    def to_dict(self):
        return {
            "project_id": self.project_id,
            "snapshot": self.snapshot.to_dict(),
            "trend_analysis": self.trend_analysis,
            "active_alerts_count": self.active_alerts_count,
            "critical_alerts": [a.to_dict() for a in self.critical_alerts],
            "recommendations": self.recommendations,
            "timestamp": self.timestamp.isoformat()
        }


# ==================== WEBHOOK HANDLER ====================

class WebhookHandler(ABC):
    """Base class for webhook handlers"""
    
    @abstractmethod
    async def send(self, alert: Alert, endpoint: str) -> bool:
        """Send alert to webhook endpoint"""
        pass
    
    @abstractmethod
    async def validate_endpoint(self, endpoint: str) -> bool:
        """Validate webhook endpoint is reachable"""
        pass


class SimpleWebhookHandler(WebhookHandler):
    """Simple webhook handler with request validation"""
    
    def __init__(self, timeout: int = 5):
        self.timeout = timeout
    
    async def send(self, alert: Alert, endpoint: str) -> bool:
        """Send alert to webhook endpoint"""
        try:
            # In production, would use aiohttp.ClientSession
            payload = {
                "alert": alert.to_dict(),
                "timestamp": datetime.now().isoformat()
            }
            logger.info(f"Would send webhook to {endpoint}: {alert.alert_type.value}")
            # Simulated success
            return True
        except Exception as e:
            logger.error(f"Webhook send failed: {e}")
            return False
    
    async def validate_endpoint(self, endpoint: str) -> bool:
        """Validate webhook endpoint"""
        try:
            # Basic URL validation
            return endpoint.startswith("http://") or endpoint.startswith("https://")
        except Exception:
            return False


# ==================== MONITORING ENGINE ====================

_monitoring_engine: Optional['MonitoringEngine'] = None


class MonitoringEngine:
    """
    Real-time monitoring engine for analytics metrics.
    
    Features:
    - Tracks metrics over time
    - Triggers alerts based on thresholds
    - Manages webhooks
    - Maintains snapshot history
    - Provides trend analysis
    """
    
    def __init__(self, 
                 webhook_handler: Optional[WebhookHandler] = None,
                 max_snapshots_per_project: int = 100,
                 alert_history_hours: int = 24):
        """
        Initialize monitoring engine
        
        Args:
            webhook_handler: Handler for webhook delivery
            max_snapshots_per_project: Max snapshots to keep per project
            alert_history_hours: Hours of alert history to maintain
        """
        self.webhook_handler = webhook_handler or SimpleWebhookHandler()
        self.max_snapshots_per_project = max_snapshots_per_project
        self.alert_history_hours = alert_history_hours
        
        # In-memory storage (in production would be MongoDB + Redis)
        self.snapshots: Dict[str, List[AnalyticsSnapshot]] = {}
        self.alerts: List[Alert] = []
        self.thresholds: Dict[str, AlertThreshold] = {}
        self.webhooks: Dict[str, List[str]] = {}  # project_id -> webhook endpoints
        self.metric_history: Dict[str, List[MetricValue]] = {}
        
        logger.info("MonitoringEngine initialized")
    
    # ==================== THRESHOLD MANAGEMENT ====================
    
    def set_threshold(self, project_id: str, threshold: AlertThreshold):
        """Configure alert threshold for a metric"""
        key = f"{project_id}:{threshold.metric_type.value}"
        self.thresholds[key] = threshold
        logger.info(f"Threshold set: {key}")
    
    def get_threshold(self, project_id: str, metric_type: MetricType) -> Optional[AlertThreshold]:
        """Get threshold for a metric"""
        key = f"{project_id}:{metric_type.value}"
        return self.thresholds.get(key)
    
    def get_default_thresholds(self, project_id: str) -> Dict[str, AlertThreshold]:
        """Get default thresholds for all metrics"""
        defaults = {
            MetricType.RISK_SCORE: AlertThreshold(
                metric_type=MetricType.RISK_SCORE,
                upper_threshold=0.75,
                lower_threshold=0.0,
                severity=AlertSeverity.HIGH
            ),
            MetricType.QUALITY_SCORE: AlertThreshold(
                metric_type=MetricType.QUALITY_SCORE,
                upper_threshold=1.0,
                lower_threshold=0.5,
                severity=AlertSeverity.MEDIUM
            ),
            MetricType.CONSISTENCY_SCORE: AlertThreshold(
                metric_type=MetricType.CONSISTENCY_SCORE,
                upper_threshold=1.0,
                lower_threshold=0.6,
                severity=AlertSeverity.MEDIUM
            ),
            MetricType.ERROR_RATE: AlertThreshold(
                metric_type=MetricType.ERROR_RATE,
                upper_threshold=0.05,
                lower_threshold=0.0,
                severity=AlertSeverity.HIGH
            ),
            MetricType.API_LATENCY: AlertThreshold(
                metric_type=MetricType.API_LATENCY,
                upper_threshold=1000,  # ms
                lower_threshold=0.0,
                severity=AlertSeverity.MEDIUM
            )
        }
        
        # Apply project-specific overrides
        for metric_type, threshold in defaults.items():
            key = f"{project_id}:{metric_type.value}"
            if key in self.thresholds:
                defaults[metric_type] = self.thresholds[key]
        
        return defaults
    
    # ==================== METRIC COLLECTION ====================
    
    def record_metric(self, metric: MetricValue):
        """Record a metric value"""
        key = f"{metric.project_id}:{metric.type.value}"
        
        if key not in self.metric_history:
            self.metric_history[key] = []
        
        self.metric_history[key].append(metric)
        
        # Keep only last 1000 values per metric
        if len(self.metric_history[key]) > 1000:
            self.metric_history[key] = self.metric_history[key][-1000:]
        
        logger.debug(f"Metric recorded: {key} = {metric.value}")
    
    def get_metrics(self, project_id: str, metric_type: MetricType, 
                   hours: int = 24) -> List[MetricValue]:
        """Get metric history"""
        key = f"{project_id}:{metric_type.value}"
        if key not in self.metric_history:
            return []
        
        cutoff = datetime.now() - timedelta(hours=hours)
        return [m for m in self.metric_history[key] if m.timestamp >= cutoff]
    
    # ==================== ALERT GENERATION ====================
    
    def check_thresholds(self, project_id: str, metrics: Dict[MetricType, float]) -> List[Alert]:
        """Check metrics against thresholds and generate alerts"""
        alerts = []
        
        for metric_type, value in metrics.items():
            threshold = self.get_threshold(project_id, metric_type)
            if not threshold or not threshold.enabled:
                continue
            
            if threshold.check_violation(value):
                # Determine severity
                severity = self._calculate_severity(value, threshold)
                
                alert = Alert(
                    alert_type=self._get_alert_type(metric_type),
                    severity=severity,
                    metric_type=metric_type,
                    value=value,
                    threshold=threshold.upper_threshold,
                    project_id=project_id,
                    timestamp=datetime.now(),
                    message=self._generate_alert_message(metric_type, value, threshold),
                    details={"metric_type": metric_type.value}
                )
                
                alerts.append(alert)
                self.alerts.append(alert)
                
                logger.warning(f"Alert triggered: {alert.alert_type.value} "
                              f"(severity={alert.severity.value})")
        
        return alerts
    
    def _calculate_severity(self, value: float, threshold: AlertThreshold) -> AlertSeverity:
        """Calculate alert severity based on how far value deviates from threshold"""
        if value > threshold.upper_threshold:
            deviation = value - threshold.upper_threshold
            max_deviation = 1.0 - threshold.upper_threshold
        else:
            deviation = threshold.lower_threshold - value
            max_deviation = threshold.lower_threshold
        
        percentage = deviation / max_deviation if max_deviation > 0 else 0.5
        
        if percentage > 0.8:
            return AlertSeverity.CRITICAL
        elif percentage > 0.6:
            return AlertSeverity.HIGH
        elif percentage > 0.4:
            return AlertSeverity.MEDIUM
        elif percentage > 0.2:
            return AlertSeverity.LOW
        else:
            return AlertSeverity.INFO
    
    def _get_alert_type(self, metric_type: MetricType) -> AlertType:
        """Map metric type to alert type"""
        mapping = {
            MetricType.RISK_SCORE: AlertType.RISK_THRESHOLD,
            MetricType.CONSISTENCY_SCORE: AlertType.INCONSISTENCY_SPIKE,
            MetricType.ERROR_RATE: AlertType.PERFORMANCE_DEGRADATION,
            MetricType.API_LATENCY: AlertType.PERFORMANCE_DEGRADATION,
            MetricType.FORECAST_ERROR: AlertType.FORECAST_ANOMALY,
            MetricType.CLUSTERING_STABILITY: AlertType.CLUSTER_INSTABILITY,
        }
        return mapping.get(metric_type, AlertType.METRIC_ANOMALY)
    
    def _generate_alert_message(self, metric_type: MetricType, value: float, 
                               threshold: AlertThreshold) -> str:
        """Generate human-readable alert message"""
        metric_name = metric_type.value.replace("_", " ").title()
        
        if value > threshold.upper_threshold:
            return f"{metric_name} exceeded threshold: {value:.2f} > {threshold.upper_threshold:.2f}"
        else:
            return f"{metric_name} fell below threshold: {value:.2f} < {threshold.lower_threshold:.2f}"
    
    # ==================== SNAPSHOT MANAGEMENT ====================
    
    def create_snapshot(self, project_id: str, 
                       semantic_health: float,
                       graph_metrics: Dict[str, float],
                       risk_score: float,
                       consistency_score: float,
                       predictions: Dict[str, Any],
                       api_latencies: Optional[Dict[str, float]] = None) -> AnalyticsSnapshot:
        """Create a complete analytics snapshot"""
        
        snapshot = AnalyticsSnapshot(
            project_id=project_id,
            timestamp=datetime.now(),
            semantic_health=semantic_health,
            graph_metrics=graph_metrics,
            risk_score=risk_score,
            consistency_score=consistency_score,
            predictions=predictions,
            api_latencies=api_latencies or {}
        )
        
        # Store snapshot
        if project_id not in self.snapshots:
            self.snapshots[project_id] = []
        
        self.snapshots[project_id].append(snapshot)
        
        # Keep only latest snapshots
        if len(self.snapshots[project_id]) > self.max_snapshots_per_project:
            self.snapshots[project_id] = self.snapshots[project_id][-self.max_snapshots_per_project:]
        
        logger.info(f"Snapshot created for project {project_id}")

        # Attempt to persist to MongoDB (best-effort)
        if _save_snapshot is not None:
            try:
                # save_snapshot expects a dict serializable to MongoDB
                _save_snapshot(snapshot.to_dict())
            except Exception as e:
                logger.warning(f"Failed to persist snapshot to MongoDB: {e}")

        # Update cache (Redis or in-memory) if available
        if _set_cached_snapshot is not None:
            try:
                _set_cached_snapshot(project_id, snapshot.to_dict())
                snapshot.cached = True
            except Exception as e:
                logger.warning(f"Failed to update cache for snapshot: {e}")

        return snapshot
    
    def get_latest_snapshot(self, project_id: str) -> Optional[AnalyticsSnapshot]:
        """Get latest snapshot for a project"""
        # Try cache first
        if _get_cached_snapshot is not None:
            try:
                cached = _get_cached_snapshot(project_id)
                if cached:
                    # Build a minimal AnalyticsSnapshot from cached data
                    try:
                        ts = datetime.fromisoformat(cached.get("timestamp"))
                    except Exception:
                        ts = datetime.now()

                    snap = AnalyticsSnapshot(
                        project_id=cached.get("project_id", project_id),
                        timestamp=ts,
                        semantic_health=cached.get("semantic_health", 0.0),
                        graph_metrics=cached.get("graph_metrics", {}),
                        risk_score=cached.get("risk_score", 0.0),
                        consistency_score=cached.get("consistency_score", 0.0),
                        predictions=cached.get("predictions", {}),
                        api_latencies=cached.get("api_latencies", {}),
                        active_alerts=[],
                        cached=True
                    )
                    return snap
            except Exception as e:
                logger.debug(f"Cache lookup failed: {e}")

        if project_id not in self.snapshots or not self.snapshots[project_id]:
            return None
        return self.snapshots[project_id][-1]
    
    def get_snapshot_history(self, project_id: str, hours: int = 24) -> List[AnalyticsSnapshot]:
        """Get snapshot history"""
        if project_id not in self.snapshots:
            return []
        
        cutoff = datetime.now() - timedelta(hours=hours)
        return [s for s in self.snapshots[project_id] if s.timestamp >= cutoff]
    
    # ==================== ALERT MANAGEMENT ====================
    
    def get_active_alerts(self, project_id: str) -> List[Alert]:
        """Get active (unresolved) alerts for a project"""
        cutoff = datetime.now() - timedelta(hours=self.alert_history_hours)
        return [a for a in self.alerts 
                if a.project_id == project_id and not a.resolved and a.timestamp >= cutoff]
    
    def resolve_alert(self, alert_id: int) -> bool:
        """Resolve an alert"""
        if alert_id < len(self.alerts):
            self.alerts[alert_id].resolved = True
            self.alerts[alert_id].resolved_at = datetime.now()
            return True
        return False
    
    def get_alert_history(self, project_id: str, hours: int = None, 
                         alert_type: Optional[AlertType] = None) -> List[Alert]:
        """Get alert history"""
        hours = hours or self.alert_history_hours
        cutoff = datetime.now() - timedelta(hours=hours)
        
        alerts = [a for a in self.alerts 
                 if a.project_id == project_id and a.timestamp >= cutoff]
        
        if alert_type:
            alerts = [a for a in alerts if a.alert_type == alert_type]
        
        return alerts
    
    # ==================== WEBHOOK MANAGEMENT ====================
    
    def register_webhook(self, project_id: str, endpoint: str):
        """Register a webhook endpoint"""
        if project_id not in self.webhooks:
            self.webhooks[project_id] = []
        
        if endpoint not in self.webhooks[project_id]:
            self.webhooks[project_id].append(endpoint)
            logger.info(f"Webhook registered for {project_id}: {endpoint}")
    
    def unregister_webhook(self, project_id: str, endpoint: str) -> bool:
        """Unregister a webhook endpoint"""
        if project_id in self.webhooks and endpoint in self.webhooks[project_id]:
            self.webhooks[project_id].remove(endpoint)
            logger.info(f"Webhook unregistered for {project_id}: {endpoint}")
            return True
        return False
    
    async def trigger_webhooks(self, alert: Alert):
        """Trigger all registered webhooks for an alert"""
        endpoints = self.webhooks.get(alert.project_id, [])
        
        for endpoint in endpoints:
            try:
                await self.webhook_handler.send(alert, endpoint)
            except Exception as e:
                logger.error(f"Webhook trigger failed for {endpoint}: {e}")
    
    # ==================== TREND ANALYSIS ====================
    
    def analyze_trends(self, project_id: str, hours: int = 24) -> Dict[str, str]:
        """Analyze trends in metrics"""
        trends = {}
        
        snapshots = self.get_snapshot_history(project_id, hours)
        if len(snapshots) < 2:
            return trends
        
        # Analyze semantic health trend
        values = [s.semantic_health for s in snapshots]
        trends["semantic_health"] = self._calculate_trend(values)
        
        # Analyze risk score trend
        values = [s.risk_score for s in snapshots]
        trends["risk_score"] = self._calculate_trend(values)
        
        # Analyze consistency trend
        values = [s.consistency_score for s in snapshots]
        trends["consistency_score"] = self._calculate_trend(values)
        
        return trends
    
    def _calculate_trend(self, values: List[float]) -> str:
        """Calculate trend from values"""
        if len(values) < 2:
            return "stable"
        
        first_half = sum(values[:len(values)//2]) / max(len(values)//2, 1)
        second_half = sum(values[len(values)//2:]) / max(len(values) - len(values)//2, 1)
        
        change = second_half - first_half
        threshold = 0.05  # 5% change threshold
        
        if change > threshold:
            return "increasing"
        elif change < -threshold:
            return "decreasing"
        else:
            return "stable"
    
    # ==================== REPORTING ====================
    
    def generate_monitoring_report(self, project_id: str) -> MonitoringReport:
        """Generate comprehensive monitoring report"""
        
        snapshot = self.get_latest_snapshot(project_id)
        if not snapshot:
            # Create empty snapshot
            snapshot = AnalyticsSnapshot(
                project_id=project_id,
                timestamp=datetime.now(),
                semantic_health=0.0,
                graph_metrics={},
                risk_score=0.0,
                consistency_score=0.0,
                predictions={}
            )
        
        active_alerts = self.get_active_alerts(project_id)
        critical_alerts = [a for a in active_alerts if a.severity == AlertSeverity.CRITICAL]
        
        trends = self.analyze_trends(project_id)
        
        # Generate recommendations
        recommendations = self._generate_recommendations(
            snapshot, active_alerts, trends
        )
        
        report = MonitoringReport(
            project_id=project_id,
            snapshot=snapshot,
            trend_analysis=trends,
            active_alerts_count=len(active_alerts),
            critical_alerts=critical_alerts,
            recommendations=recommendations,
            timestamp=datetime.now()
        )
        
        return report
    
    def _generate_recommendations(self, snapshot: AnalyticsSnapshot, 
                                 alerts: List[Alert],
                                 trends: Dict[str, str]) -> List[str]:
        """Generate recommendations based on current state"""
        recommendations = []
        
        if snapshot.risk_score > 0.7:
            recommendations.append("Risk score is high. Review high-risk requirements and mitigation strategies.")
        
        if snapshot.consistency_score < 0.7:
            recommendations.append("Consistency score is low. Check for duplicate or conflicting requirements.")
        
        if snapshot.semantic_health < 0.6:
            recommendations.append("Semantic health is poor. Review requirement descriptions for clarity and precision.")
        
        if trends.get("risk_score") == "increasing":
            recommendations.append("Risk trend is increasing. Monitor new requirements for potential issues.")
        
        if len([a for a in alerts if a.severity == AlertSeverity.CRITICAL]) > 0:
            recommendations.append("Critical alerts detected. Immediate action required.")
        
        if not recommendations:
            recommendations.append("Project is in good health. Continue monitoring.")
        
        return recommendations


def get_engine() -> MonitoringEngine:
    """Get or create monitoring engine instance"""
    global _monitoring_engine
    if _monitoring_engine is None:
        _monitoring_engine = MonitoringEngine()
    return _monitoring_engine


def reset_engine():
    """Reset engine (for testing)"""
    global _monitoring_engine
    _monitoring_engine = None
