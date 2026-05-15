"""
ETAPA 5: Advanced Features - FastAPI Routes
Endpoints para clustering, forecasting y explainability

Versión: 5.0
"""

import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# Import engines
try:
    from analytics.advanced.clustering_engine import get_engine as get_clustering_engine
    from analytics.advanced.clustering_engine import (
        Cluster, ClusteringReport, EmergentPattern, ClusterType
    )
except ImportError as e:
    logger.error(f"Failed to import clustering engine: {e}")
    get_clustering_engine = None

try:
    from analytics.advanced.forecasting_engine import get_engine as get_forecasting_engine
    from analytics.advanced.forecasting_engine import (
        TimeSeriesDataPoint, Forecast, Correlation, ForecastingReport, TrendType
    )
except ImportError as e:
    logger.error(f"Failed to import forecasting engine: {e}")
    get_forecasting_engine = None

try:
    from analytics.advanced.explainability_engine import get_engine as get_explainability_engine
    from analytics.advanced.explainability_engine import (
        PredictionExplanation, ExplainabilityReport, FeatureContribution
    )
except ImportError as e:
    logger.error(f"Failed to import explainability engine: {e}")
    get_explainability_engine = None

# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class ClusteringRequest(BaseModel):
    """Request para clustering"""
    requirements: List[Dict[str, Any]] = Field(..., description="Lista de requisitos")
    min_cluster_size: int = Field(default=3, description="Tamaño mínimo del cluster")
    project_id: Optional[str] = Field(default=None, description="ID del proyecto")


class ClusteringResponse(BaseModel):
    """Response de clustering"""
    project_id: Optional[str]
    total_clusters: int
    clusters: List[Dict[str, Any]]
    emergent_patterns: List[Dict[str, Any]]
    quality: str
    silhouette_score: Optional[float]


class ForecastingRequest(BaseModel):
    """Request para forecasting"""
    project_id: str = Field(..., description="ID del proyecto")
    requirements: List[Dict[str, Any]] = Field(..., description="Requisitos actuales")
    forecast_periods: int = Field(default=12, description="Periodos a predecir")


class ForecastingResponse(BaseModel):
    """Response de forecasting"""
    project_id: str
    analysis_date: datetime
    forecasts: List[Dict[str, Any]]
    trend_summary: Dict[str, Any]
    recommendations: List[str]


class ExplainabilityRequest(BaseModel):
    """Request para explainability"""
    prediction_type: str = Field(..., description="Tipo: risk, missing, inconsistency, clustering")
    prediction_data: Dict[str, Any] = Field(..., description="Datos de la predicción")
    analysis_type: Optional[str] = Field(default="detailed", description="Tipo de análisis")


class ExplainabilityResponse(BaseModel):
    """Response de explainability"""
    prediction_id: str
    explanation_type: str
    prediction_value: float
    feature_contributions: List[Dict[str, Any]]
    interpretation: str
    confidence: float


# =============================================================================
# ROUTER SETUP
# =============================================================================

router = APIRouter(prefix="/advanced", tags=["advanced"])


# =============================================================================
# CLUSTERING ENDPOINTS
# =============================================================================

@router.post("/clustering/analyze", response_model=ClusteringResponse)
async def analyze_clustering(request: ClusteringRequest):
    """
    Analiza clustering de requisitos usando HDBSCAN
    
    - **requirements**: Lista de requisitos con id y description
    - **min_cluster_size**: Tamaño mínimo del cluster (default: 3)
    - **project_id**: ID del proyecto (opcional)
    
    Returns:
    - Clusters identificados
    - Patrones emergentes
    - Métricas de calidad
    """
    try:
        if not get_clustering_engine:
            raise HTTPException(status_code=500, detail="Clustering engine not available")
        
        engine = get_clustering_engine()
        report = engine.cluster_requirements(
            request.requirements,
            min_cluster_size=request.min_cluster_size
        )
        
        return ClusteringResponse(
            project_id=request.project_id,
            total_clusters=report.total_clusters,
            clusters=[{
                "cluster_id": c.cluster_id,
                "type": c.cluster_type.value,
                "size": len(c.requirement_ids),
                "cohesion": c.cohesion,
                "isolation": c.isolation,
                "requirement_ids": c.requirement_ids
            } for c in report.clusters],
            emergent_patterns=[{
                "pattern_type": p.pattern_type,
                "description": p.description,
                "confidence": p.confidence,
                "recommendations": p.recommendations
            } for p in report.emergent_patterns],
            quality=report.summary.get("quality", "unknown"),
            silhouette_score=report.silhouette_score
        )
    
    except Exception as e:
        logger.error(f"Clustering analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Clustering failed: {str(e)}")


