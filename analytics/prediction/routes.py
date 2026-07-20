"""
ETAPA 4: Prediction Engine - FastAPI Routes
Endpoints para predicción de riesgos y detección de anomalías.

Versión: 4.0
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
from analytics.prediction.prediction_engine import (
    get_engine,
    RiskPrediction,
    MissingRequirement,
    Inconsistency,
    PredictionReport
)
import logging

# Configure logging
logger = logging.getLogger(__name__)

# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class RequirementItem(BaseModel):
    """Definición de requisito"""
    id: str
    description: str
    priority: Optional[str] = "medium"
    type: Optional[str] = "requirement"


class RelationshipItem(BaseModel):
    """Relación entre requisitos"""
    source_id: str
    target_id: str
    type: str = "depends_on"


class RiskPredictionRequest(BaseModel):
    """Request para predicción de riesgo"""
    requirement_id: str
    requirement_text: str
    context: Optional[List[str]] = None
    project_context: Optional[Dict[str, Any]] = None


class MissingRequirementsRequest(BaseModel):
    """Request para detección de requisitos faltantes"""
    requirements: List[RequirementItem]
    project_context: Optional[Dict[str, Any]] = None


class InconsistencyDetectionRequest(BaseModel):
    """Request para detección de inconsistencias"""
    requirements: List[RequirementItem]
    relationships: Optional[List[RelationshipItem]] = None


class ComprehensivePredictionRequest(BaseModel):
    """Request para reporte completo"""
    requirements: List[RequirementItem]
    relationships: Optional[List[RelationshipItem]] = None
    project_context: Optional[Dict[str, Any]] = None
    project_id: Optional[str] = None


# Response Models

class RiskPredictionResponse(BaseModel):
    """Respuesta de predicción de riesgo"""
    requirement_id: str
    risk_score: float
    risk_level: str
    risk_factors: Dict[str, float]
    recommendations: List[str]
    confidence: float


class MissingRequirementsResponse(BaseModel):
    """Respuesta de requisitos faltantes"""
    total_found: int
    missing_requirements: List[Dict[str, Any]]
    recommendations: List[str]


class InconsistencyDetectionResponse(BaseModel):
    """Respuesta de detección de inconsistencias"""
    total_found: int
    inconsistencies: List[Dict[str, Any]]
    severity_distribution: Dict[str, int]
    recommendations: List[str]


class ComprehensivePredictionResponse(BaseModel):
    """Respuesta de predicción completa"""
    project_id: Optional[str]
    total_requirements: int
    summary: Dict[str, Any]
    risk_predictions: List[Dict[str, Any]]
    missing_requirements: List[Dict[str, Any]]
    inconsistencies: List[Dict[str, Any]]
    overall_assessment: str


# =============================================================================
# ROUTER
# =============================================================================

router = APIRouter(prefix="/prediction", tags=["prediction-engine"])


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.post("/risk", response_model=RiskPredictionResponse)
async def predict_risk(request: RiskPredictionRequest):
    """
    Predice el riesgo de un requisito.
    
    Endpoint: POST /prediction/risk
    
    Factores analizados:
    - Ambigüedad (25%): palabras vagas, falta de métricas
    - Complejidad (20%): condicionales, longitud
    - Dependencias (20%): contexto de relaciones
    - Conformancia (15%): cumplimiento de estándares
    - Cobertura (20%): áreas funcionales
    """
    try:
        engine = get_engine()
        
        prediction = engine.predict_requirement_risk(
            request.requirement_id,
            request.requirement_text,
            request.context,
            request.project_context
        )
        
        return RiskPredictionResponse(
            requirement_id=prediction.requirement_id,
            risk_score=prediction.risk_score,
            risk_level=prediction.risk_level,
            risk_factors=prediction.risk_factors,
            recommendations=prediction.recommendations,
            confidence=prediction.confidence
        )
    
    except Exception as e:
        logger.error(f"Risk prediction error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/missing", response_model=MissingRequirementsResponse)
async def detect_missing(request: MissingRequirementsRequest):
    """
    Detecta tipos de requisitos potencialmente faltantes.
    
    Endpoint: POST /prediction/missing
    
    Tipos detectados:
    - Security: Encriptación, autenticación, permisos
    - Performance: Tiempos de respuesta, throughput
    - Reliability: Disponibilidad, failover, backup
    - Error Handling: Validación, excepciones
    - Monitoring: Logging, alertas, métricas
    """
    try:
        engine = get_engine()
        
        requirements = [r.dict() for r in request.requirements]
        missing_list = engine.detect_missing_requirements(
            requirements,
            request.project_context
        )
        
        # Preparar recomendaciones
        recommendations = []
        if missing_list:
            type_counts = {}
            for m in missing_list:
                type_counts[m.missing_type] = type_counts.get(m.missing_type, 0) + 1
            
            recommendations.append(
                f"Found {len(missing_list)} potential gaps in requirements specification"
            )
            
            for missing_type, count in type_counts.items():
                recommendations.append(f"Add {count} requirement(s) for {missing_type}")
        
        return MissingRequirementsResponse(
            total_found=len(missing_list),
            missing_requirements=[
                {
                    'type': m.missing_type,
                    'priority': m.priority,
                    'description': m.description,
                    'rationale': m.rationale,
                    'affected_areas': m.affected_areas,
                    'confidence': m.confidence
                }
                for m in missing_list
            ],
            recommendations=recommendations
        )
    
    except Exception as e:
        logger.error(f"Missing requirements detection error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/inconsistencies", response_model=InconsistencyDetectionResponse)
async def detect_inconsistencies(request: InconsistencyDetectionRequest):
    """
    Detecta inconsistencias entre requisitos.
    
    Endpoint: POST /prediction/inconsistencies
    
    Tipos detectados:
    - Duplicates: Requisitos duplicados o muy similares
    - Conflicting Priorities: Prioridades contradictorias
    - Circular Dependencies: Dependencias circulares
    - Missing Dependencies: Dependencias no definidas
    """
    try:
        engine = get_engine()
        
        requirements = [r.dict() for r in request.requirements]
        relationships = (
            [rel.dict() for rel in request.relationships]
            if request.relationships
            else None
        )
        
        inconsistencies = engine.detect_inconsistencies(
            requirements,
            relationships
        )
        
        # Calcular distribución de severidad
        severity_dist = {}
        for inc in inconsistencies:
            severity = inc.severity
            severity_dist[severity] = severity_dist.get(severity, 0) + 1
        
        # Recomendaciones basadas en hallazgos
        recommendations = []
        if inconsistencies:
            recommendations.append(f"Found {len(inconsistencies)} inconsistencies")
            
            if severity_dist.get('critical', 0) > 0:
                recommendations.append(
                    f"⚠️  CRITICAL: {severity_dist['critical']} critical issues require immediate attention"
                )
            
            if severity_dist.get('high', 0) > 0:
                recommendations.append(
                    f"Review and resolve {severity_dist['high']} high-severity inconsistencies"
                )
        
        return InconsistencyDetectionResponse(
            total_found=len(inconsistencies),
            inconsistencies=[
                {
                    'type': inc.inconsistency_type,
                    'requirement_ids': inc.requirement_ids,
                    'severity': inc.severity,
                    'description': inc.description,
                    'suggestions': inc.resolution_suggestions,
                    'confidence': inc.confidence
                }
                for inc in inconsistencies
            ],
            severity_distribution=severity_dist,
            recommendations=recommendations
        )
    
    except Exception as e:
        logger.error(f"Inconsistency detection error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/comprehensive", response_model=ComprehensivePredictionResponse)
async def comprehensive_prediction(request: ComprehensivePredictionRequest):
    """
    Genera reporte completo de predicciones.
    
    Endpoint: POST /prediction/comprehensive
    
    Incluye:
    - Risk predictions para cada requisito
    - Requisitos potencialmente faltantes
    - Inconsistencias detectadas
    - Evaluación general del proyecto
    """
    try:
        engine = get_engine()
        
        requirements = [r.dict() for r in request.requirements]
        relationships = (
            [rel.dict() for rel in request.relationships]
            if request.relationships
            else None
        )
        
        report = engine.generate_prediction_report(
            requirements,
            relationships,
            request.project_context,
            request.project_id
        )
        
        return ComprehensivePredictionResponse(
            project_id=report.project_id,
            total_requirements=report.total_requirements,
            summary=report.summary,
            risk_predictions=[
                {
                    'requirement_id': p.requirement_id,
                    'risk_score': p.risk_score,
                    'risk_level': p.risk_level,
                    'factors': p.risk_factors,
                    'recommendations': p.recommendations,
                    'confidence': p.confidence
                }
                for p in report.risk_predictions
            ],
            missing_requirements=[
                {
                    'type': m.missing_type,
                    'priority': m.priority,
                    'description': m.description,
                    'confidence': m.confidence
                }
                for m in report.missing_requirements
            ],
            inconsistencies=[
                {
                    'type': inc.inconsistency_type,
                    'requirement_ids': inc.requirement_ids,
                    'severity': inc.severity,
                    'description': inc.description,
                    'confidence': inc.confidence
                }
                for inc in report.inconsistencies
            ],
            overall_assessment=report.summary['overall_assessment']
        )
    
    except Exception as e:
        logger.error(f"Comprehensive prediction error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health-check")
async def health_check():
    """Health check del módulo Prediction Engine"""
    try:
        engine = get_engine()
        return {
            "status": "healthy",
            "module": "prediction-engine",
            "version": "4.0",
            "predictions_available": [
                "risk_prediction",
                "missing_requirements",
                "inconsistency_detection",
                "comprehensive_report"
            ]
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# SETUP FUNCTION
# =============================================================================

def setup_prediction_routes(app):
    """
    Registra las rutas de Prediction Engine en la aplicación FastAPI.
    
    Uso:
        from analytics.prediction import setup_prediction_routes
        setup_prediction_routes(app)
    """
    app.include_router(router)
    logger.info("Prediction Engine routes registered")
