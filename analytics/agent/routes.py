"""
ETAPA 9: Agent-Specific Analytics - API Routes
Endpoints para análisis específico de agentes IA
"""

from fastapi import APIRouter, HTTPException, Body
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import logging

from .tool_efficiency import get_tool_efficiency_analyzer
from .planner_confidence import get_planner_confidence_scorer
from .reasoning_tracer import get_reasoning_tracer
from .context_analyzer import get_context_analyzer
from .hallucination_risk import get_hallucination_risk_estimator

logger = logging.getLogger(__name__)

# ==================== PYDANTIC MODELS ====================

class ToolLog(BaseModel):
    """Log de ejecución de herramienta"""
    tool_name: str
    latency_ms: Optional[float] = None
    status: str = "success"
    usefulness_score: Optional[float] = None
    token_cost: Optional[float] = None
    hallucination: Optional[bool] = False

class ToolEfficiencyRequest(BaseModel):
    """Request para analizar eficiencia de herramientas"""
    project_id: str
    tool_logs: Optional[List[ToolLog]] = None

class PlannerConfidenceRequest(BaseModel):
    """Request para puntuar confianza del planificador"""
    project_id: str
    plan_data: Optional[Dict[str, Any]] = None

class ReasoningTraceRequest(BaseModel):
    """Request para trazar razonamiento"""
    execution_id: str
    reasoning_steps: Optional[List[Dict[str, Any]]] = None

class ContextChunk(BaseModel):
    """Chunk de contexto"""
    id: str
    content: str
    source: str
    relevance_score: Optional[float] = 0.5

class ContextPollutionRequest(BaseModel):
    """Request para detectar contaminación de contexto"""
    query: str
    context_chunks: Optional[List[ContextChunk]] = None
    project_id: Optional[str] = None

class RetrievalResult(BaseModel):
    """Resultado de retrieval"""
    source: str
    score: float

class HallucinationRiskRequest(BaseModel):
    """Request para estimar riesgo de alucinaciones"""
    prompt: str
    context: Optional[List[ContextChunk]] = None
    retrieval_results: Optional[List[RetrievalResult]] = None
    project_id: Optional[str] = None

# ==================== ROUTER ====================

router = APIRouter(prefix="/agent", tags=["agent-analytics"])

# ==================== ENDPOINTS ====================

@router.post("/tool-efficiency")
async def analyze_tool_efficiency(request: ToolEfficiencyRequest):
    """
    Analiza eficiencia de herramientas del agente.
    
    **Response:**
    - `tools`: Métricas por herramienta (latencia, utilidad, hallucination rate, etc)
    - `overall_efficiency`: 0-1 score general
    - `recommendations`: Lista de recomendaciones
    """
    try:
        analyzer = get_tool_efficiency_analyzer()
        tool_logs = None
        if request.tool_logs:
            tool_logs = [log.dict() for log in request.tool_logs]
        
        result = analyzer.analyze_tool_efficiency(request.project_id, tool_logs)
        return result
    
    except Exception as e:
        logger.error(f"Error in tool_efficiency endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/planner-confidence")
async def score_planner_confidence(request: PlannerConfidenceRequest):
    """
    Calcula puntuación de confianza del planificador del agente.
    
    **Response:**
    - `confidence`: Qué tan seguro está el plan (0-1)
    - `stability`: Estabilidad del plan (0-1)
    - `predictability`: Predictibilidad (0-1)
    - `reasoning_clarity`: Claridad de razonamiento (0-1)
    - `overall_score`: Score combinado (0-1)
    - `factors`: Análisis detallado
    - `issues`: Problemas detectados
    - `recommendations`: Recomendaciones
    """
    try:
        scorer = get_planner_confidence_scorer()
        result = scorer.score_planner_confidence(request.plan_data, request.project_id)
        return result
    
    except Exception as e:
        logger.error(f"Error in planner_confidence endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reasoning-trace")
async def trace_reasoning(request: ReasoningTraceRequest):
    """
    Traza y visualiza el razonamiento del agente en tiempo real.
    
    **Response:**
    - `reasoning_path`: Pasos del razonamiento
    - `tools_called`: Herramientas utilizadas
    - `chunks_used`: Fragmentos de contexto
    - `decision_points`: Puntos de decisión del agente
    - `visualization`: Datos para visualizar (timeline, tree, etc)
    - `summary`: Resumen de la ejecución
    """
    try:
        tracer = get_reasoning_tracer()
        reasoning_steps = None
        if request.reasoning_steps:
            reasoning_steps = request.reasoning_steps
        
        result = tracer.trace_agent_reasoning(request.execution_id, reasoning_steps)
        return result
    
    except Exception as e:
        logger.error(f"Error in reasoning_trace endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/context-pollution")