@router.post("/clustering/suggestions")
async def suggest_consolidations(request: ClusteringRequest):
    """
    Sugiere consolidaciones de clusters similares
    
    Returns lista de clusters que pueden ser fusionados
    """
    try:
        if not get_clustering_engine:
            raise HTTPException(status_code=500, detail="Clustering engine not available")
        
        engine = get_clustering_engine()
        
        # Primero hacer clustering
        report = engine.cluster_requirements(request.requirements)
        
        # Luego sugerir consolidaciones
        suggestions = engine.suggest_consolidations(
            report.clusters,
            request.requirements,
            similarity_threshold=0.85
        )
        
        return {
            "total_suggestions": len(suggestions),
            "suggestions": suggestions,
            "current_fragmentation": len([c for c in report.clusters if len(c.requirement_ids) <= 2]),
            "potential_consolidations": len(suggestions)
        }
    
    except Exception as e:
        logger.error(f"Consolidation suggestions failed: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.get("/clustering/health-check")
async def clustering_health_check():
    """Health check del módulo de clustering"""
    return {
        "module": "clustering",
        "status": "healthy" if get_clustering_engine else "unavailable",
        "version": "5.0",
        "capabilities": ["hdbscan_clustering", "pattern_detection", "consolidation_suggestions"]
    }


# =============================================================================
# FORECASTING ENDPOINTS
# =============================================================================

@router.post("/forecasting/project", response_model=ForecastingResponse)
async def forecast_project(request: ForecastingRequest):
    """
    Genera forecast completo para un proyecto
    
    - **project_id**: ID del proyecto
    - **requirements**: Requisitos actuales
    - **forecast_periods**: Periodos a predecir (default: 12)
    
    Returns:
    - Forecasts de crecimiento, cambios de prioridad, riesgo
    - Resumen de tendencias
    - Recomendaciones
    """
    try:
        if not get_forecasting_engine:
            raise HTTPException(status_code=500, detail="Forecasting engine not available")
        
        engine = get_forecasting_engine()
        report = engine.generate_forecasting_report(
            request.project_id,
            request.requirements
        )
        
        return ForecastingResponse(
            project_id=report.project_id,
            analysis_date=report.analysis_date,
            forecasts=[{
                "metric_name": f.metric_name,
                "current_value": f.current_value,
                "trend": f.trend_type.value,
                "forecast_values": f.forecast_values[:6],  # Next 6 periods
                "confidence": f.confidence
            } for f in report.forecasts],
            trend_summary=report.trend_summary,
            recommendations=report.recommendations
        )
    
    except Exception as e:
        logger.error(f"Forecasting failed: {e}")
        raise HTTPException(status_code=500, detail=f"Forecasting failed: {str(e)}")


@router.post("/forecasting/growth")
async def forecast_growth(request: Dict[str, Any]):
    """
    Predice crecimiento de requisitos
    
    Request: {"historical_data": [...], "forecast_periods": 12}
    """
    try:
        if not get_forecasting_engine:
            raise HTTPException(status_code=500, detail="Forecasting engine not available")
        
        engine = get_forecasting_engine()
        
        # Convertir datos históricos
        historical_data = [
            TimeSeriesDataPoint(
                timestamp=datetime.fromisoformat(dp["timestamp"]),
                value=dp["value"],
                requirement_type=dp.get("type")
            )
            for dp in request.get("historical_data", [])
        ]
        
        forecast = engine.forecast_requirement_growth(
            historical_data,
            request.get("forecast_periods", 12)
        )
        
        return {
            "metric": forecast.metric_name,
            "current_value": forecast.current_value,
            "forecast_values": forecast.forecast_values,
            "lower_bound": forecast.lower_bound,
            "upper_bound": forecast.upper_bound,
            "trend": forecast.trend_type.value,
            "confidence": forecast.confidence
        }
    
    except Exception as e:
        logger.error(f"Growth forecasting failed: {e}")
        raise HTTPException(status_code=500, detail=f"Forecasting failed: {str(e)}")


@router.post("/forecasting/anomalies")
async def detect_anomalies(request: Dict[str, Any]):
    """
    Detecta anomalías en una serie temporal
    
    Request: {"time_series": [...], "sensitivity": 2.0}
    """
    try:
        if not get_forecasting_engine:
            raise HTTPException(status_code=500, detail="Forecasting engine not available")
        
        engine = get_forecasting_engine()
        
        # Convertir datos
        time_series = [
            TimeSeriesDataPoint(
                timestamp=datetime.fromisoformat(dp["timestamp"]),
                value=dp["value"]
            )
            for dp in request.get("time_series", [])
        ]
        
        anomalies = engine.detect_anomalies(
            time_series,
            request.get("sensitivity", 2.0)
        )
        
        return {
            "total_anomalies": len(anomalies),
            "anomalies": anomalies,
            "severity_distribution": {
                "high": len([a for a in anomalies if a["severity"] == "high"]),
                "medium": len([a for a in anomalies if a["severity"] == "medium"])
            }
        }
    
    except Exception as e:
        logger.error(f"Anomaly detection failed: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.get("/forecasting/health-check")
async def forecasting_health_check():
    """Health check del módulo de forecasting"""
    return {
        "module": "forecasting",
        "status": "healthy" if get_forecasting_engine else "unavailable",
        "version": "5.0",
        "capabilities": ["prophet_forecasting", "anomaly_detection", "correlation_analysis"]
    }


# =============================================================================
# EXPLAINABILITY ENDPOINTS
# =============================================================================

@router.post("/explainability/risk", response_model=ExplainabilityResponse)
async def explain_risk(request: Dict[str, Any]):
    """
    Explica una predicción de riesgo
    
    Request:
    ```json
    {
      "requirement_id": "REQ-001",
      "requirement_text": "The system shall...",
      "risk_score": 0.45,
      "risk_factors": {
        "ambiguity": 0.2,
        "complexity": 0.15,
        ...
      }
    }
    ```
    """
    try:
        if not get_explainability_engine:
            raise HTTPException(status_code=500, detail="Explainability engine not available")
        
        engine = get_explainability_engine()
        explanation = engine.explain_risk_prediction(
            request.get("requirement_id", "unknown"),
            request.get("requirement_text", ""),
            request.get("risk_score", 0.5),
            request.get("risk_factors", {})
        )
        
        return ExplainabilityResponse(
            prediction_id=explanation.prediction_id,
            explanation_type=explanation.prediction_type,
            prediction_value=explanation.predicted_value,
            feature_contributions=[{
                "feature": c.feature_name,
                "value": str(c.feature_value),
                "contribution_pct": c.contribution_pct,
                "importance": c.importance_level.value,
                "direction": c.direction
            } for c in explanation.feature_contributions],
            interpretation=explanation.interpretation,
            confidence=explanation.confidence
        )
    
    except Exception as e:
        logger.error(f"Risk explanation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Explanation failed: {str(e)}")


@router.post("/explainability/missing")
async def explain_missing(request: Dict[str, Any]):
    """
    Explica por qué se detectó un requisito faltante
    
    Request:
    ```json
    {
      "missing_type": "security",
      "requirements": [...],
      "keywords": ["encrypt", "auth", ...],
      "confidence": 0.8
    }
    ```
    """
    try:
        if not get_explainability_engine:
            raise HTTPException(status_code=500, detail="Explainability engine not available")
        
        engine = get_explainability_engine()
        explanation = engine.explain_missing_requirements(
            request.get("missing_type", "unknown"),
            request.get("requirements", []),
            request.get("keywords", []),
            request.get("confidence", 0.6)
        )
        
        return ExplainabilityResponse(
            prediction_id=explanation.prediction_id,
            explanation_type=explanation.prediction_type,
            prediction_value=explanation.predicted_value,
            feature_contributions=[{
                "feature": c.feature_name,
                "value": str(c.feature_value),
                "contribution_pct": c.contribution_pct,
                "importance": c.importance_level.value,
                "direction": c.direction
            } for c in explanation.feature_contributions],
            interpretation=explanation.interpretation,
            confidence=explanation.confidence
        )
    
    except Exception as e:
        logger.error(f"Missing explanation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Explanation failed: {str(e)}")


@router.post("/explainability/inconsistency")
async def explain_inconsistency(request: Dict[str, Any]):
    """
    Explica por qué se detectó una inconsistencia
    """
    try:
        if not get_explainability_engine:
            raise HTTPException(status_code=500, detail="Explainability engine not available")
        
        engine = get_explainability_engine()
        explanation = engine.explain_inconsistency(
            request.get("inconsistency_type", "unknown"),
            request.get("requirement_ids", []),
            request.get("similarity_score"),
            request.get("metadata")
        )
        
        return ExplainabilityResponse(
            prediction_id=explanation.prediction_id,
            explanation_type=explanation.prediction_type,
            prediction_value=explanation.predicted_value,
            feature_contributions=[{
                "feature": c.feature_name,
                "value": str(c.feature_value),
                "contribution_pct": c.contribution_pct,
                "importance": c.importance_level.value,
                "direction": c.direction
            } for c in explanation.feature_contributions],
            interpretation=explanation.interpretation,
            confidence=explanation.confidence
        )
    
    except Exception as e:
        logger.error(f"Inconsistency explanation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Explanation failed: {str(e)}")


@router.post("/explainability/comprehensive")
async def comprehensive_explanation(request: Dict[str, Any]):
    """
    Genera explicación completa de múltiples predicciones
    
    Request: {"predictions": [...], "analysis_type": "comprehensive"}
    """
    try:
        if not get_explainability_engine:
            raise HTTPException(status_code=500, detail="Explainability engine not available")
        
        engine = get_explainability_engine()
        report = engine.generate_explainability_report(
            request.get("predictions", []),
            request.get("analysis_type", "comprehensive")
        )
        
        return {
            "analysis_type": report.analysis_type,
            "total_predictions": report.total_predictions_explained,
            "explanations": [{
                "prediction_id": p.prediction_id,
                "type": p.prediction_type,
                "value": p.predicted_value,
                "interpretation": p.interpretation,
                "confidence": p.confidence
            } for p in report.predictions],
            "insights": report.insights,
            "summary": report.summary
        }
    
    except Exception as e:
        logger.error(f"Comprehensive explanation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.get("/explainability/health-check")
async def explainability_health_check():
    """Health check del módulo de explainability"""
    return {
        "module": "explainability",
        "status": "healthy" if get_explainability_engine else "unavailable",
        "version": "5.0",
        "capabilities": ["risk_explanation", "missing_explanation", "inconsistency_explanation", "comprehensive_analysis"]
    }


# =============================================================================
# SETUP FUNCTION
# =============================================================================

def setup_advanced_routes(app):
    """
    Registra todas las rutas de ETAPA 5 en la aplicación FastAPI
    
    Args:
        app: Aplicación FastAPI
    """
    app.include_router(router)
    logger.info("✓ ETAPA 5 (Advanced Features) routes registered")
