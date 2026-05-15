"""
ETAPA 6: Real-time Monitoring Routes
====================================

FastAPI endpoints para monitoreo en tiempo real, alertas y webhooks.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import logging

from .monitoring_engine import (
    get_engine,
    MonitoringEngine,
    MetricValue,
    AlertThreshold,
    Alert,
    AnalyticsSnapshot,
    MonitoringReport,
    AlertSeverity,
    AlertType,
    MetricType,
)

logger = logging.getLogger(__name__)


# ==================== PYDANTIC MODELS ====================

class MetricValueRequest(BaseModel):
    """Request to record a metric value"""
    type: str
    value: float
    details: Optional[Dict[str, Any]] = Field(default_factory=dict)


class ThresholdRequest(BaseModel):
    """Request to set alert threshold"""
    metric_type: str
    upper_threshold: float
    lower_threshold: float
    severity: str
    enabled: bool = True


class WebhookRequest(BaseModel):
    """Request to register webhook"""
    endpoint: str


class SnapshotRequest(BaseModel):
    """Request to create analytics snapshot"""
    semantic_health: float
    graph_metrics: Dict[str, float]
    risk_score: float
    consistency_score: float
    predictions: Dict[str, Any]
    api_latencies: Optional[Dict[str, float]] = None


class AlertResponse(BaseModel):
    """Alert response model"""
    alert_type: str
    severity: str
    metric_type: str
    value: float
    threshold: float
    timestamp: str
    message: str
    resolved: bool
    details: Dict[str, Any]


class SnapshotResponse(BaseModel):
    """Snapshot response model"""
    project_id: str
    timestamp: str
    semantic_health: float
    graph_metrics: Dict[str, float]
    risk_score: float
    consistency_score: float
    predictions: Dict[str, Any]
    active_alerts: List[AlertResponse]
    cached: bool


class MonitoringReportResponse(BaseModel):
    """Monitoring report response"""
    project_id: str
    snapshot: SnapshotResponse
    trend_analysis: Dict[str, str]
    active_alerts_count: int
    critical_alerts: List[AlertResponse]
    recommendations: List[str]
    timestamp: str


class HealthCheckResponse(BaseModel):
    """Health check response"""
    status: str
    engine: str
    version: str
    timestamp: str


# ==================== ROUTER ====================

router = APIRouter(prefix="/advanced/monitoring", tags=["monitoring"])


# ==================== HEALTH CHECK ====================

@router.get("/health-check", response_model=HealthCheckResponse)
async def health_check():
    """Health check for monitoring engine"""
    try:
        engine = get_engine()
        return {
            "status": "healthy",
            "engine": "MonitoringEngine",
            "version": "6.0",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Monitoring engine unavailable")


# ==================== METRICS ====================

@router.post("/{project_id}/metrics/record")
async def record_metric(project_id: str, metric: MetricValueRequest):
    """Record a metric value"""
    try:
        engine = get_engine()
        
        # Validate metric type
        try:
            metric_type = MetricType[metric.type.upper()]
        except KeyError:
            raise HTTPException(status_code=400, detail=f"Invalid metric type: {metric.type}")
        
        # Create and record metric
        metric_value = MetricValue(
            type=metric_type,
            value=metric.value,
            timestamp=datetime.now(),
            project_id=project_id,
            details=metric.details
        )
        
        engine.record_metric(metric_value)
        
        return {
            "status": "recorded",
            "metric_type": metric.type,
            "value": metric.value,
            "timestamp": datetime.now().isoformat()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error recording metric: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project_id}/metrics/{metric_type}")
async def get_metrics(
    project_id: str,
    metric_type: str,
    hours: int = Query(24, ge=1, le=720)
):
    """Get metric history"""
    try:
        engine = get_engine()
        
        # Validate metric type
        try:
            mt = MetricType[metric_type.upper()]
        except KeyError:
            raise HTTPException(status_code=400, detail=f"Invalid metric type: {metric_type}")
        
        metrics = engine.get_metrics(project_id, mt, hours)
        
        return {
            "project_id": project_id,
            "metric_type": metric_type,
            "hours": hours,
            "count": len(metrics),
            "data": [m.to_dict() for m in metrics]
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== THRESHOLDS ====================

@router.post("/{project_id}/thresholds")
async def set_threshold(project_id: str, threshold: ThresholdRequest):
    """Set alert threshold"""
    try:
        engine = get_engine()
        
        # Validate metric type
        try:
            metric_type = MetricType[threshold.metric_type.upper()]
        except KeyError:
            raise HTTPException(status_code=400, detail=f"Invalid metric type: {threshold.metric_type}")
        
        # Validate severity
        try:
            severity = AlertSeverity[threshold.severity.upper()]
        except KeyError:
            raise HTTPException(status_code=400, detail=f"Invalid severity: {threshold.severity}")
        
        # Create and set threshold
        alert_threshold = AlertThreshold(
            metric_type=metric_type,
            upper_threshold=threshold.upper_threshold,
            lower_threshold=threshold.lower_threshold,
            severity=severity,
            enabled=threshold.enabled
        )
        
        engine.set_threshold(project_id, alert_threshold)
        
        return {
            "status": "set",
            "project_id": project_id,
            "metric_type": threshold.metric_type,
            "upper_threshold": threshold.upper_threshold,
            "lower_threshold": threshold.lower_threshold
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting threshold: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project_id}/thresholds")
async def get_thresholds(project_id: str):
    """Get all thresholds for a project"""
    try:
        engine = get_engine()
        thresholds = engine.get_default_thresholds(project_id)
        
        return {
            "project_id": project_id,
            "thresholds": {
                k: {
                    "metric_type": v.metric_type.value,
                    "upper_threshold": v.upper_threshold,
                    "lower_threshold": v.lower_threshold,
                    "severity": v.severity.value,
                    "enabled": v.enabled
                }
                for k, v in thresholds.items()
            }
        }
    
    except Exception as e:
        logger.error(f"Error getting thresholds: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== SNAPSHOTS ====================

@router.post("/{project_id}/snapshots")
async def create_snapshot(project_id: str, snapshot: SnapshotRequest):
    """Create analytics snapshot"""
    try:
        engine = get_engine()
        
        snapshot_obj = engine.create_snapshot(
            project_id=project_id,
            semantic_health=snapshot.semantic_health,
            graph_metrics=snapshot.graph_metrics,
            risk_score=snapshot.risk_score,
            consistency_score=snapshot.consistency_score,
            predictions=snapshot.predictions,
            api_latencies=snapshot.api_latencies
        )
        
        return snapshot_obj.to_dict()
    
    except Exception as e:
        logger.error(f"Error creating snapshot: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project_id}/snapshots/latest")
async def get_latest_snapshot(project_id: str):
    """Get latest snapshot"""
    try:
        engine = get_engine()
        snapshot = engine.get_latest_snapshot(project_id)
        
        if not snapshot:
            raise HTTPException(status_code=404, detail="No snapshots found")
        
        return snapshot.to_dict()
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting snapshot: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project_id}/snapshots/history")
async def get_snapshot_history(
    project_id: str,
    hours: int = Query(24, ge=1, le=720)
):
    """Get snapshot history"""
    try:
        engine = get_engine()
        snapshots = engine.get_snapshot_history(project_id, hours)
        
        return {
            "project_id": project_id,
            "hours": hours,
            "count": len(snapshots),
            "data": [s.to_dict() for s in snapshots]
        }
    
    except Exception as e:
        logger.error(f"Error getting snapshot history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== ALERTS ====================

@router.post("/{project_id}/alerts/check")
async def check_alerts(project_id: str, metrics: Dict[str, float]):
    """Check metrics against thresholds and generate alerts"""
    try:
        engine = get_engine()
        
        # Convert string keys to MetricType
        metric_dict = {}
        for key, value in metrics.items():
            try:
                metric_type = MetricType[key.upper()]
                metric_dict[metric_type] = value
            except KeyError:
                logger.warning(f"Unknown metric type: {key}")
        
        alerts = engine.check_thresholds(project_id, metric_dict)
        
        return {
            "project_id": project_id,
            "alerts_generated": len(alerts),
            "alerts": [a.to_dict() for a in alerts]
        }
    
    except Exception as e:
        logger.error(f"Error checking alerts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project_id}/alerts/active")
async def get_active_alerts(project_id: str):
    """Get active alerts"""
    try:
        engine = get_engine()
        alerts = engine.get_active_alerts(project_id)
        
        return {
            "project_id": project_id,
            "count": len(alerts),
            "alerts": [a.to_dict() for a in alerts]
        }
    
    except Exception as e:
        logger.error(f"Error getting active alerts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project_id}/alerts/history")
async def get_alert_history(
    project_id: str,
    hours: int = Query(24, ge=1, le=720),
    alert_type: Optional[str] = None
):
    """Get alert history"""
    try:
        engine = get_engine()
        
        # Validate alert type if provided
        alert_type_enum = None
        if alert_type:
            try:
                alert_type_enum = AlertType[alert_type.upper()]
            except KeyError:
                raise HTTPException(status_code=400, detail=f"Invalid alert type: {alert_type}")
        
        alerts = engine.get_alert_history(project_id, hours, alert_type_enum)
        
        return {
            "project_id": project_id,
            "hours": hours,
            "alert_type": alert_type,
            "count": len(alerts),
            "alerts": [a.to_dict() for a in alerts]
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting alert history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== WEBHOOKS ====================

@router.post("/{project_id}/webhooks")
async def register_webhook(project_id: str, webhook: WebhookRequest):
    """Register webhook endpoint"""
    try:
        engine = get_engine()
        
        engine.register_webhook(project_id, webhook.endpoint)
        
        return {
            "status": "registered",
            "project_id": project_id,
            "endpoint": webhook.endpoint
        }
    
    except Exception as e:
        logger.error(f"Error registering webhook: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{project_id}/webhooks")
async def unregister_webhook(project_id: str, endpoint: str = Query(...)):
    """Unregister webhook endpoint"""
    try:
        engine = get_engine()
        
        success = engine.unregister_webhook(project_id, endpoint)
        
        if not success:
            raise HTTPException(status_code=404, detail="Webhook not found")
        
        return {
            "status": "unregistered",
            "project_id": project_id,
            "endpoint": endpoint
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error unregistering webhook: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== REPORTING ====================

@router.get("/{project_id}/report")
async def get_monitoring_report(project_id: str):
    """Generate comprehensive monitoring report"""
    try:
        engine = get_engine()
        report = engine.generate_monitoring_report(project_id)
        
        return report.to_dict()
    
    except Exception as e:
        logger.error(f"Error generating report: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project_id}/dashboard")
async def get_dashboard_data(project_id: str, hours: int = Query(24, ge=1, le=720)):
    """Get comprehensive dashboard data"""
    try:
        engine = get_engine()
        
        # Get latest snapshot
        snapshot = engine.get_latest_snapshot(project_id)
        if not snapshot:
            snapshot = AnalyticsSnapshot(
                project_id=project_id,
                timestamp=datetime.now(),
                semantic_health=0.0,
                graph_metrics={},
                risk_score=0.0,
                consistency_score=0.0,
                predictions={}
            )
        
        # Get trends
        trends = engine.analyze_trends(project_id, hours)
        
        # Get alerts
        active_alerts = engine.get_active_alerts(project_id)
        alert_history = engine.get_alert_history(project_id, hours)
        
        # Get metric history
        risk_metrics = engine.get_metrics(project_id, MetricType.RISK_SCORE, hours)
        quality_metrics = engine.get_metrics(project_id, MetricType.QUALITY_SCORE, hours)
        
        return {
            "project_id": project_id,
            "snapshot": snapshot.to_dict(),
            "trends": trends,
            "alerts": {
                "active": len(active_alerts),
                "active_details": [a.to_dict() for a in active_alerts],
                "total_history": len(alert_history),
                "history": [a.to_dict() for a in alert_history[-20:]]  # Last 20
            },
            "metrics": {
                "risk_history": [m.to_dict() for m in risk_metrics[-20:]],
                "quality_history": [m.to_dict() for m in quality_metrics[-20:]]
            }
        }
    
    except Exception as e:
        logger.error(f"Error getting dashboard data: {e}")
        raise HTTPException(status_code=500, detail=str(e))
