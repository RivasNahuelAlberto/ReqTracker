"""
ETAPA 3: Graph Intelligence - FastAPI Routes
Endpoints para análisis de grafos de requisitos.

Versión: 3.0
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
from .graph_analyzer import (
    get_analyzer,
    NodeMetrics,
    Community,
    ImpactPropagation,
    CycleAnalysis,
    GraphMetrics
)
import logging

# Configure logging
logger = logging.getLogger(__name__)

# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class RequirementNode(BaseModel):
    """Definición de un requisito en el grafo"""
    id: str
    title: str
    description: Optional[str] = None
    type: str = "requirement"
    priority: str = "medium"


class RequirementRelationship(BaseModel):
    """Relación entre requisitos"""
    source_id: str
    target_id: str
    type: str = "depends_on"


class GraphBuildRequest(BaseModel):
    """Request para construir grafo"""
    requirements: List[RequirementNode]
    relationships: List[RequirementRelationship]


class CentralityRequest(BaseModel):
    """Request para análisis de centralidad"""
    requirements: List[RequirementNode]
    relationships: List[RequirementRelationship]
    metric: Optional[str] = "overall"  # pagerank, betweenness, etc.
    top_k: Optional[int] = 10


class CommunityDetectionRequest(BaseModel):
    """Request para detección de comunidades"""
    requirements: List[RequirementNode]
    relationships: List[RequirementRelationship]
    algorithm: str = "louvain"


class ImpactAnalysisRequest(BaseModel):
    """Request para análisis de impacto"""
    requirements: List[RequirementNode]
    relationships: List[RequirementRelationship]
    source_id: str
    max_depth: int = 10


class CycleAnalysisRequest(BaseModel):
    """Request para análisis de ciclos"""
    requirements: List[RequirementNode]
    relationships: List[RequirementRelationship]


class GlobalMetricsRequest(BaseModel):
    """Request para métricas globales"""
    requirements: List[RequirementNode]
    relationships: List[RequirementRelationship]


# Response Models

class NodeMetricsResponse(BaseModel):
    """Respuesta con métricas de nodo"""
    node_id: str
    label: str
    in_degree: int
    out_degree: int
    total_degree: int
    degree_centrality: float
    betweenness_centrality: float
    closeness_centrality: float
    pagerank_score: float
    eigenvector_centrality: Optional[float]
    harmonic_centrality: float
    overall_importance: float


class CentralityResponse(BaseModel):
    """Respuesta de análisis de centralidad"""
    total_nodes: int
    influential_nodes: List[tuple]  # (node_id, importance)
    node_metrics: Dict[str, Dict[str, Any]]
    recommendations: List[str]


class CommunityResponse(BaseModel):
    """Respuesta de detección de comunidades"""
    total_communities: int
    communities: List[Dict[str, Any]]
    average_density: float
    modularity: float
    recommendations: List[str]


class ImpactResponse(BaseModel):
    """Respuesta de análisis de impacto"""
    source_id: str
    affected_count: int
    critical_count: int
    impact_depth: int
    impact_distribution: Dict[str, int]
    total_impact_score: float
    critical_nodes: List[str]
    recommendations: List[str]


class CycleResponse(BaseModel):
    """Respuesta de análisis de ciclos"""
    has_cycles: bool
    cycle_count: int
    cycle_nodes: List[str]
    longest_cycle: int
    risk_level: str
    recommendations: List[str]


class GraphMetricsResponse(BaseModel):
    """Respuesta de métricas globales"""
    total_nodes: int
    total_edges: int
    density: float
    average_clustering_coefficient: float
    average_degree: float
    is_strongly_connected: bool
    component_count: int
    health_score: float
    health_verdict: str
    recommendations: List[str]


# =============================================================================
# ROUTER
# =============================================================================

router = APIRouter(prefix="/graph", tags=["graph-intelligence"])


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.post("/centrality", response_model=CentralityResponse)
async def calculate_centrality(request: CentralityRequest):
    """
    Calcula métricas de centralidad para identificar nodos influyentes.
    
    Endpoint: POST /graph/centrality
    """
    try:
        analyzer = get_analyzer()
        
        # Construir grafo
        G = analyzer.build_graph(
            [node.dict() for node in request.requirements],
            [rel.dict() for rel in request.relationships]
        )
        
        # Calcular centralidad
        node_metrics = analyzer.calculate_centrality_metrics(G)
        
        # Encontrar nodos influyentes
        influential = analyzer.find_influential_nodes(node_metrics, top_k=request.top_k)
        
        # Preparar respuesta
        node_metrics_response = {
            node_id: {
                'label': metrics.label,
                'in_degree': metrics.in_degree,
                'out_degree': metrics.out_degree,
                'pagerank': metrics.pagerank_score,
                'betweenness': metrics.betweenness_centrality,
                'closeness': metrics.closeness_centrality,
                'importance': metrics.get_overall_importance()
            }
            for node_id, metrics in node_metrics.items()
        }
        
        # Generar recomendaciones
        recommendations = [
            f"Node {node_id} has highest influence (score: {score:.2f})" 
            for node_id, score in influential[:3]
        ]
        
        if influential:
            recommendations.append(
                f"Consider prioritizing changes to: {', '.join([n[0] for n in influential[:3]])}"
            )
        
        return CentralityResponse(
            total_nodes=len(node_metrics),
            influential_nodes=influential,
            node_metrics=node_metrics_response,
            recommendations=recommendations
        )
    
    except Exception as e:
        logger.error(f"Centrality analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/communities", response_model=CommunityResponse)
async def detect_communities(request: CommunityDetectionRequest):
    """
    Detecta comunidades (clusters de requisitos relacionados).
    
    Endpoint: POST /graph/communities
    """
    try:
        analyzer = get_analyzer()
        
        # Construir grafo
        G = analyzer.build_graph(
            [node.dict() for node in request.requirements],
            [rel.dict() for rel in request.relationships]
        )
        
        # Detectar comunidades
        communities = analyzer.detect_communities(G, algorithm=request.algorithm)
        
        # Preparar respuesta
        communities_response = [
            {
                'community_id': c.community_id,
                'size': c.size,
                'density': c.density,
                'node_ids': c.node_ids,
                'theme': c.theme or f"Cluster {c.community_id}"
            }
            for c in communities
        ]
        
        avg_density = sum(c.density for c in communities) / len(communities) if communities else 0.0
        
        # Recomendaciones
        recommendations = []
        if len(communities) > 0:
            recommendations.append(f"Found {len(communities)} distinct clusters")
            
            # Encontrar comunidad más grande
            largest = max(communities, key=lambda c: c.size)
            recommendations.append(
                f"Largest cluster (id={largest.community_id}) has {largest.size} requirements"
            )
            
            # Encontrar comunidad con mayor densidad
            densest = max(communities, key=lambda c: c.density)
            recommendations.append(
                f"Most interconnected cluster (id={densest.community_id}) has density {densest.density:.2f}"
            )
        
        return CommunityResponse(
            total_communities=len(communities),
            communities=communities_response,
            average_density=avg_density,
            modularity=0.0,  # Calcular si es necesario
            recommendations=recommendations
        )
    
    except Exception as e:
        logger.error(f"Community detection error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/impact", response_model=ImpactResponse)
async def analyze_impact(request: ImpactAnalysisRequest):
    """
    Analiza el impacto de un cambio en un requisito.
    
    Endpoint: POST /graph/impact
    """
    try:
        analyzer = get_analyzer()
        
        # Validar que existe el source_id
        source_exists = any(req.id == request.source_id for req in request.requirements)
        if not source_exists:
            raise ValueError(f"Source requirement {request.source_id} not found")
        
        # Construir grafo
        G = analyzer.build_graph(
            [node.dict() for node in request.requirements],
            [rel.dict() for rel in request.relationships]
        )
        
        # Analizar impacto
        propagation = analyzer.analyze_impact_propagation(
            G, 
            request.source_id,
            max_depth=request.max_depth
        )
        
        # Recomendaciones
        recommendations = []
        if propagation.critical_nodes:
            recommendations.append(
                f"WARNING: {len(propagation.critical_nodes)} critical nodes affected"
            )
            recommendations.append(
                f"Critical nodes: {', '.join(propagation.critical_nodes[:5])}"
            )
        
        recommendations.append(f"Total impact score: {propagation.total_impact_score:.2f}")
        recommendations.append(f"Impact depth: {propagation.impact_depth} levels")
        
        return ImpactResponse(
            source_id=request.source_id,
            affected_count=len(propagation.affected_nodes),
            critical_count=len(propagation.critical_nodes),
            impact_depth=propagation.impact_depth,
            impact_distribution=propagation.impact_distribution,
            total_impact_score=propagation.total_impact_score,
            critical_nodes=propagation.critical_nodes,
            recommendations=recommendations
        )
    
    except Exception as e:
        logger.error(f"Impact analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cycles", response_model=CycleResponse)
async def analyze_cycles(request: CycleAnalysisRequest):
    """
    Detecta ciclos en el grafo (indicadores de problemas de diseño).
    
    Endpoint: POST /graph/cycles
    """
    try:
        analyzer = get_analyzer()
        
        # Construir grafo
        G = analyzer.build_graph(
            [node.dict() for node in request.requirements],
            [rel.dict() for rel in request.relationships]
        )
        
        # Analizar ciclos
        cycle_analysis = analyzer.analyze_cycles(G)
        
        # Recomendaciones
        recommendations = []
        if cycle_analysis.has_cycles:
            recommendations.append(
                f"⚠️  ALERT: Grafo contiene {cycle_analysis.cycle_count} ciclos"
            )
            recommendations.append(f"Risk level: {cycle_analysis.risk_level}")
            recommendations.append(
                f"Nodes involved in cycles: {len(cycle_analysis.cycle_nodes)}"
            )
            
            if cycle_analysis.risk_level == "high":
                recommendations.append(
                    "Acción recomendada: Revisar diseño y refactorizar para eliminar dependencias circulares"
                )
        else:
            recommendations.append("✓ Grafo es acíclico (DAG) - No hay dependencias circulares")
        
        return CycleResponse(
            has_cycles=cycle_analysis.has_cycles,
            cycle_count=cycle_analysis.cycle_count,
            cycle_nodes=list(cycle_analysis.cycle_nodes),
            longest_cycle=cycle_analysis.longest_cycle_length,
            risk_level=cycle_analysis.risk_level,
            recommendations=recommendations
        )
    
    except Exception as e:
        logger.error(f"Cycle analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/metrics", response_model=GraphMetricsResponse)
async def calculate_global_metrics(request: GlobalMetricsRequest):
    """
    Calcula métricas globales del grafo de requisitos.
    
    Endpoint: POST /graph/metrics
    """
    try:
        analyzer = get_analyzer()
        
        # Construir grafo
        G = analyzer.build_graph(
            [node.dict() for node in request.requirements],
            [rel.dict() for rel in request.relationships]
        )
        
        # Calcular métricas globales
        metrics = analyzer.calculate_global_metrics(G)
        
        # Determinar veredicto de salud
        health_score = metrics.graph_health_score
        if health_score >= 75:
            verdict = "healthy"
        elif health_score >= 50:
            verdict = "fair"
        elif health_score >= 25:
            verdict = "poor"
        else:
            verdict = "critical"
        
        # Recomendaciones
        recommendations = []
        recommendations.append(f"Graph health: {health_score:.1f}/100 ({verdict})")
        
        if not metrics.is_connected:
            recommendations.append(
                f"Grafo está desconectado ({metrics.strongly_connected_components} componentes)"
            )
        
        if metrics.density > 0.8:
            recommendations.append("Alta densidad: Posible redundancia en requisitos")
        
        if metrics.average_degree < 1:
            recommendations.append("Baja conectividad: Requisitos muy aislados")
        
        return GraphMetricsResponse(
            total_nodes=metrics.total_nodes,
            total_edges=metrics.total_edges,
            density=metrics.density,
            average_clustering_coefficient=metrics.average_clustering_coefficient,
            average_degree=metrics.average_degree,
            is_strongly_connected=metrics.is_connected,
            component_count=metrics.strongly_connected_components,
            health_score=health_score,
            health_verdict=verdict,
            recommendations=recommendations
        )
    
    except Exception as e:
        logger.error(f"Global metrics calculation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health-check")
async def health_check():
    """Health check del módulo Graph Intelligence"""
    try:
        analyzer = get_analyzer()
        return {
            "status": "healthy",
            "module": "graph-intelligence",
            "version": "3.0",
            "analyzer": "GraphAnalyzer",
            "algorithms": [
                "centrality_analysis",
                "community_detection",
                "impact_propagation",
                "cycle_detection",
                "global_metrics"
            ]
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# SETUP FUNCTION
# =============================================================================

def setup_graph_routes(app):
    """
    Registra las rutas de Graph Intelligence en la aplicación FastAPI.
    
    Uso:
        from analytics.graph import setup_graph_routes
        setup_graph_routes(app)
    """
    app.include_router(router)
    logger.info("Graph Intelligence routes registered")