async def detect_pollution(request: ContextPollutionRequest):
    """
    Detecta chunks irrelevantes que contaminan el contexto del agente.
    
    **Response:**
    - `pollution_detected`: ¿Se detectó contaminación?
    - `pollution_ratio`: % de contexto inútil (0-1)
    - `irrelevant_chunks`: Chunks que no aportan
    - `relevant_chunks`: Chunks útiles
    - `confidence`: Confianza del análisis (0-1)
    - `recommendations`: Cómo remediar
    - `analysis`: Análisis detallado
    """
    try:
        analyzer = get_context_analyzer()
        context_chunks = None
        if request.context_chunks:
            context_chunks = [c.dict() for c in request.context_chunks]
        
        result = analyzer.detect_context_pollution(
            request.query,
            context_chunks,
            request.project_id
        )
        return result
    
    except Exception as e:
        logger.error(f"Error in context_pollution endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/hallucination-risk")
async def estimate_hallucination_risk(request: HallucinationRiskRequest):
    """
    Estima riesgo de alucinaciones en la respuesta del agente.
    
    **Response:**
    - `risk_score`: Probabilidad de alucinación (0-1)
    - `risk_level`: "safe" | "caution" | "risky"
    - `factors`: Desglose de factores de riesgo
      - `coverage`: % de cobertura de la pregunta
      - `context_quality`: Calidad del contexto (0-1)
      - `semantic_confidence`: Confianza semántica (0-1)
      - `retrieval_quality`: Calidad del retrieval (0-1)
      - `prompt_ambiguity`: Ambigüedad del prompt (0-1)
    - `recommendations`: Acciones recomendadas
    - `mitigation_strategies`: Estrategias para mitigar riesgo
    """
    try:
        estimator = get_hallucination_risk_estimator()
        
        context = None
        if request.context:
            context = [c.dict() for c in request.context]
        
        retrieval_results = None
        if request.retrieval_results:
            retrieval_results = [r.dict() for r in request.retrieval_results]
        
        result = estimator.estimate_hallucination_risk(
            request.prompt,
            context,
            retrieval_results,
            request.project_id
        )
        return result
    
    except Exception as e:
        logger.error(f"Error in hallucination_risk endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== BATCH ENDPOINT ====================

@router.post("/batch-analysis")
async def batch_agent_analysis(request: Dict[str, Any] = Body(...)):
    """
    Ejecuta múltiples análisis en una sola petición para optimizar.
    
    **Request:**
    ```json
    {
        "project_id": "project_123",
        "include_tool_efficiency": true,
        "include_planner_confidence": true,
        "include_reasoning_trace": true,
        "include_context_pollution": true,
        "include_hallucination_risk": true,
        "tool_logs": [...],
        "plan_data": {...},
        "execution_id": "exec_123",
        "query": "What requirements are related to auth?",
        "prompt": "Analyze security requirements"
    }
    ```
    
    **Response:**
    Objeto con todos los análisis solicitados bajo sus respectivas claves.
    """
    try:
        project_id = request.get("project_id")
        results = {}
        
        # Tool Efficiency
        if request.get("include_tool_efficiency", False):
            analyzer = get_tool_efficiency_analyzer()
            results["tool_efficiency"] = analyzer.analyze_tool_efficiency(
                project_id, 
                request.get("tool_logs")
            )
        
        # Planner Confidence
        if request.get("include_planner_confidence", False):
            scorer = get_planner_confidence_scorer()
            results["planner_confidence"] = scorer.score_planner_confidence(
                request.get("plan_data"),
                project_id
            )
        
        # Reasoning Trace
        if request.get("include_reasoning_trace", False):
            tracer = get_reasoning_tracer()
            results["reasoning_trace"] = tracer.trace_agent_reasoning(
                request.get("execution_id", "unknown"),
                request.get("reasoning_steps")
            )
        
        # Context Pollution
        if request.get("include_context_pollution", False):
            analyzer = get_context_analyzer()
            results["context_pollution"] = analyzer.detect_context_pollution(
                request.get("query", ""),
                request.get("context"),
                project_id
            )
        
        # Hallucination Risk
        if request.get("include_hallucination_risk", False):
            estimator = get_hallucination_risk_estimator()
            results["hallucination_risk"] = estimator.estimate_hallucination_risk(
                request.get("prompt", ""),
                request.get("context"),
                request.get("retrieval_results"),
                project_id
            )
        
        return {
            "project_id": project_id,
            "analyses": results,
            "timestamp": logger.info("Batch analysis completed")
        }
    
    except Exception as e:
        logger.error(f"Error in batch_analysis endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== EXPORTS ====================

def setup_agent_routes(app):
    """
    Registra rutas de agent analytics en FastAPI app
    
    Usage:
        from fastapi import FastAPI
        from analytics.agent.routes import setup_agent_routes
        
        app = FastAPI()
        setup_agent_routes(app)
    """
    app.include_router(router)
    logger.info("✓ ETAPA 9 (Agent-Specific Analytics) routes registered")
