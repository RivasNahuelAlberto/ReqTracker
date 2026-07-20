"""
ETAPA 2: Semantic Intelligence - API Routes
Endpoints para análisis semántico de requisitos
"""

from fastapi import APIRouter, HTTPException
from typing import List, Optional, Dict
from pydantic import BaseModel
import logging

from .semantic_analyzer import SemanticAnalyzer

logger = logging.getLogger(__name__)

# ==================== PYDANTIC MODELS ====================

class RequirementAnalysis(BaseModel):
    """Request: Analizar un requisito"""
    requirement: str
    context: Optional[List[str]] = None

class AmbiguityAnalysis(BaseModel):
    """Request: Detectar ambigüedad"""
    requirement: str
    threshold: Optional[float] = 0.5

class SemanticDriftRequest(BaseModel):
    """Request: Detectar semantic drift"""
    current_requirements: List[str]
    previous_requirements: Optional[List[str]] = None
    threshold: Optional[float] = 0.6

class TopicExtractionRequest(BaseModel):
    """Request: Extraer temas"""
    requirements: List[str]
    n_topics: Optional[int] = 5

# ==================== ROUTER ====================

router = APIRouter(prefix="/semantic", tags=["semantic-intelligence"])

# Inicializar analizador (singleton)
analyzer = None

def get_analyzer():
    """Factory para obtener analyzer singleton"""
    global analyzer
    if analyzer is None:
        analyzer = SemanticAnalyzer()
    return analyzer

# ==================== ENDPOINTS ====================

