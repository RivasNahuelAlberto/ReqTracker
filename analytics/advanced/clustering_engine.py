"""
ETAPA 5: Advanced Clustering Engine
Clustering avanzado usando HDBSCAN + embeddings semánticos

Versión: 5.0
"""

import logging
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import hashlib
import json

logger = logging.getLogger(__name__)

# Optional imports with fallback
try:
    from sklearn.preprocessing import normalize
    SKLEARN_AVAILABLE = True
except ImportError:
    logger.warning("⚠️  scikit-learn not installed, clustering will use basic methods")
    SKLEARN_AVAILABLE = False

try:
    import hdbscan
    HDBSCAN_AVAILABLE = True
except ImportError:
    logger.warning("⚠️  hdbscan not installed, will use fallback clustering")
    HDBSCAN_AVAILABLE = False

# =============================================================================
# DATA MODELS
# =============================================================================

class ClusterType(str, Enum):
    """Tipos de clusters detectados"""
    FUNCTIONAL = "functional"        # Requisitos de la misma función
    DOMAIN = "domain"                # Requisitos del mismo dominio
    DEPENDENCY = "dependency"        # Requisitos conectados
    ANOMALY = "anomaly"              # Requisitos anómalos (ruido)
    EMERGING = "emerging"            # Patrones emergentes


@dataclass
class RequirementPoint:
    """Punto de datos para clustering"""
    requirement_id: str
    description: str
    embedding: Optional[np.ndarray] = None
    metadata: Optional[Dict[str, Any]] = None
    
    def __hash__(self):
        return hash(self.requirement_id)


@dataclass
class Cluster:
    """Resultado de un cluster"""
    cluster_id: int
    cluster_type: ClusterType
    requirement_ids: List[str]
    cluster_center: Optional[np.ndarray]
    cohesion: float  # 0-1: qué tan "tight" es el cluster
    isolation: float  # 0-1: qué tan separado está del resto
    stability: float  # 0-1: qué tan estable es el cluster
    metadata: Dict[str, Any]


@dataclass
class EmergentPattern:
    """Patrón emergente detectado"""
    pattern_id: str
    pattern_type: str  # clustering_shift, topic_emergence, anomaly_increase
    description: str
    affected_clusters: List[int]
    confidence: float  # 0-1
    recommendations: List[str]


@dataclass
class ClusteringReport:
    """Reporte completo de clustering"""
    total_requirements: int
    total_clusters: int
    noise_count: int
    clusters: List[Cluster]
    emergent_patterns: List[EmergentPattern]
    silhouette_score: Optional[float]
    calinski_score: Optional[float]
    summary: Dict[str, Any]


# =============================================================================
# CLUSTERING ENGINE
# =============================================================================

_clustering_engine: Optional['ClusteringEngine'] = None


def get_engine() -> 'ClusteringEngine':
    """Factory function para obtener instancia del engine"""
    global _clustering_engine
    if _clustering_engine is None:
        _clustering_engine = ClusteringEngine()
    return _clustering_engine


def reset_engine():
    """Reset engine singleton"""
    global _clustering_engine
    _clustering_engine = None


