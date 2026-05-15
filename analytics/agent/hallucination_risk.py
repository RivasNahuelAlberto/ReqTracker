"""
ETAPA 9.5: Hallucination Risk Estimation
Estima el riesgo de alucinaciones en las respuestas del agente
"""

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime

logger = logging.getLogger(__name__)

class HallucinationRiskEstimator:
    """Estima riesgo de alucinaciones en el razonamiento del agente"""
    
    def estimate_hallucination_risk(self,
                                   prompt: str,
                                   context: Optional[List[Dict]] = None,
                                   retrieval_results: Optional[List[Dict]] = None,
                                   project_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Estima riesgo de alucinaciones considerando múltiples factores:
        - risk_score: 0-1, probabilidad de alucinación
        - coverage: % de cobertura de la pregunta
        - context_quality: 0-1, calidad del contexto
        - semantic_confidence: 0-1, confianza semántica
        - retrieval_quality: 0-1, calidad de retrieval
        - recommendation: "safe" | "caution" | "risky"
        
        Args:
            prompt: Pregunta/prompt del usuario
            context: Chunks de contexto recuperados
            retrieval_results: Resultados de búsqueda
            project_id: ID del proyecto
        
        Returns:
            {
                "risk_score": 0-1,
                "risk_level": "safe" | "caution" | "risky",
                "factors": {...},
                "recommendations": [...],
                "mitigation_strategies": [...]
            }
        """
        try:
            context = context or self._get_mock_context()
            retrieval_results = retrieval_results or self._get_mock_retrieval()
            
            # Calcular componentes
            coverage = self._calculate_coverage(prompt, context)
            context_quality = self._calculate_context_quality(context)
            semantic_confidence = self._calculate_semantic_confidence(prompt, context)
            retrieval_quality = self._calculate_retrieval_quality(retrieval_results)
            
            # Calcular riesgo de alucinación
            hallucination_risk = self._calculate_hallucination_risk(
                coverage,
                context_quality,
                semantic_confidence,
                retrieval_quality,
                prompt
            )
            
            # Determinar nivel
            risk_level = self._determine_risk_level(hallucination_risk)
            
            # Generar recomendaciones
            recommendations = self._generate_recommendations(
                hallucination_risk,
                risk_level,
                coverage,
                context_quality
            )
            
            # Estrategias de mitigación
            mitigation_strategies = self._generate_mitigation_strategies(risk_level)
            
            factors = {
                "coverage": round(coverage, 3),
                "context_quality": round(context_quality, 3),
                "semantic_confidence": round(semantic_confidence, 3),
                "retrieval_quality": round(retrieval_quality, 3),
                "prompt_ambiguity": self._calculate_prompt_ambiguity(prompt)
            }
            
            return {
                "risk_score": round(hallucination_risk, 3),
                "risk_level": risk_level,
                "factors": factors,
                "recommendations": recommendations,
                "mitigation_strategies": mitigation_strategies,
                "project_id": project_id,
                "timestamp": datetime.utcnow().isoformat()
            }
        
        except Exception as e:
            logger.error(f"Error estimating hallucination risk: {str(e)}")
            return {
                "error": str(e),
                "risk_score": 0.5,
                "risk_level": "caution"
            }
    
    def _calculate_coverage(self, prompt: str, context: List[Dict]) -> float:
        """
        Calcula qué porcentaje de la pregunta está cubierto por el contexto
        - Alta cobertura = menos riesgo de alucinación
        """
        
        prompt_tokens = set(prompt.lower().split())
        context_text = " ".join([c.get("content", "") for c in context])
        context_tokens = set(context_text.lower().split())
        
        # Overlap de palabras
        covered_tokens = prompt_tokens & context_tokens
        coverage = len(covered_tokens) / len(prompt_tokens) if prompt_tokens else 0
        
        # Bonus si hay context chunks específicos para la pregunta
        has_direct_match = any(
            c.get("relevance_score", 0) > 0.7 
            for c in context 
        )
        
        if has_direct_match:
            coverage = min(1.0, coverage + 0.1)
        
        return coverage
    
    def _calculate_context_quality(self, context: List[Dict]) -> float:
        """
        Calcula calidad del contexto disponible:
        - Claridad de información
        - Coherencia entre chunks
        - Trazabilidad (source conocida)
        """
        
        if not context:
            return 0.0
        
        quality_scores = []
        
        for chunk in context:
            # Factor 1: Relevancia
            relevance = chunk.get("relevance_score", 0.5)
            
            # Factor 2: Trazabilidad
            has_source = 1.0 if chunk.get("source") else 0.5
            has_id = 1.0 if chunk.get("id") else 0.5
            traceability = (has_source + has_id) / 2
            
            # Factor 3: Claridad (texto bien formado)
            text = chunk.get("content", "")
            length = len(text.split())
            clarity = 1.0 if 20 <= length <= 500 else 0.6
            
            chunk_quality = (
                relevance * 0.5 +
                traceability * 0.3 +
                clarity * 0.2
            )
            quality_scores.append(chunk_quality)
        
        # Promedio de calidad
        avg_quality = sum(quality_scores) / len(quality_scores) if quality_scores else 0
        
        # Penalidad si hay demasiada dispersión (inconsistencia)
        if len(quality_scores) > 1:
            max_q = max(quality_scores)
            min_q = min(quality_scores)
            dispersion = max_q - min_q
            consistency_penalty = dispersion * 0.2
            avg_quality = max(0, avg_quality - consistency_penalty)
        
        return min(1.0, avg_quality)
    
    def _calculate_semantic_confidence(self, prompt: str, context: List[Dict]) -> float:
        """
        Calcula confianza semántica: qué tan bien semánticamente
        relacionados están prompt y contexto
        """
        
        if not context:
            return 0.0
        
        # Usar relevance scores como proxy de similitud semántica
        relevance_scores = [
            c.get("relevance_score", 0.5) 
            for c in context
        ]
        
        # Promedio de relevancia
        avg_relevance = sum(relevance_scores) / len(relevance_scores) if relevance_scores else 0
        
        # Máximas relevancia (si hay un match muy bueno)
        max_relevance = max(relevance_scores) if relevance_scores else 0
        
        # Confianza: promedio pesado + bonus si hay match alto
        confidence = avg_relevance * 0.6 + max_relevance * 0.4
        
        return min(1.0, confidence)
    
    def _calculate_retrieval_quality(self, retrieval_results: List[Dict]) -> float:
        """
        Calcula calidad del proceso de retrieval:
        - Número de resultados relevantes
        - Ranking quality
        - Cobertura de fuentes diversas
        """
        
        if not retrieval_results:
            return 0.0
        
        # Factor 1: Número de resultados
        num_results = len(retrieval_results)
        result_count_score = min(1.0, num_results / 5)  # 5+ resultados = óptimo
        
        # Factor 2: Ranking quality
        scores = [r.get("score", 0) for r in retrieval_results]
        if len(scores) > 1:
            # Penalizar si hay mucha caída entre primeros y últimos
            avg_score = sum(scores) / len(scores)
            ranking_quality = avg_score / (max(scores) + 0.001)  # Normalizar por máximo
        else:
            ranking_quality = max(scores) if scores else 0
        
        # Factor 3: Diversidad de fuentes
        sources = set(r.get("source", "unknown") for r in retrieval_results)
        diversity = min(1.0, len(sources) / 3)  # 3+ sources = buena diversidad
        
        quality = (
            result_count_score * 0.35 +
            ranking_quality * 0.35 +
            diversity * 0.3
        )
        
        return min(1.0, quality)
    
    def _calculate_prompt_ambiguity(self, prompt: str) -> float:
        """
        Calcula ambigüedad del prompt:
        - Preguntas vagas = más riesgo
        - Preguntas específicas = menos riesgo
        """
        
        # Factores que indican ambigüedad
        vague_words = [
            "maybe", "possibly", "somewhat", "kind of", "sort of",
            "roughly", "approximately", "whatsoever", "et cetera"
        ]
        
        prompt_lower = prompt.lower()
        vagueness = sum(1 for w in vague_words if w in prompt_lower)
        
        # Penalidad por falta de específicos
        question_marks = prompt.count("?")
        is_specific = 1.0 if question_marks == 1 else 0.8
        
        # Largo del prompt (más largo = normalmente más específico)
        length_score = min(1.0, len(prompt.split()) / 20)
        
        ambiguity = (
            min(1.0, vagueness * 0.2) * 0.4 +
            (1 - is_specific) * 0.4 +
            (1 - length_score) * 0.2
        )
        
        return min(1.0, ambiguity)
    
    def _calculate_hallucination_risk(self,
                                     coverage: float,
                                     context_quality: float,
                                     semantic_conf: float,
                                     retrieval_quality: float,
                                     prompt: str) -> float:
        """
        Calcula riesgo de alucinación combinando todos los factores
        
        La alucinación ocurre cuando falta contexto o contexto de baja calidad
        """
        
        # Factores de riesgo (mayor = más riesgo)
        # Bajon en coverage
        coverage_risk = 1 - coverage
        
        # Contexto pobre
        context_risk = 1 - context_quality
        
        # Baja confianza semántica
        semantic_risk = 1 - semantic_conf
        
        # Retrieval pobre
        retrieval_risk = 1 - retrieval_quality
        
        # Ambigüedad del prompt
        ambiguity = self._calculate_prompt_ambiguity(prompt)
        
        # Combinar riesgos (con pesos)
        hallucination_risk = (
            coverage_risk * 0.25 +
            context_risk * 0.25 +
            semantic_risk * 0.2 +
            retrieval_risk * 0.2 +
            ambiguity * 0.1
        )
        
        return min(1.0, hallucination_risk)
    
    def _determine_risk_level(self, risk_score: float) -> str:
        """Determina nivel de riesgo basado en score"""
        if risk_score < 0.3:
            return "safe"
        elif risk_score < 0.6:
            return "caution"
        else:
            return "risky"
    
    def _generate_recommendations(self, 
                                 risk_score: float,
                                 risk_level: str,
                                 coverage: float,
                                 context_quality: float) -> List[str]:
        """Genera recomendaciones basadas en riesgos"""
        recommendations = []
        
        if risk_level == "safe":
            recommendations.append("✅ Low hallucination risk. Safe to proceed with this response.")
        elif risk_level == "caution":
            recommendations.append("⚠️  Moderate risk. Verify key facts before using response.")
        else:
            recommendations.append("🚨 High hallucination risk. DO NOT use response without verification.")
        
        if coverage < 0.5:
            recommendations.append(f"Coverage is low ({coverage*100:.0f}%). Important aspects of query may be missing.")
        
        if context_quality < 0.5:
            recommendations.append("Context quality is poor. Consider retrieving additional or higher-quality sources.")
        
        return recommendations
    
    def _generate_mitigation_strategies(self, risk_level: str) -> List[str]:
        """Genera estrategias de mitigación según nivel de riesgo"""
        strategies = []
        
        if risk_level == "safe":
            strategies.append("Continue with standard processing")
        elif risk_level == "caution":
            strategies.append("🔍 Retrieve additional context to confirm facts")
            strategies.append("📋 Add confidence scores to each claim")
            strategies.append("✔️  Cross-reference with multiple sources")
        else:
            strategies.append("❌ Request clarification from user")
            strategies.append("🔄 Refactor search strategy completely")
            strategies.append("📚 Expand context beyond current sources")
            strategies.append("⏸️  Hold response until high-quality context available")
        
        return strategies
    
    def _get_mock_context(self) -> List[Dict]:
        """Retorna contexto mock"""
        return [
            {
                "id": "ctx_1",
                "content": "The authentication system requires MFA with TOTP tokens or hardware keys. Sessions expire after 1 hour of inactivity or after 24 hours.",
                "source": "requirements_db",
                "relevance_score": 0.92
            },
            {
                "id": "ctx_2",
                "content": "Rate limiting is enforced at 100 requests per minute per user. Burst up to 150 requests is allowed for premium users.",
                "source": "api_docs",
                "relevance_score": 0.85
            },
            {
                "id": "ctx_3",
                "content": "Error handling should use exponential backoff with maximum retry of 3 times. Circuit breaker should trigger after 5 consecutive failures.",
                "source": "infrastructure",
                "relevance_score": 0.78
            }
        ]
    
    def _get_mock_retrieval(self) -> List[Dict]:
        """Retorna resultados de retrieval mock"""
        return [
            {"source": "requirements_db", "score": 0.95},
            {"source": "api_docs", "score": 0.88},
            {"source": "infrastructure", "score": 0.82}
        ]

def get_hallucination_risk_estimator():
    """Factory para obtener estimator singleton"""
    return HallucinationRiskEstimator()