@router.post("/health")
async def semantic_health_endpoint(request: RequirementAnalysis):
    """
    Calcula puntuación de salud semántica de un requisito
    
    Analiza:
    - Ambigüedad (palabras vagas)
    - Precisión (uso de métricas)
    - Completitud (tiene objetivo, método, criterio)
    - Complejidad (longevidad, condicionales)
    - Coherencia (relación con contexto)
    
    Returns:
        {
            "overall_score": 0-100,
            "components": {...},
            "issues": [...],
            "recommendations": [...],
            "verdict": "high_quality" | "medium_quality" | "low_quality"
        }
    """
    try:
        analyzer = get_analyzer()
        result = analyzer.calculate_semantic_health(
            request.requirement,
            request.context
        )
        
        logger.info(f"Semantic health: {result['verdict']} ({result['overall_score']})")
        return result
        
    except Exception as error:
        logger.error(f"Error in semantic health: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


@router.post("/ambiguity")
async def ambiguity_detection_endpoint(request: AmbiguityAnalysis):
    """
    Detecta términos ambiguos y vaguedad en requisito
    
    Returns:
        {
            "ambiguity_score": 0.0-1.0,
            "ambiguity_level": "high" | "medium" | "low",
            "vague_terms": [...],
            "risk_level": "critical" | "high" | "medium",
            "clarification_needed": bool,
            "suggestions": [...]
        }
    """
    try:
        analyzer = get_analyzer()
        result = analyzer.detect_ambiguity(
            request.requirement,
            request.threshold
        )
        
        logger.info(f"Ambiguity: {result['ambiguity_level']}")
        return result
        
    except Exception as error:
        logger.error(f"Error in ambiguity detection: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


@router.post("/drift")
async def semantic_drift_endpoint(request: SemanticDriftRequest):
    """
    Detecta cambios semánticos (drift) entre versiones de requisitos
    
    Útil para:
    - Detectar cambios involuntarios en requisitos
    - Validar que cambios sean intencionales
    - Rastrear evolución de requisitos
    
    Returns:
        {
            "has_significant_drift": bool,
            "average_drift": 0.0-1.0,
            "drift_count": int,
            "drift_analysis": [
                {
                    "index": int,
                    "similarity": 0.0-1.0,
                    "is_drift": bool,
                    "previous_requirement": str,
                    "current_requirement": str
                }
            ],
            "recommendation": str
        }
    """
    try:
        analyzer = get_analyzer()
        result = analyzer.detect_semantic_drift(
            request.current_requirements,
            request.previous_requirements,
            request.threshold
        )
        
        if result['has_significant_drift']:
            logger.warning(f"Significant semantic drift detected: {result['average_drift']}")
        else:
            logger.info(f"Semantic drift check: within threshold")
        
        return result
        
    except Exception as error:
        logger.error(f"Error in semantic drift detection: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


@router.post("/topics")
async def topic_extraction_endpoint(request: TopicExtractionRequest):
    """
    Extrae temas principales de requisitos usando análisis semántico
    
    Útil para:
    - Agrupar requisitos por tema
    - Detectar áreas de cobertura
    - Identificar concentraciones de requisitos
    
    Nota: Implementación básica aquí.
    Para producción, integrar BERTopic:
    ```
    from bertopic import BERTopic
    model = BERTopic(language="english")
    topics, probs = model.fit_transform(requirements)
    ```
    
    Returns:
        {
            "total_topics": int,
            "topics": [
                {
                    "topic_id": int,
                    "keyword": str,
                    "frequency": int,
                    "requirement_count": int,
                    "sample_requirements": [...]
                }
            ],
            "assignments": [int],  # topic_id for each requirement
            "entropy": float  # distribution entropy (0-inf, 0=concentrated, high=dispersed)
        }
    """
    try:
        if not request.requirements:
            raise ValueError("No requirements provided")
        
        analyzer = get_analyzer()
        result = analyzer.extract_topics(
            request.requirements,
            request.n_topics
        )
        
        logger.info(f"Topics extracted: {result['total_topics']} topics found")
        return result
        
    except Exception as error:
        logger.error(f"Error in topic extraction: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/health-check")
async def semantic_module_health():
    """Health check para módulo semántico"""
    try:
        analyzer = get_analyzer()
        return {
            "status": "healthy",
            "module": "semantic-intelligence",
            "version": "1.0.0",
            "features": [
                "semantic_health_scoring",
                "ambiguity_detection",
                "semantic_drift_detection",
                "topic_extraction"
            ]
        }
    except Exception as error:
        logger.error(f"Health check failed: {str(error)}")
        return {
            "status": "unhealthy",
            "error": str(error)
        }


# ==================== BATCH ENDPOINTS (ETAPA 7 preview) ====================

@router.post("/batch/health")
async def batch_semantic_health(requirements: List[Dict]):
    """
    Analiza múltiples requisitos en batch
    
    Útil para:
    - Análisis de proyecto completo
    - Dashboard de calidad semántica
    - Reports
    
    Request: [{"requirement": "...", "context": [...]}, ...]
    
    Returns:
        {
            "batch_id": str,
            "total_analyzed": int,
            "results": [...],
            "summary": {
                "average_score": float,
                "high_quality_count": int,
                "low_quality_count": int,
                "critical_issues": int
            }
        }
    """
    try:
        analyzer = get_analyzer()
        results = []
        scores = []
        issues_count = 0
        
        for item in requirements:
            result = analyzer.calculate_semantic_health(
                item.get('requirement', ''),
                item.get('context')
            )
            results.append(result)
            scores.append(result['overall_score'])
            issues_count += len(result['issues'])
        
        high_quality = sum(1 for r in results if r['verdict'] == 'high_quality')
        low_quality = sum(1 for r in results if r['verdict'] == 'low_quality')
        
        logger.info(f"Batch analysis: {len(requirements)} requirements, avg score: {sum(scores)/len(scores):.1f}")
        
        return {
            "batch_id": "batch_" + str(hash(tuple(str(r) for r in requirements)))[:10],
            "total_analyzed": len(requirements),
            "results": results,
            "summary": {
                "average_score": round(sum(scores) / len(scores), 2) if scores else 0,
                "high_quality_count": high_quality,
                "low_quality_count": low_quality,
                "critical_issues": issues_count,
                "distribution": {
                    "high_quality": high_quality,
                    "medium_quality": len(results) - high_quality - low_quality,
                    "low_quality": low_quality
                }
            }
        }
        
    except Exception as error:
        logger.error(f"Error in batch analysis: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


# ==================== EXPORTS ====================

def setup_semantic_routes(app):
    """
    Registra rutas semánticas en FastAPI app
    
    Usage:
        from fastapi import FastAPI
        from analytics.semantic.routes import setup_semantic_routes
        
        app = FastAPI()
        setup_semantic_routes(app)
    """
    app.include_router(router)
    logger.info("Semantic intelligence routes registered")
