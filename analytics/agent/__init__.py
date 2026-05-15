"""
ETAPA 9: Agent-Specific Analytics Module

Proporciona análisis específico para agentes IA:
- Tool efficiency matrix (latencia, utilidad, hallucination rate)
- Planner confidence scoring (confianza, estabilidad, predictibilidad)
- Reasoning path visualization (trazar razonamiento en tiempo real)
- Context pollution detection (detectar chunks irrelevantes)
- Hallucination risk estimation (estimar riesgo de alucinaciones)
"""

from .tool_efficiency import (
    ToolEfficiencyAnalyzer,
    get_tool_efficiency_analyzer
)

from .planner_confidence import (
    PlannerConfidenceScorer,
    get_planner_confidence_scorer
)

from .reasoning_tracer import (
    ReasoningTracer,
    get_reasoning_tracer
)

from .context_analyzer import (
    ContextAnalyzer,
    get_context_analyzer
)

from .hallucination_risk import (
    HallucinationRiskEstimator,
    get_hallucination_risk_estimator
)

from .routes import router, setup_agent_routes

__all__ = [
    'ToolEfficiencyAnalyzer',
    'get_tool_efficiency_analyzer',
    'PlannerConfidenceScorer',
    'get_planner_confidence_scorer',
    'ReasoningTracer',
    'get_reasoning_tracer',
    'ContextAnalyzer',
    'get_context_analyzer',
    'HallucinationRiskEstimator',
    'get_hallucination_risk_estimator',
    'router',
    'setup_agent_routes'
]

__version__ = '1.0.0'
__etapa__ = 'ETAPA 9'
