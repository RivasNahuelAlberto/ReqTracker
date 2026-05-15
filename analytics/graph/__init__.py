"""
ETAPA 3: Graph Intelligence - Module Initialization
Análisis de grafos para requisitos y relaciones.

Versión: 3.0
"""

from analytics.graph.graph_analyzer import (
    GraphAnalyzer,
    CentralityMetric,
    ImpactLevel,
    NodeMetrics,
    Community,
    ImpactPropagation,
    CycleAnalysis,
    GraphMetrics,
    get_analyzer,
    reset_analyzer
)

from analytics.graph.routes import (
    router,
    setup_graph_routes,
    CentralityRequest,
    CommunityDetectionRequest,
    ImpactAnalysisRequest,
    CycleAnalysisRequest,
    GlobalMetricsRequest
)

__version__ = "3.0"
__all__ = [
    # Core classes
    "GraphAnalyzer",
    "CentralityMetric",
    "ImpactLevel",
    
    # Data models
    "NodeMetrics",
    "Community",
    "ImpactPropagation",
    "CycleAnalysis",
    "GraphMetrics",
    
    # Factory functions
    "get_analyzer",
    "reset_analyzer",
    
    # FastAPI integration
    "router",
    "setup_graph_routes",
    
    # Request models
    "CentralityRequest",
    "CommunityDetectionRequest",
    "ImpactAnalysisRequest",
    "CycleAnalysisRequest",
    "GlobalMetricsRequest"
]
