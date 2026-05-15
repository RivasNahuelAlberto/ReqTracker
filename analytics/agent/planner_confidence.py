"""
ETAPA 9.2: Planner Confidence Scoring
Puntúa la confianza del planificador del agente
"""

import logging
from typing import Dict, Optional, Any, List
from datetime import datetime

logger = logging.getLogger(__name__)

class PlannerConfidenceScorer:
    """Evalúa la confianza del planificador del agente"""
    
    def score_planner_confidence(self, 
                                plan_data: Optional[Dict] = None,
                                project_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Calcula puntuación de confianza del planificador:
        - confidence: 0-1, qué tan seguro está el plan
        - stability: 0-1, qué tan estable es el plan
        - predictability: 0-1, qué tan predecible es
        - reasoning_clarity: 0-1, qué tan clara es la lógica
        
        Args:
            plan_data: Datos del plan ejecutado
            project_id: ID del proyecto
        
        Returns:
            {
                "confidence": 0-1,
                "stability": 0-1,
                "predictability": 0-1,
                "reasoning_clarity": 0-1,
                "overall_score": 0-1,
                "factors": {...},
                "issues": [...],
                "recommendations": [...]
            }
        """
        try:
            plan_data = plan_data or self._get_mock_plan_data()
            
            # Calcular componentes de confianza
            confidence = self._calculate_confidence(plan_data)
            stability = self._calculate_stability(plan_data)
            predictability = self._calculate_predictability(plan_data)
            clarity = self._calculate_reasoning_clarity(plan_data)
            
            # Calcular score general
            overall_score = (
                confidence * 0.3 +
                stability * 0.25 +
                predictability * 0.25 +
                clarity * 0.2
            )
            
            # Análisis de factores
            factors = self._analyze_factors(plan_data)
            
            # Detectar problemas
            issues = self._detect_issues(plan_data, confidence, stability, predictability, clarity)
            
            # Generar recomendaciones
            recommendations = self._generate_recommendations(overall_score, issues)
            
            return {
                "confidence": round(confidence, 3),
                "stability": round(stability, 3),
                "predictability": round(predictability, 3),
                "reasoning_clarity": round(clarity, 3),
                "overall_score": round(overall_score, 3),
                "factors": factors,
                "issues": issues,
                "recommendations": recommendations,
                "project_id": project_id,
                "timestamp": datetime.utcnow().isoformat()
            }
        
        except Exception as e:
            logger.error(f"Error scoring planner confidence: {str(e)}")
            return {
                "error": str(e),
                "confidence": 0.0,
                "overall_score": 0.0
            }
    
    def _calculate_confidence(self, plan_data: Dict) -> float:
        """
        Calcula confianza del plan basado en:
        - Número de pasos bien definidos
        - Coherencia lógica
        - Cobertura de edge cases
        """
        
        steps = plan_data.get("steps", [])
        if not steps:
            return 0.0
        
        # Factor 1: Claridad de pasos (0-1)
        clarity_score = 0.0
        for step in steps:
            if step.get("description") and step.get("expected_outcome"):
                clarity_score += 1
        clarity_score = clarity_score / len(steps) if steps else 0
        
        # Factor 2: Cobertura de edge cases (0-1)
        edge_cases_covered = len(plan_data.get("edge_cases_handled", []))
        total_edge_cases = max(edge_cases_covered, plan_data.get("total_edge_cases", 1))
        edge_case_coverage = edge_cases_covered / total_edge_cases
        
        # Factor 3: Dependencias bien mapeadas (0-1)
        dependencies = plan_data.get("dependencies", [])
        well_mapped = sum(1 for d in dependencies if d.get("order") is not None)
        dependency_clarity = well_mapped / len(dependencies) if dependencies else 1.0
        
        # Combinar
        confidence = (
            clarity_score * 0.5 +
            min(1.0, edge_case_coverage) * 0.3 +
            min(1.0, dependency_clarity) * 0.2
        )
        
        return min(1.0, confidence)
    
    def _calculate_stability(self, plan_data: Dict) -> float:
        """
        Calcula estabilidad del plan:
        - Pocas ramificaciones
        - Pocas decisiones criticas
        - Buen error handling
        """
        
        # Factor 1: Número de puntos de decisión
        decision_points = plan_data.get("decision_points", [])
        decision_complexity = min(1.0, len(decision_points) / 5)  # Normalizar
        
        # Factor 2: Error handling
        error_handlers = plan_data.get("error_handlers", [])
        total_steps = len(plan_data.get("steps", []))
        error_handling_coverage = len(error_handlers) / max(total_steps, 1)
        
        # Factor 3: Rollback capabilities
        can_rollback = 1.0 if plan_data.get("can_rollback", False) else 0.5
        
        # Combinar (menos decisiones = más estable)
        stability = (
            max(0, 1 - decision_complexity) * 0.4 +
            min(1.0, error_handling_coverage) * 0.35 +
            can_rollback * 0.25
        )
        
        return min(1.0, stability)
    
    def _calculate_predictability(self, plan_data: Dict) -> float:
        """
        Calcula predictibilidad:
        - Comportamiento determinístico
        - Pocas variables aleatorias
        - Resultado esperado bien definido
        """
        
        # Factor 1: Determinismo
        is_deterministic = 1.0 if plan_data.get("is_deterministic", False) else 0.6
        
        # Factor 2: Random factors
        random_factors = plan_data.get("random_factors", 0)
        random_impact = max(0, 1 - (random_factors * 0.2))
        
        # Factor 3: Resultado bien definido
        has_clear_output = 1.0 if plan_data.get("expected_output_defined", False) else 0.7
        
        predictability = (
            is_deterministic * 0.4 +
            min(1.0, random_impact) * 0.35 +
            has_clear_output * 0.25
        )
        
        return min(1.0, predictability)
    
    def _calculate_reasoning_clarity(self, plan_data: Dict) -> float:
        """
        Calcula claridad del razonamiento:
        - Justificaciones claras
        - Pocos pasos implícitos
        - Lógica transparent
        """
        
        reasoning = plan_data.get("reasoning", "")
        justifications = plan_data.get("justifications", [])
        implicit_steps = plan_data.get("implicit_steps", 0)
        
        # Factor 1: Reasoning escrito
        reasoning_quality = min(1.0, len(reasoning) / 500)  # Más largo = mejor
        
        # Factor 2: Justificaciones por paso
        total_steps = len(plan_data.get("steps", []))
        justification_coverage = len(justifications) / max(total_steps, 1) if justifications else 0
        
        # Factor 3: Pasos explícitos
        explicit_score = max(0, 1 - (implicit_steps * 0.1))
        
        clarity = (
            reasoning_quality * 0.35 +
            min(1.0, justification_coverage) * 0.35 +
            explicit_score * 0.3
        )
        
        return min(1.0, clarity)
    
    def _analyze_factors(self, plan_data: Dict) -> Dict[str, Any]:
        """Análisis detallado de factores"""
        return {
            "total_steps": len(plan_data.get("steps", [])),
            "decision_points": len(plan_data.get("decision_points", [])),
            "edge_cases_handled": len(plan_data.get("edge_cases_handled", [])),
            "error_handlers": len(plan_data.get("error_handlers", [])),
            "can_rollback": plan_data.get("can_rollback", False),
            "is_deterministic": plan_data.get("is_deterministic", False),
            "random_factors": plan_data.get("random_factors", 0),
            "implicit_steps": plan_data.get("implicit_steps", 0)
        }
    
    def _detect_issues(self, plan_data: Dict, conf: float, stab: float, pred: float, clear: float) -> List[str]:
        """Detecta problemas potenciales"""
        issues = []
        
        # Confianza baja
        if conf < 0.5:
            issues.append(f"🔴 Low confidence score ({conf:.1%}). Plan may have gaps or unclear steps.")
        
        # Estabilidad baja
        if stab < 0.5:
            issues.append(f"🔴 Low stability ({stab:.1%}). Many decision points or poor error handling.")
        
        # Predictabilidad baja
        if pred < 0.5:
            issues.append(f"🟡 Low predictability ({pred:.1%}). Too many random factors or uncertain outcomes.")
        
        # Claridad baja
        if clear < 0.5:
            issues.append(f"🟡 Low reasoning clarity ({clear:.1%}). Consider providing more justifications.")
        
        # Demasiados decision points
        if len(plan_data.get("decision_points", [])) > 10:
            issues.append(f"🟠 Too many decision points ({len(plan_data.get('decision_points', []))}). Consider simplifying.")
        
        # No hay rollback
        if not plan_data.get("can_rollback", False) and len(plan_data.get("steps", [])) > 3:
            issues.append("⚠️  No rollback capability. Consider adding recovery steps.")
        
        return issues
    
    def _generate_recommendations(self, overall_score: float, issues: List[str]) -> List[str]:
        """Genera recomendaciones"""
        recommendations = []
        
        if overall_score >= 0.8:
            recommendations.append("✅ Plan is highly confident and well-structured. Ready for execution.")
        elif overall_score >= 0.6:
            recommendations.append("⚠️  Plan is acceptable but has some concerns. Review recommendations above.")
        else:
            recommendations.append("🚨 Plan confidence is too low. Reconsider the approach before execution.")
        
        if not issues:
            recommendations.append("No major issues detected.")
        
        return recommendations
    
    def _get_mock_plan_data(self) -> Dict:
        """Retorna datos mock para demostración"""
        return {
            "steps": [
                {"description": "Analyze requirements", "expected_outcome": "List of key requirements"},
                {"description": "Create semantic model", "expected_outcome": "Semantic graph built"},
                {"description": "Run predictions", "expected_outcome": "Risk scores generated"}
            ],
            "decision_points": [
                {"name": "Use cache?", "options": ["yes", "no"]},
                {"name": "Include legacy data?", "options": ["yes", "no"]}
            ],
            "edge_cases_handled": ["Empty requirements", "Invalid symbols", "Network timeout"],
            "total_edge_cases": 5,
            "error_handlers": [
                "Timeout recovery",
                "Invalid data rejection",
                "Cache fallback"
            ],
            "dependencies": [
                {"name": "semantic_model", "order": 1},
                {"name": "graph_analysis", "order": 2},
                {"name": "predictions", "order": 3}
            ],
            "can_rollback": True,
            "is_deterministic": True,
            "random_factors": 0,
            "expected_output_defined": True,
            "implicit_steps": 1,
            "reasoning": "This plan follows a logical sequence: first collect requirements, then model them semantically, then run analytics. Each step has error handling and can be rolled back if needed.",
            "justifications": [
                "Semantic analysis required before predictions",
                "Graph algorithms need semantic model",
                "Risk predictions are the final output"
            ]
        }

def get_planner_confidence_scorer():
    """Factory para obtener scorer singleton"""
    return PlannerConfidenceScorer()