class ClusteringEngine:
    """Motor de clustering avanzado con HDBSCAN"""
    
    def __init__(self):
        """Inicializa el motor"""
        self.logger = logger
        self.hdbscan_available = HDBSCAN_AVAILABLE
        self.sklearn_available = SKLEARN_AVAILABLE
        
        if not self.hdbscan_available:
            self.logger.warning("HDBSCAN not available, using fallback clustering")
        
        self.logger.info("✓ ClusteringEngine initialized")
    
    # =========================================================================
    # CLUSTERING METHODS
    # =========================================================================
    
    def cluster_requirements(
        self,
        requirements: List[Dict[str, Any]],
        embeddings: Optional[np.ndarray] = None,
        min_cluster_size: int = 3
    ) -> ClusteringReport:
        """
        Clustering de requisitos usando HDBSCAN o fallback
        
        Args:
            requirements: Lista de requisitos
            embeddings: Matriz de embeddings (n_reqs x embedding_dim)
            min_cluster_size: Tamaño mínimo del cluster
        
        Returns:
            ClusteringReport con todos los clusters
        """
        self.logger.info(f"Clustering {len(requirements)} requirements")
        
        if not requirements:
            return ClusteringReport(
                total_requirements=0,
                total_clusters=0,
                noise_count=0,
                clusters=[],
                emergent_patterns=[],
                silhouette_score=None,
                calinski_score=None,
                summary={"status": "empty"}
            )
        
        # Generar embeddings si no se proporcionan
        if embeddings is None:
            embeddings = self._generate_embeddings(requirements)
        
        # Clustering
        if self.hdbscan_available and len(requirements) >= min_cluster_size:
            labels, probabilities = self._hdbscan_clustering(
                embeddings,
                min_cluster_size=min_cluster_size
            )
        else:
            labels, probabilities = self._fallback_clustering(
                embeddings,
                min_cluster_size=min_cluster_size
            )
        
        # Construir clusters
        clusters = self._build_clusters(
            requirements,
            labels,
            probabilities,
            embeddings
        )
        
        # Detectar patrones emergentes
        emergent_patterns = self._detect_emergent_patterns(clusters, requirements)
        
        # Calcular métricas
        silhouette_score = self._calculate_silhouette_score(embeddings, labels)
        calinski_score = self._calculate_calinski_score(embeddings, labels)
        
        # Compilar reporte
        report = ClusteringReport(
            total_requirements=len(requirements),
            total_clusters=len(clusters),
            noise_count=sum(1 for c in clusters if c.cluster_type == ClusterType.ANOMALY),
            clusters=clusters,
            emergent_patterns=emergent_patterns,
            silhouette_score=silhouette_score,
            calinski_score=calinski_score,
            summary=self._generate_summary(clusters, emergent_patterns)
        )
        
        self.logger.info(f"Clustering complete: {len(clusters)} clusters found")
        return report
    
    def analyze_cluster_characteristics(
        self,
        cluster: Cluster,
        requirements: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Analiza características de un cluster
        
        Args:
            cluster: Cluster a analizar
            requirements: Lista completa de requisitos
        
        Returns:
            Análisis detallado del cluster
        """
        cluster_reqs = [r for r in requirements if r['id'] in cluster.requirement_ids]
        
        analysis = {
            "cluster_id": cluster.cluster_id,
            "cluster_type": cluster.cluster_type.value,
            "size": len(cluster_reqs),
            "cohesion": cluster.cohesion,
            "isolation": cluster.isolation,
            "stability": cluster.stability,
            
            # Características de requisitos
            "avg_length": np.mean([len(r.get('description', '').split()) for r in cluster_reqs]),
            "common_keywords": self._extract_common_keywords(cluster_reqs),
            "priority_distribution": self._analyze_priority_distribution(cluster_reqs),
            
            # Relaciones internas
            "internal_connectivity": self._calculate_internal_connectivity(cluster_reqs),
            "external_connectivity": self._calculate_external_connectivity(cluster, cluster_reqs, requirements),
            
            # Recomendaciones
            "recommendations": self._generate_cluster_recommendations(cluster, cluster_reqs)
        }
        
        return analysis
    
    def suggest_consolidations(
        self,
        clusters: List[Cluster],
        requirements: List[Dict[str, Any]],
        similarity_threshold: float = 0.85
    ) -> List[Dict[str, Any]]:
        """
        Sugiere consolidaciones de clusters similares
        
        Args:
            clusters: Lista de clusters
            requirements: Lista de requisitos
            similarity_threshold: Umbral para considerar clusters similares
        
        Returns:
            Lista de sugerencias de consolidación
        """
        suggestions = []
        
        for i, cluster1 in enumerate(clusters):
            for cluster2 in clusters[i+1:]:
                if cluster1.cluster_type != cluster2.cluster_type:
                    continue
                
                # Calcular similitud entre cluster centers
                if cluster1.cluster_center is not None and cluster2.cluster_center is not None:
                    similarity = self._cosine_similarity(
                        cluster1.cluster_center,
                        cluster2.cluster_center
                    )
                    
                    if similarity > similarity_threshold:
                        suggestions.append({
                            "cluster_ids": [cluster1.cluster_id, cluster2.cluster_id],
                            "similarity": similarity,
                            "consolidated_size": len(cluster1.requirement_ids) + len(cluster2.requirement_ids),
                            "reason": f"High similarity ({similarity:.2f}) between {cluster1.cluster_type.value} clusters",
                            "impact": "Reduces fragmentation, improves maintainability"
                        })
        
        return sorted(suggestions, key=lambda x: x['similarity'], reverse=True)
    
    # =========================================================================
    # PRIVATE METHODS
    # =========================================================================
    
    def _hdbscan_clustering(
        self,
        embeddings: np.ndarray,
        min_cluster_size: int
    ) -> Tuple[np.ndarray, np.ndarray]:
        """HDBSCAN clustering"""
        try:
            clusterer = hdbscan.HDBSCAN(
                min_cluster_size=min_cluster_size,
                metric='euclidean',
                cluster_selection_epsilon=0.0
            )
            labels = clusterer.fit_predict(embeddings)
            probabilities = clusterer.probabilities_
            
            self.logger.info(f"HDBSCAN: {len(np.unique(labels))} clusters found")
            return labels, probabilities
        
        except Exception as e:
            self.logger.error(f"HDBSCAN failed: {e}, using fallback")
            return self._fallback_clustering(embeddings, min_cluster_size)
    
    def _fallback_clustering(
        self,
        embeddings: np.ndarray,
        min_cluster_size: int
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Fallback clustering usando simple similarity"""
        n_samples = len(embeddings)
        labels = np.arange(n_samples)  # Cada punto es su propio cluster inicialmente
        probabilities = np.ones(n_samples)
        
        # Calcular similitud pairwise
        similarity_matrix = self._pairwise_similarity(embeddings)
        
        # Agrupar puntos muy similares (cosine > 0.85)
        current_label = 0
        for i in range(n_samples):
            if labels[i] != i:
                continue  # Ya asignado
            
            labels[i] = current_label
            similar_indices = np.where(similarity_matrix[i] > 0.85)[0]
            
            for j in similar_indices:
                if j != i and labels[j] == j:
                    labels[j] = current_label
            
            current_label += 1
        
        self.logger.info(f"Fallback clustering: {len(np.unique(labels))} clusters found")
        return labels, probabilities
    
    def _build_clusters(
        self,
        requirements: List[Dict[str, Any]],
        labels: np.ndarray,
        probabilities: np.ndarray,
        embeddings: np.ndarray
    ) -> List[Cluster]:
        """Construye objetos Cluster a partir de labels"""
        clusters = []
        unique_labels = np.unique(labels)
        
        for label in unique_labels:
            mask = labels == label
            requirement_ids = [requirements[i]['id'] for i in range(len(requirements)) if mask[i]]
            
            # Calcular métricas del cluster
            cluster_embeddings = embeddings[mask]
            center = np.mean(cluster_embeddings, axis=0) if len(cluster_embeddings) > 0 else None
            
            cohesion = self._calculate_cohesion(cluster_embeddings, center)
            isolation = self._calculate_isolation(cluster_embeddings, embeddings[~mask])
            stability = np.mean(probabilities[mask]) if len(probabilities[mask]) > 0 else 0.0
            
            # Determinar tipo de cluster
            cluster_type = self._determine_cluster_type(
                requirement_ids,
                requirements,
                label,
                cohesion
            )
            
            cluster = Cluster(
                cluster_id=int(label),
                cluster_type=cluster_type,
                requirement_ids=requirement_ids,
                cluster_center=center,
                cohesion=cohesion,
                isolation=isolation,
                stability=stability,
                metadata={"size": len(requirement_ids)}
            )
            
            clusters.append(cluster)
        
        return clusters
    
    def _determine_cluster_type(
        self,
        requirement_ids: List[str],
        requirements: List[Dict[str, Any]],
        label: int,
        cohesion: float
    ) -> ClusterType:
        """Determina el tipo de cluster"""
        # Si es ruido (muy pequeño o baja cohesión)
        if label == -1 or len(requirement_ids) == 1 or cohesion < 0.2:
            return ClusterType.ANOMALY
        
        # Si es muy cohesivo, probablemente functional
        if cohesion > 0.8:
            return ClusterType.FUNCTIONAL
        
        # Si es mediano, probablemente domain
        if len(requirement_ids) >= 3 and len(requirement_ids) <= 10:
            return ClusterType.DOMAIN
        
        # Si es grande, probablemente dependency
        if len(requirement_ids) > 10:
            return ClusterType.DEPENDENCY
        
        return ClusterType.EMERGING
    
    def _detect_emergent_patterns(
        self,
        clusters: List[Cluster],
        requirements: List[Dict[str, Any]]
    ) -> List[EmergentPattern]:
        """Detecta patrones emergentes en los clusters"""
        patterns = []
        
        # Patrón 1: Muchos clusters pequeños (fragmentación)
        small_clusters = [c for c in clusters if len(c.requirement_ids) <= 2]
        if len(small_clusters) > len(clusters) * 0.3:
            patterns.append(EmergentPattern(
                pattern_id="fragmentation_high",
                pattern_type="clustering_shift",
                description=f"High fragmentation: {len(small_clusters)} clusters have ≤2 requirements",
                affected_clusters=[c.cluster_id for c in small_clusters],
                confidence=min(1.0, len(small_clusters) / max(1, len(clusters))),
                recommendations=[
                    "Consider merging small clusters",
                    "Review requirement specifications",
                    "Consolidate related requirements"
                ]
            ))
        
        # Patrón 2: Cluster muy grande (potential monolith)
        large_clusters = [c for c in clusters if len(c.requirement_ids) > len(requirements) * 0.2]
        if large_clusters:
            patterns.append(EmergentPattern(
                pattern_id="monolithic_cluster",
                pattern_type="clustering_shift",
                description=f"Large cluster detected: {large_clusters[0].requirement_id} has {len(large_clusters[0].requirement_ids)} requirements",
                affected_clusters=[c.cluster_id for c in large_clusters],
                confidence=0.8,
                recommendations=[
                    "Consider decomposing large cluster",
                    "May indicate architectural smell",
                    "Review layer separation"
                ]
            ))
        
        # Patrón 3: Clusters de ruido
        noise_clusters = [c for c in clusters if c.cluster_type == ClusterType.ANOMALY]
        if len(noise_clusters) > len(clusters) * 0.1:
            patterns.append(EmergentPattern(
                pattern_id="anomaly_increase",
                pattern_type="anomaly_increase",
                description=f"Anomalous requirements detected: {len(noise_clusters)} noise points",
                affected_clusters=[c.cluster_id for c in noise_clusters],
                confidence=0.7,
                recommendations=[
                    "Review anomalous requirements",
                    "May indicate specification errors",
                    "Check for outlier patterns"
                ]
            ))
        
        return patterns
    
    def _generate_embeddings(self, requirements: List[Dict[str, Any]]) -> np.ndarray:
        """Genera embeddings simples basados en términos"""
        descriptions = [r.get('description', '') for r in requirements]
        
        # Crear vocabulario simple
        all_words = set()
        for desc in descriptions:
            all_words.update(desc.lower().split())
        
        word_to_idx = {word: idx for idx, word in enumerate(sorted(all_words))}
        
        # Crear matriz TF
        embeddings = np.zeros((len(descriptions), len(word_to_idx)))
        
        for i, desc in enumerate(descriptions):
            words = desc.lower().split()
            for word in words:
                if word in word_to_idx:
                    embeddings[i, word_to_idx[word]] += 1
        
        # Normalizar
        if self.sklearn_available:
            embeddings = normalize(embeddings, norm='l2')
        else:
            norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
            embeddings = embeddings / (norms + 1e-10)
        
        return embeddings
    
    def _calculate_cohesion(self, cluster_embeddings: np.ndarray, center: Optional[np.ndarray]) -> float:
        """Calcula cohesión interna del cluster"""
        if len(cluster_embeddings) <= 1 or center is None:
            return 1.0
        
        distances = [self._cosine_distance(emb, center) for emb in cluster_embeddings]
        cohesion = 1.0 - np.mean(distances)
        return float(np.clip(cohesion, 0.0, 1.0))
    
    def _calculate_isolation(self, cluster_embeddings: np.ndarray, other_embeddings: np.ndarray) -> float:
        """Calcula aislamiento respecto a otros clusters"""
        if len(other_embeddings) == 0:
            return 1.0
        
        cluster_center = np.mean(cluster_embeddings, axis=0)
        other_center = np.mean(other_embeddings, axis=0)
        
        isolation = self._cosine_distance(cluster_center, other_center)
        return float(np.clip(isolation, 0.0, 1.0))
    
    def _pairwise_similarity(self, embeddings: np.ndarray) -> np.ndarray:
        """Calcula matriz de similitud pairwise"""
        norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
        normalized = embeddings / (norms + 1e-10)
        similarity = np.dot(normalized, normalized.T)
        return np.clip(similarity, -1.0, 1.0)
    
    def _cosine_similarity(self, a: np.ndarray, b: np.ndarray) -> float:
        """Calcula similitud coseno entre dos vectores"""
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        
        if norm_a == 0 or norm_b == 0:
            return 0.0
        
        return float(np.dot(a, b) / (norm_a * norm_b))
    
    def _cosine_distance(self, a: np.ndarray, b: np.ndarray) -> float:
        """Calcula distancia coseno (1 - similitud)"""
        return 1.0 - self._cosine_similarity(a, b)
    
    def _calculate_silhouette_score(self, embeddings: np.ndarray, labels: np.ndarray) -> Optional[float]:
        """Calcula Silhouette score"""
        try:
            if SKLEARN_AVAILABLE:
                from sklearn.metrics import silhouette_score
                score = silhouette_score(embeddings, labels)
                return float(score)
        except Exception as e:
            self.logger.debug(f"Silhouette score calculation failed: {e}")
        
        return None
    
    def _calculate_calinski_score(self, embeddings: np.ndarray, labels: np.ndarray) -> Optional[float]:
        """Calcula Calinski-Harabasz score"""
        try:
            if SKLEARN_AVAILABLE:
                from sklearn.metrics import calinski_harabasz_score
                score = calinski_harabasz_score(embeddings, labels)
                return float(score)
        except Exception as e:
            self.logger.debug(f"Calinski-Harabasz score calculation failed: {e}")
        
        return None
    
    def _extract_common_keywords(self, requirements: List[Dict[str, Any]]) -> List[str]:
        """Extrae palabras clave comunes en un cluster"""
        if not requirements:
            return []
        
        all_words = set()
        for req in requirements:
            words = req.get('description', '').lower().split()
            if not all_words:
                all_words = set(words)
            else:
                all_words &= set(words)
        
        return sorted(list(all_words))[:5]  # Top 5
    
    def _analyze_priority_distribution(self, requirements: List[Dict[str, Any]]) -> Dict[str, int]:
        """Analiza distribución de prioridades en un cluster"""
        distribution = {}
        for req in requirements:
            priority = req.get('priority', 'unknown')
            distribution[priority] = distribution.get(priority, 0) + 1
        
        return distribution
    
    def _calculate_internal_connectivity(self, requirements: List[Dict[str, Any]]) -> float:
        """Calcula conectividad interna (qué tan ligados están los requisitos)"""
        if len(requirements) <= 1:
            return 1.0
        
        # Contar menciones mutuas
        total_mentions = 0
        for req1 in requirements:
            for req2 in requirements:
                if req1['id'] != req2['id']:
                    desc1 = req1.get('description', '').lower()
                    desc2_id = req2['id'].lower()
                    if desc2_id in desc1:
                        total_mentions += 1
        
        max_possible = len(requirements) * (len(requirements) - 1)
        return float(total_mentions / max_possible) if max_possible > 0 else 0.0
    
    def _calculate_external_connectivity(
        self,
        cluster: Cluster,
        cluster_reqs: List[Dict[str, Any]],
        all_reqs: List[Dict[str, Any]]
    ) -> float:
        """Calcula conectividad externa (dependencias hacia otros clusters)"""
        external_links = 0
        total_reqs = len(cluster_reqs)
        
        for req in cluster_reqs:
            desc = req.get('description', '').lower()
            for other_req in all_reqs:
                if other_req['id'] not in cluster.requirement_ids:
                    if other_req['id'].lower() in desc:
                        external_links += 1
        
        return float(external_links / max(1, total_reqs * len(all_reqs)))
    
    def _generate_cluster_recommendations(
        self,
        cluster: Cluster,
        requirements: List[Dict[str, Any]]
    ) -> List[str]:
        """Genera recomendaciones para un cluster"""
        recommendations = []
        
        if len(requirements) == 1:
            recommendations.append("Cluster con un solo requisito - considere relaciones con otros")
        
        if cluster.cohesion < 0.5:
            recommendations.append("Cluster poco cohesivo - requisitos may estar débilmente relacionados")
        
        if cluster.isolation < 0.3:
            recommendations.append("Cluster muy cercano a otros - considere consolidación")
        
        if len(requirements) > 10:
            recommendations.append("Cluster muy grande - considere decomposición")
        
        return recommendations
    
    def _generate_summary(
        self,
        clusters: List[Cluster],
        patterns: List[EmergentPattern]
    ) -> Dict[str, Any]:
        """Genera resumen del análisis de clustering"""
        cluster_types = {}
        for cluster in clusters:
            cluster_types[cluster.cluster_type.value] = cluster_types.get(cluster.cluster_type.value, 0) + 1
        
        return {
            "status": "complete",
            "cluster_distribution": cluster_types,
            "avg_cluster_size": np.mean([len(c.requirement_ids) for c in clusters]) if clusters else 0,
            "avg_cohesion": np.mean([c.cohesion for c in clusters]) if clusters else 0,
            "avg_isolation": np.mean([c.isolation for c in clusters]) if clusters else 0,
            "emergent_patterns_found": len(patterns),
            "quality": self._assess_clustering_quality(clusters, patterns)
        }
    
    def _assess_clustering_quality(
        self,
        clusters: List[Cluster],
        patterns: List[EmergentPattern]
    ) -> str:
        """Evalúa la calidad general del clustering"""
        avg_cohesion = np.mean([c.cohesion for c in clusters]) if clusters else 0
        
        if avg_cohesion > 0.7:
            return "excellent"
        elif avg_cohesion > 0.5:
            return "good"
        elif avg_cohesion > 0.3:
            return "fair"
        else:
            return "poor"
