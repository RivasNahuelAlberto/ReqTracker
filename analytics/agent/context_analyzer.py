"""
ETAPA 9.4: Context Pollution Detection
Detecta chunks irrelevantes que degradan el razonamiento del agente
"""

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime

logger = logging.getLogger(__name__)

class ContextAnalyzer:
    """Detecta y analiza contaminación de contexto"""
    
    def detect_context_pollution(self, 
                                query: str,
                                context_chunks: Optional[List[Dict]] = None,
                                project_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Detecta chunks irrelevantes en el contexto:
        - irrelevant_chunks: chunks que no aportan
        - pollution_ratio: % de contexto inútil
        - confidence: qué tan seguro es el análisis
        - recommendation: qué hacer
        
        Args:
            query: Query/pregunta del usuario
            context_chunks: Chunks recuperados como contexto
            project_id: ID del proyecto
        
        Returns:
            {
                "pollution_detected": bool,
                "pollution_ratio": 0-1,
                "irrelevant_chunks": [...],
                "relevant_chunks": [...],
                "confidence": 0-1,
                "recommendations": [...],
                "analysis": {...}
            }
        """
        try:
            context_chunks = context_chunks or self._get_mock_context_chunks()
            
            if not context_chunks:
                return {
                    "pollution_detected": False,
                    "pollution_ratio": 0.0,
                    "irrelevant_chunks": [],
                    "relevant_chunks": [],
                    "confidence": 1.0,
                    "recommendations": ["No context chunks to analyze"]
                }
            
            # Calcular relevancia de cada chunk
            chunk_analysis = self._analyze_chunk_relevance(query, context_chunks)
            
            # Separar chunks relevantes e irrelevantes
            irrelevant_chunks = [c for c in chunk_analysis if c.get("relevance_score", 0) < 0.5]
            relevant_chunks = [c for c in chunk_analysis if c.get("relevance_score", 0) >= 0.5]
            
            # Calcular ratio de contaminación
            pollution_ratio = len(irrelevant_chunks) / len(chunk_analysis) if chunk_analysis else 0
            
            # Detectar si hay contaminación significativa
            pollution_detected = pollution_ratio > 0.3  # > 30% es contaminación
            
            # Calcular confianza del análisis
            confidence = self._calculate_analysis_confidence(chunk_analysis)
            
            # Generar recomendaciones
            recommendations = self._generate_recommendations(
                pollution_detected, 
                pollution_ratio, 
                irrelevant_chunks,
                relevant_chunks
            )
            
            # Análisis detallado
            analysis = self._detailed_analysis(chunk_analysis, query)
            
            return {
                "pollution_detected": pollution_detected,
                "pollution_ratio": round(pollution_ratio, 3),
                "irrelevant_chunks": irrelevant_chunks[:5],  # Top 5
                "relevant_chunks": relevant_chunks,
                "confidence": round(confidence, 3),
                "recommendations": recommendations,
                "analysis": analysis,
                "project_id": project_id,
                "timestamp": datetime.utcnow().isoformat()
            }
        
        except Exception as e:
            logger.error(f"Error detecting context pollution: {str(e)}")
            return {
                "error": str(e),
                "pollution_detected": False,
                "pollution_ratio": 0.0
            }
    
    def _analyze_chunk_relevance(self, query: str, chunks: List[Dict]) -> List[Dict]:
        """Analiza relevancia de cada chunk respecto a la query"""
        
        analyzed = []
        query_tokens = set(query.lower().split())
        
        for chunk in chunks:
            chunk_text = chunk.get("content", "").lower()
            chunk_tokens = set(chunk_text.split())
            
            # Métrica 1: Overlap de tokens
            overlap = len(query_tokens & chunk_tokens) / len(query_tokens) if query_tokens else 0
            
            # Métrica 2: Similitud semántica (mock)
            semantic_sim = chunk.get("relevance_score", 0.5)
            
            # Métrica 3: Rastreabilidad (chunk tiene ID claro)
            is_traceable = 1.0 if chunk.get("id") and chunk.get("source") else 0.5
            
            # Métrica 4: Tamaño apropiado (no demasiado corto ni largo)
            chunk_length = len(chunk_text.split())
            size_score = 1.0 if 50 <= chunk_length <= 1000 else 0.6
            
            # Combinar
            relevance_score = (
                overlap * 0.35 +
                semantic_sim * 0.35 +
                is_traceable * 0.15 +
                size_score * 0.15
            )
            
            # Detectar razones de irrelevancia
            irrelevance_reasons = []
            if overlap < 0.1:
                irrelevance_reasons.append("No token overlap with query")
            if semantic_sim < 0.3:
                irrelevance_reasons.append("Low semantic similarity")
            if chunk_length < 20:
                irrelevance_reasons.append("Chunk too short")
            if chunk_length > 2000:
                irrelevance_reasons.append("Chunk too long (may be noisy)")
            
            analyzed.append({
                "chunk_id": chunk.get("id"),
                "content": chunk.get("content", "")[:100] + "...",  # Truncate
                "source": chunk.get("source"),
                "relevance_score": min(1.0, relevance_score),
                "token_overlap": round(overlap, 3),
                "semantic_similarity": semantic_sim,
                "size": chunk_length,
                "is_traceable": bool(chunk.get("id") and chunk.get("source")),
                "irrelevance_reasons": irrelevance_reasons,
                "noise_level": round(1 - min(1.0, relevance_score), 3)
            })
        
        # Ordenar por relevancia descendente
        return sorted(analyzed, key=lambda x: x["relevance_score"], reverse=True)
    
    def _calculate_analysis_confidence(self, chunk_analysis: List[Dict]) -> float:
        """
        Calcula confianza del análisis:
        - Más chunks = más confianza
        - Chunks bien identificados = más confianza
        - Resultados consistentes = más confianza
        """
        
        if not chunk_analysis:
            return 0.0
        
        # Factor 1: Número de chunks
        num_chunks = len(chunk_analysis)
        chunk_confidence = min(1.0, num_chunks / 10)  # 10+ chunks = máxima confianza
        
        # Factor 2: Trazabilidad
        traceable_chunks = sum(1 for c in chunk_analysis if c.get("is_traceable", False))
        traceability_confidence = traceable_chunks / num_chunks if num_chunks > 0 else 0
        
        # Factor 3: Variación en relevancia
        relevance_scores = [c.get("relevance_score", 0) for c in chunk_analysis]
        if len(relevance_scores) > 1:
            avg_relevance = sum(relevance_scores) / len(relevance_scores)
            consistency = 1 - (max(relevance_scores) - min(relevance_scores))  # Menos variación = más consistente
        else:
            consistency = 0.5
        
        confidence = (
            chunk_confidence * 0.4 +
            traceability_confidence * 0.35 +
            consistency * 0.25
        )
        
        return min(1.0, confidence)
    
    def _generate_recommendations(self, 
                                 pollution_detected: bool,
                                 pollution_ratio: float,
                                 irrelevant: List[Dict],
                                 relevant: List[Dict]) -> List[str]:
        """Genera recomendaciones basadas en análisis"""
        recommendations = []
        
        if pollution_detected:
            if pollution_ratio > 0.6:
                recommendations.append(f"🚨 SEVERE: {pollution_ratio*100:.0f}% of context is irrelevant. Recommend REFACTOR retrieval strategy completely.")
            elif pollution_ratio > 0.4:
                recommendations.append(f"⚠️  HIGH: {pollution_ratio*100:.0f}% irrelevant chunks. Recommend REMOVE_CHUNKS to improve reasoning.")
            else:
                recommendations.append(f"🟡 MODERATE: {pollution_ratio*100:.0f}% irrelevant content. Consider optimizing chunk selection.")
            
            # Razones comunes
            if irrelevant:
                reasons = set()
                for chunk in irrelevant[:3]:
                    for reason in chunk.get("irrelevance_reasons", []):
                        reasons.add(reason)
                
                if reasons:
                    recommendations.append(f"Common issues: {', '.join(list(reasons)[:2])}")
        else:
            recommendations.append("✅ Context quality is good. No significant pollution detected.")
        
        # Recomendaciones sobre cantidad
        if len(relevant) > 15:
            recommendations.append("💡 Consider reducing context size for faster processing.")
        if len(relevant) < 3:
            recommendations.append("💡 Very few relevant chunks. May need to expand search or improve query.")
        
        return recommendations
    
    def _detailed_analysis(self, chunk_analysis: List[Dict], query: str) -> Dict:
        """Análisis detallado de la contaminación"""
        
        # Agrupar por razones de irrelevancia
        irrelevance_by_reason = {}
        for chunk in chunk_analysis:
            for reason in chunk.get("irrelevance_reasons", []):
                if reason not in irrelevance_by_reason:
                    irrelevance_by_reason[reason] = 0
                irrelevance_by_reason[reason] += 1
        
        # Estadísticas
        relevance_scores = [c.get("relevance_score", 0) for c in chunk_analysis]
        
        return {
            "total_chunks_analyzed": len(chunk_analysis),
            "avg_relevance_score": round(sum(relevance_scores) / len(relevance_scores), 3) if relevance_scores else 0,
            "max_relevance": round(max(relevance_scores), 3) if relevance_scores else 0,
            "min_relevance": round(min(relevance_scores), 3) if relevance_scores else 0,
            "irrelevance_reasons": irrelevance_by_reason,
            "query_tokens": len(query.split()),
            "avg_chunk_size": sum(c.get("size", 0) for c in chunk_analysis) // len(chunk_analysis) if chunk_analysis else 0
        }
    
    def _get_mock_context_chunks(self) -> List[Dict]:
        """Retorna chunks mock para demostración"""
        return [
            {
                "id": "chunk_1",
                "content": "The system must authenticate users with multi-factor authentication. Authentication should be implemented with TOTP or hardware keys. Session tokens should expire after 1 hour of inactivity.",
                "source": "requirements_db",
                "relevance_score": 0.92
            },
            {
                "id": "chunk_2",
                "content": "The API should support pagination with page size up to 1000 records. Implement rate limiting with 100 requests per minute per user.",
                "source": "requirements_db",
                "relevance_score": 0.85
            },
            {
                "id": "chunk_3",
                "content": "The interface should be responsive and work on mobile devices. The color scheme should follow WCAG AA standards for accessibility.",
                "source": "design_db",
                "relevance_score": 0.45
            },
            {
                "id": "chunk_4",
                "content": "Coffee is a beverage made by roasting and grinding coffee beans. It contains caffeine which is a stimulant.",
                "source": "wikipedia",
                "relevance_score": 0.05
            },
            {
                "id": "chunk_5",
                "content": "The database should use indexes on frequently queried columns. Query performance should be optimized with connection pooling.",
                "source": "infrastructure_db",
                "relevance_score": 0.78
            },
            {
                "id": "chunk_6",
                "content": "Lorem ipsum dolor sit amet consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                "source": "noise_source",
                "relevance_score": 0.01
            },
            {
                "id": "chunk_7",
                "content": "Error handling should implement exponential backoff for transient failures. Log all errors with timestamps and stack traces for debugging.",
                "source": "requirements_db",
                "relevance_score": 0.82
            }
        ]

def get_context_analyzer():
    """Factory para obtener analyzer singleton"""
    return ContextAnalyzer()
