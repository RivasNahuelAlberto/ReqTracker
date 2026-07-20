"""
ETAPA 3: Graph Intelligence - Analizador de Grafos
Analiza la estructura de requisitos como un grafo direccionado.

Proporcionado por: Analytics Service (Python/FastAPI)
Versión: 3.0
"""

import networkx as nx
from typing import Dict, List, Tuple, Set, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum
import math
import logging

# Configure logging
logger = logging.getLogger(__name__)

# =============================================================================
# DATA MODELS
# =============================================================================

class CentralityMetric(str, Enum):
    """Tipos de métricas de centralidad disponibles"""
    DEGREE = "degree"
    BETWEENNESS = "betweenness"
    CLOSENESS = "closeness"
    PAGERANK = "pagerank"
    EIGENVECTOR = "eigenvector"
    HARMONIC = "harmonic"


class ImpactLevel(str, Enum):
    """Niveles de impacto identificados"""
    CRITICAL = "critical"          # > 0.75
    HIGH = "high"                  # 0.5 - 0.75
    MEDIUM = "medium"              # 0.25 - 0.5
    LOW = "low"                    # 0.1 - 0.25
    MINIMAL = "minimal"            # < 0.1


@dataclass
class NodeMetrics:
    """Métricas de un nodo (requisito) en el grafo"""
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
    
    def get_overall_importance(self) -> float:
        """Calcula importancia general del nodo (0-1)"""
        return (
            (self.pagerank_score * 0.4) +
            (self.betweenness_centrality * 0.3) +
            (self.closeness_centrality * 0.2) +
            (self.harmonic_centrality * 0.1)
        )


@dataclass
class Community:
    """Comunidad detectada en el grafo"""
    community_id: int
    node_ids: List[str]
    size: int
    density: float
    modularity_contribution: float
    theme: Optional[str]  # Inferido del análisis de términos
    
    def __post_init__(self):
        self.size = len(self.node_ids)


@dataclass
class ImpactPropagation:
    """Análisis de propagación de impacto desde un nodo"""
    source_id: str
    affected_nodes: Dict[str, float]  # node_id -> impact_score
    impact_depth: int
    critical_nodes: List[str]
    impact_distribution: Dict[str, int]  # impact_level -> count
    total_impact_score: float


@dataclass
class CycleAnalysis:
    """Análisis de ciclos en el grafo"""
    has_cycles: bool
    cycle_count: int
    cycle_nodes: Set[str]
    longest_cycle_length: int
    cycles: List[List[str]]  # Lista de ciclos encontrados
    risk_level: str  # low, medium, high


@dataclass
class GraphMetrics:
    """Métricas globales del grafo"""
    total_nodes: int
    total_edges: int
    density: float
    average_clustering_coefficient: float
    average_degree: float
    average_path_length: Optional[float]
    diameter: Optional[int]
    is_connected: bool
    strongly_connected_components: int
    weakly_connected_components: int
    average_pagerank: float
    graph_health_score: float


# =============================================================================
# GRAPH ANALYZER CLASS
# =============================================================================

class GraphAnalyzer:
    """Analizador de grafos para requisitos"""
    
    def __init__(self):
        """Inicializa el analizador"""
        self.logger = logger
    
    # =========================================================================
    # GRAPH CONSTRUCTION
    # =========================================================================
    
    def build_graph(
        self,
        requirements: List[Dict[str, Any]],
        relationships: List[Dict[str, str]]
    ) -> nx.DiGraph:
        """
        Construye un grafo dirigido a partir de requisitos y relaciones.
        
        Args:
            requirements: Lista de {id, title, description, ...}
            relationships: Lista de {source_id, target_id, type}
        
        Returns:
            Grafo NetworkX dirigido
        """
        G = nx.DiGraph()
        
        # Agregar nodos
        for req in requirements:
            G.add_node(
                req['id'],
                label=req.get('title', ''),
                type=req.get('type', 'requirement'),
                priority=req.get('priority', 'medium')
            )
        
        # Agregar aristas
        for rel in relationships:
            source = rel.get('source_id')
            target = rel.get('target_id')
            rel_type = rel.get('type', 'depends_on')
            
            if source in G and target in G:
                G.add_edge(source, target, relationship_type=rel_type)
        
        self.logger.info(f"Graph built: {len(G.nodes())} nodes, {len(G.edges())} edges")
        return G
    
    # =========================================================================
    # CENTRALITY ANALYSIS
    # =========================================================================
    
    def calculate_centrality_metrics(self, G: nx.DiGraph) -> Dict[str, NodeMetrics]:
        """
        Calcula todas las métricas de centralidad para cada nodo.
        
        Args:
            G: Grafo dirigido
        
        Returns:
            Diccionario de node_id -> NodeMetrics
        """
        # Calcular todas las métricas
        degree_centrality = nx.degree_centrality(G)
        betweenness = nx.betweenness_centrality(G)
        closeness = nx.closeness_centrality(G)
        pagerank = nx.pagerank(G)
        harmonic = nx.harmonic_centrality(G)
        
        # Intentar eigenvector (puede fallar si grafo es desconectado)
        try:
            eigenvector = nx.eigenvector_centrality(G, max_iter=1000)
        except nx.NetworkXError:
            eigenvector = {node: 0.0 for node in G.nodes()}
        
        # Construir NodeMetrics para cada nodo
        metrics = {}
        for node in G.nodes():
            in_degree = G.in_degree(node)
            out_degree = G.out_degree(node)
            
            metrics[node] = NodeMetrics(
                node_id=node,
                label=G.nodes[node].get('label', ''),
                in_degree=in_degree,
                out_degree=out_degree,
                total_degree=in_degree + out_degree,
                degree_centrality=degree_centrality.get(node, 0.0),
                betweenness_centrality=betweenness.get(node, 0.0),
                closeness_centrality=closeness.get(node, 0.0),
                pagerank_score=pagerank.get(node, 0.0),
                eigenvector_centrality=eigenvector.get(node, None),
                harmonic_centrality=harmonic.get(node, 0.0)
            )
        
        self.logger.info(f"Centrality metrics calculated for {len(metrics)} nodes")
        return metrics
    
    def find_influential_nodes(
        self,
        metrics: Dict[str, NodeMetrics],
        top_k: int = 10
    ) -> List[Tuple[str, float]]:
        """
        Identifica los nodos más influyentes según importancia general.
        
        Args:
            metrics: NodeMetrics por nodo
            top_k: Número de nodos a retornar
        
        Returns:
            Lista de (node_id, importance_score) ordenada descendente
        """
        node_importance = [
            (node_id, node_metrics.get_overall_importance())
            for node_id, node_metrics in metrics.items()
        ]
        
        node_importance.sort(key=lambda x: x[1], reverse=True)
        return node_importance[:top_k]
    
    # =========================================================================
    # COMMUNITY DETECTION
    # =========================================================================
    
    def detect_communities(
        self,
        G: nx.DiGraph,
        algorithm: str = "louvain"
    ) -> List[Community]:
        """
        Detecta comunidades en el grafo usando Louvain.
        
        Args:
            G: Grafo dirigido
            algorithm: Algoritmo a usar ("louvain" por defecto)
        
        Returns:
            Lista de Community objetos
        """
        try:
            from networkx.algorithms import community
        except ImportError:
            self.logger.warning("Community detection not available")
            return []
        
        # Convertir a no dirigido para Louvain (es para grafos no dirigidos)
        G_undirected = G.to_undirected()
        
        # Detectar comunidades
        communities_generator = community.greedy_modularity_communities(G_undirected)
        communities_list = list(communities_generator)
        
        # Construir Community objetos
        communities = []
        for community_id, nodes in enumerate(communities_list):
            nodes_list = list(nodes)
            subgraph = G_undirected.subgraph(nodes_list)
            density = nx.density(subgraph)
            
            community_obj = Community(
                community_id=community_id,
                node_ids=nodes_list,
                size=len(nodes_list),
                density=density,
                modularity_contribution=0.0,  # Calculado en post-procesamiento
                theme=None  # Podría inferirse de términos comunes
            )
            communities.append(community_obj)
        
        self.logger.info(f"Detected {len(communities)} communities")
        return communities
    
    # =========================================================================
    # IMPACT PROPAGATION
    # =========================================================================
    
    def analyze_impact_propagation(
        self,
        G: nx.DiGraph,
        source_id: str,
        max_depth: int = 10
    ) -> ImpactPropagation:
        """
        Analiza cómo impacta un cambio en source_id a otros nodos.
        
        Args:
            G: Grafo dirigido
            source_id: Nodo fuente
            max_depth: Profundidad máxima de propagación
        
        Returns:
            ImpactPropagation con análisis completo
        """
        affected_nodes = {}
        impact_depth = 0
        
        # BFS para encontrar todos los nodos afectados
        visited = {source_id}
        queue = [(source_id, 0, 1.0)]  # (node, depth, impact_score)
        
        while queue:
            current_node, depth, impact_score = queue.pop(0)
            
            if depth > 0:  # No contar el nodo fuente
                affected_nodes[current_node] = impact_score
                impact_depth = max(impact_depth, depth)
            
            if depth < max_depth:
                # Propagar a sucesores con atenuación
                successors = list(G.successors(current_node))
                attenuation = 0.8  # Cada nivel reduce el impacto
                new_impact = impact_score * attenuation
                
                for successor in successors:
                    if successor not in visited:
                        visited.add(successor)
                        queue.append((successor, depth + 1, new_impact))
        
        # Clasificar por nivel de impacto
        impact_distribution = self._classify_impacts(affected_nodes.values())
        critical_nodes = [
            node for node, score in affected_nodes.items()
            if score > 0.5
        ]
        
        total_impact = sum(affected_nodes.values())
        
        propagation = ImpactPropagation(
            source_id=source_id,
            affected_nodes=affected_nodes,
            impact_depth=impact_depth,
            critical_nodes=critical_nodes,
            impact_distribution=impact_distribution,
            total_impact_score=total_impact
        )
        
        self.logger.info(
            f"Impact analysis from {source_id}: "
            f"{len(affected_nodes)} affected, depth={impact_depth}"
        )
        return propagation
    
    def _classify_impacts(self, impact_scores: List[float]) -> Dict[str, int]:
        """Clasifica impactos por nivel"""
        distribution = {
            'critical': 0,
            'high': 0,
            'medium': 0,
            'low': 0,
            'minimal': 0
        }
        
        for score in impact_scores:
            if score > 0.75:
                distribution['critical'] += 1
            elif score > 0.5:
                distribution['high'] += 1
            elif score > 0.25:
                distribution['medium'] += 1
            elif score > 0.1:
                distribution['low'] += 1
            else:
                distribution['minimal'] += 1
        
        return distribution
    
    # =========================================================================
    # CYCLE ANALYSIS
    # =========================================================================
    
    def analyze_cycles(self, G: nx.DiGraph) -> CycleAnalysis:
        """
        Analiza ciclos en el grafo (generalmente negativos en requisitos).
        
        Args:
            G: Grafo dirigido
        
        Returns:
            CycleAnalysis con detalles de ciclos
        """
        has_cycles = not nx.is_directed_acyclic_graph(G)
        
        if not has_cycles:
            analysis = CycleAnalysis(
                has_cycles=False,
                cycle_count=0,
                cycle_nodes=set(),
                longest_cycle_length=0,
                cycles=[],
                risk_level="low"
            )
        else:
            # Encontrar ciclos
            try:
                cycles = list(nx.simple_cycles(G))
            except:
                cycles = []
            
            cycle_nodes = set()
            longest_length = 0
            
            for cycle in cycles:
                cycle_nodes.update(cycle)
                longest_length = max(longest_length, len(cycle))
            
            # Determinar risk level
            if len(cycles) == 0:
                risk_level = "low"
            elif len(cycles) <= 2 and longest_length <= 3:
                risk_level = "low"
            elif len(cycles) <= 5 and longest_length <= 5:
                risk_level = "medium"
            else:
                risk_level = "high"
            
            analysis = CycleAnalysis(
                has_cycles=True,
                cycle_count=len(cycles),
                cycle_nodes=cycle_nodes,
                longest_cycle_length=longest_length,
                cycles=cycles,
                risk_level=risk_level
            )
        
        self.logger.info(f"Cycle analysis: {analysis.cycle_count} cycles, risk={analysis.risk_level}")
        return analysis
    
    # =========================================================================
    # GLOBAL METRICS
    # =========================================================================
    
    def calculate_global_metrics(self, G: nx.DiGraph) -> GraphMetrics:
        """
        Calcula métricas globales del grafo.
        
        Args:
            G: Grafo dirigido
        
        Returns:
            GraphMetrics con estadísticas globales
        """
        num_nodes = len(G.nodes())
        num_edges = len(G.edges())
        
        # Densidad
        if num_nodes > 1:
            density = nx.density(G)
        else:
            density = 0.0
        
        # Clustering
        try:
            avg_clustering = nx.average_clustering(G)
        except:
            avg_clustering = 0.0
        
        # Grado promedio
        if num_nodes > 0:
            total_degree = sum(dict(G.degree()).values())
            avg_degree = total_degree / num_nodes
        else:
            avg_degree = 0.0
        
        # Camino más corto promedio
        try:
            if nx.is_strongly_connected(G):
                avg_path_length = nx.average_shortest_path_length(G)
                diameter = nx.diameter(G)
            else:
                # Para grafos desconectados, usar la componente mayor
                largest_cc = max(nx.strongly_connected_components(G), key=len)
                subgraph = G.subgraph(largest_cc)
                if len(subgraph) > 1:
                    avg_path_length = nx.average_shortest_path_length(subgraph)
                    diameter = nx.diameter(subgraph)
                else:
                    avg_path_length = None
                    diameter = None
        except:
            avg_path_length = None
            diameter = None
        
        # Conectividad
        is_connected = nx.is_strongly_connected(G)
        strongly_connected = len(list(nx.strongly_connected_components(G)))
        weakly_connected = len(list(nx.weakly_connected_components(G)))
        
        # PageRank promedio
        try:
            pagerank = nx.pagerank(G)
            avg_pagerank = sum(pagerank.values()) / len(pagerank) if pagerank else 0.0
        except:
            avg_pagerank = 0.0
        
        # Calcular health score (0-100)
        health_score = self._calculate_graph_health_score(
            density=density,
            avg_clustering=avg_clustering,
            is_connected=is_connected,
            strongly_connected=strongly_connected,
            avg_degree=avg_degree
        )
        
        metrics = GraphMetrics(
            total_nodes=num_nodes,
            total_edges=num_edges,
            density=density,
            average_clustering_coefficient=avg_clustering,
            average_degree=avg_degree,
            average_path_length=avg_path_length,
            diameter=diameter,
            is_connected=is_connected,
            strongly_connected_components=strongly_connected,
            weakly_connected_components=weakly_connected,
            average_pagerank=avg_pagerank,
            graph_health_score=health_score
        )
        
        self.logger.info(f"Global metrics calculated: health_score={health_score:.1f}")
        return metrics
    
    def _calculate_graph_health_score(
        self,
        density: float,
        avg_clustering: float,
        is_connected: bool,
        strongly_connected: int,
        avg_degree: float
    ) -> float:
        """
        Calcula score de salud del grafo (0-100).
        
        Factores:
        - Conectividad: +30 si es fuertemente conectado
        - Densidad: +20 si 0.1 < d < 0.5 (óptimo)
        - Clustering: +20 si > 0.3 (muestra estructura local)
        - Uniformidad de grado: +20 si es relativamente uniforme
        - Componentes: +10 si pocos (idealmente 1)
        """
        score = 0.0
        
        # Conectividad (30 puntos)
        if is_connected and strongly_connected == 1:
            score += 30
        elif strongly_connected <= 3:
            score += 20
        elif strongly_connected <= 10:
            score += 10
        
        # Densidad (20 puntos) - óptimo 0.1-0.5
        if 0.1 < density < 0.5:
            score += 20
        elif density <= 0.8:
            score += 10
        elif density > 0.8:
            score -= 10  # Muy densa puede ser redundancia
        
        # Clustering (20 puntos)
        if avg_clustering > 0.3:
            score += 20
        elif avg_clustering > 0.1:
            score += 10
        
        # Uniformidad de grado (20 puntos)
        # Si todos los nodos tienen grado similar, indica estructura equilibrada
        if 1 < avg_degree < 5:
            score += 20
        elif avg_degree > 0:
            score += 10
        
        # Componentes (10 puntos)
        if strongly_connected == 1:
            score += 10
        elif strongly_connected <= 5:
            score += 5
        
        # Normalizar a 0-100
        return min(100.0, max(0.0, score))


# =============================================================================
# FACTORY FUNCTIONS
# =============================================================================

_analyzer_instance = None


def get_analyzer() -> GraphAnalyzer:
    """Singleton factory para GraphAnalyzer"""
    global _analyzer_instance
    if _analyzer_instance is None:
        _analyzer_instance = GraphAnalyzer()
    return _analyzer_instance


def reset_analyzer():
    """Reset analyzer (para testing)"""
    global _analyzer_instance
    _analyzer_instance = None
