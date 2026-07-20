"""
ETAPA 4: Prediction Engine - Predictor de Riesgos y Anomalías
Predice riesgos de requisitos, detecta requisitos faltantes e inconsistencias.

Proporcionado por: Analytics Service (Python/FastAPI)
Versión: 4.0
"""

from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum
import math
import logging

# Configure logging
logger = logging.getLogger(__name__)

# =============================================================================
# DATA MODELS
# =============================================================================

class RiskLevel(str, Enum):
    """Niveles de riesgo identificados"""
    CRITICAL = "critical"      # > 0.8
    HIGH = "high"              # 0.6 - 0.8
    MEDIUM = "medium"          # 0.4 - 0.6
    LOW = "low"                # 0.2 - 0.4
    MINIMAL = "minimal"        # < 0.2


class MissingType(str, Enum):
    """Tipos de requisitos potencialmente faltantes"""
    SECURITY = "security"
    PERFORMANCE = "performance"
    RELIABILITY = "reliability"
    USABILITY = "usability"
    MAINTENANCE = "maintenance"
    MONITORING = "monitoring"
    ERROR_HANDLING = "error_handling"
    DATA_VALIDATION = "data_validation"


class InconsistencyType(str, Enum):
    """Tipos de inconsistencias detectadas"""
    CONTRADICTORY = "contradictory"      # Requisitos que se contradicen
    DUPLICATE = "duplicate"              # Requisitos duplicados/muy similares
    CONFLICTING_PRIORITY = "conflicting_priority"  # Prioridades conflictivas
    MISSING_DEPENDENCY = "missing_dependency"      # Dependencia no definida
    CIRCULAR_DEPENDENCY = "circular_dependency"    # Dependencia circular


@dataclass
class RiskPrediction:
    """Predicción de riesgo para un requisito"""
    requirement_id: str
    requirement_text: str
    risk_score: float  # 0-1
    risk_level: str    # critical, high, medium, low, minimal
    risk_factors: Dict[str, float]  # Factor name -> contribution
    recommendations: List[str]
    confidence: float  # 0-1, qué tan seguro es el modelo


@dataclass
class MissingRequirement:
    """Requisito potencialmente faltante"""
    missing_type: str  # security, performance, etc.
    priority: str      # critical, high, medium, low
    description: str
    rationale: str
    affected_areas: List[str]  # Áreas del sistema afectadas
    confidence: float  # 0-1


@dataclass
class Inconsistency:
    """Inconsistencia detectada"""
    inconsistency_type: str
    requirement_ids: List[str]
    severity: str  # critical, high, medium, low
    description: str
    resolution_suggestions: List[str]
    confidence: float


@dataclass
class PredictionReport:
    """Reporte completo de predicciones"""
    project_id: Optional[str]
    total_requirements: int
    risk_predictions: List[RiskPrediction]
    missing_requirements: List[MissingRequirement]
    inconsistencies: List[Inconsistency]
    summary: Dict[str, Any]


# =============================================================================
# PREDICTION ENGINE CLASS
# =============================================================================

class PredictionEngine:
    """Motor de predicción de riesgos y anomalías"""
    
    def __init__(self):
        """Inicializa el motor"""
        self.logger = logger
        
        # Palabras clave para detección de tipos de requisitos
        self.security_keywords = [
            'encrypt', 'hash', 'password', 'auth', 'token', 'ssl', 'tls',
            'secure', 'permission', 'access control', 'firewall', 'certificate',
            'signature', 'compliance', 'gdpr', 'pci', 'hipaa'
        ]
        
        self.performance_keywords = [
            'ms', 'seconds', 'response time', 'latency', 'throughput',
            'performance', 'fast', 'slow', 'optimized', 'efficient',
            'load', 'concurrent', 'requests per', 'rps', 'qps'
        ]
        
        self.reliability_keywords = [
            'availability', 'uptime', '99.9', 'failover', 'redundancy',
            'backup', 'recovery', 'restart', 'resilience', 'fault tolerance',
            'disaster recovery', 'rto', 'rpo'
        ]
        
        self.usability_keywords = [
            'user', 'interface', 'ui', 'ux', 'accessibility', 'intuitive',
            'easy', 'simple', 'user-friendly', 'responsive', 'mobile',
            'search', 'filter', 'sort'
        ]
        
        self.maintenance_keywords = [
            'logging', 'monitoring', 'debug', 'trace', 'metric', 'alert',
            'maintenance', 'support', 'patch', 'update', 'version',
            'documentation', 'code review'
        ]
    
    # =========================================================================
    # RISK PREDICTION
    # =========================================================================
    
    def predict_requirement_risk(
        self,
        requirement_id: str,
        requirement_text: str,
        context: Optional[List[str]] = None,
        project_context: Optional[Dict[str, Any]] = None
    ) -> RiskPrediction:
        """
        Predice el riesgo de un requisito.
        
        Args:
            requirement_id: ID del requisito
            requirement_text: Texto del requisito
            context: Requisitos relacionados para contexto
            project_context: Contexto del proyecto (tipo, dominio, etc.)
        
        Returns:
            RiskPrediction con score y recomendaciones
        """
        risk_factors = {}
        recommendations = []
        
        # Factor 1: Ambigüedad (alto riesgo)
        ambiguity_risk = self._calculate_ambiguity_risk(requirement_text)
        risk_factors['ambiguity'] = ambiguity_risk * 0.25  # Peso 25%
        
        if ambiguity_risk > 0.7:
            recommendations.append(
                "High ambiguity detected - Clarify terms and add specific metrics"
            )
        
        # Factor 2: Complejidad (medio-alto riesgo)
        complexity_risk = self._calculate_complexity_risk(requirement_text)
        risk_factors['complexity'] = complexity_risk * 0.20  # Peso 20%
        
        if complexity_risk > 0.6:
            recommendations.append(
                "Complex requirement - Consider breaking into smaller tasks"
            )
        
        # Factor 3: Falta de contexto de dependencias (medio riesgo)
        dependency_risk = self._calculate_dependency_risk(
            requirement_id,
            context or []
        )
        risk_factors['dependency'] = dependency_risk * 0.20  # Peso 20%
        
        if dependency_risk > 0.6:
            recommendations.append(
                "Dependency context unclear - Define required relationships"
            )
        
        # Factor 4: Conformidad de estándares (bajo-medio riesgo)
        conformance_risk = self._calculate_conformance_risk(requirement_text)
        risk_factors['conformance'] = conformance_risk * 0.15  # Peso 15%
        
        if conformance_risk > 0.5:
            recommendations.append(
                "May not follow requirement best practices - Review format"
            )
        
        # Factor 5: Coverage de áreas funcionales (bajo riesgo)
        coverage_risk = self._calculate_coverage_risk(
            requirement_text,
            project_context or {}
        )
        risk_factors['coverage'] = coverage_risk * 0.20  # Peso 20%
        
        # Calcular score final
        total_risk = sum(risk_factors.values())
        risk_score = min(1.0, max(0.0, total_risk))
        
        # Determinar nivel de riesgo
        if risk_score > 0.8:
            risk_level = "critical"
        elif risk_score > 0.6:
            risk_level = "high"
        elif risk_score > 0.4:
            risk_level = "medium"
        elif risk_score > 0.2:
            risk_level = "low"
        else:
            risk_level = "minimal"
        
        # Calcular confianza (basado en consistencia de factores)
        variance = sum((v - risk_score) ** 2 for v in risk_factors.values()) / len(risk_factors)
        confidence = 1.0 - (variance / (risk_score + 0.1))  # Normalizar
        confidence = max(0.5, min(1.0, confidence))  # 0.5 - 1.0
        
        prediction = RiskPrediction(
            requirement_id=requirement_id,
            requirement_text=requirement_text,
            risk_score=risk_score,
            risk_level=risk_level,
            risk_factors=risk_factors,
            recommendations=recommendations,
            confidence=confidence
        )
        
        self.logger.info(
            f"Risk prediction for {requirement_id}: {risk_level} "
            f"(score={risk_score:.2f}, confidence={confidence:.2f})"
        )
        return prediction
    
    def _calculate_ambiguity_risk(self, text: str) -> float:
        """Calcula riesgo por ambigüedad"""
        score = 0.0
        
        vague_words = [
            'maybe', 'probably', 'possibly', 'should', 'might',
            'good', 'bad', 'nice', 'horrible', 'beautiful',
            'many', 'few', 'some', 'several', 'lots'
        ]
        
        vague_count = sum(1 for word in vague_words if word in text.lower())
        score += min(0.5, vague_count * 0.1)
        
        # Falta de números/métricas
        if not any(char.isdigit() for char in text):
            score += 0.3
        
        # Oraciones múltiples (menos específico)
        sentence_count = len([s for s in text.split('.') if s.strip()])
        if sentence_count > 2:
            score += 0.2
        
        return min(1.0, score)
    
    def _calculate_complexity_risk(self, text: str) -> float:
        """Calcula riesgo por complejidad"""
        score = 0.0
        
        # Palabras complejas
        complex_indicators = [
            'and', 'or', 'if', 'when', 'while', 'unless',
            'moreover', 'furthermore', 'however', 'nevertheless'
        ]
        
        complex_count = sum(1 for word in complex_indicators if word in text.lower())
        score += min(0.5, complex_count * 0.08)
        
        # Longitud (requisitos muy largos son más complejos)
        words = len(text.split())
        if words > 50:
            score += 0.3
        elif words > 30:
            score += 0.15
        
        # Palabras técnicas (pueden indicar complejidad)
        technical_words = ['algorithm', 'protocol', 'architecture', 'framework', 'api']
        technical_count = sum(1 for word in technical_words if word in text.lower())
        score += min(0.2, technical_count * 0.05)
        
        return min(1.0, score)
    
    def _calculate_dependency_risk(
        self,
        requirement_id: str,
        context: List[str]
    ) -> float:
        """Calcula riesgo por falta de contexto de dependencias"""
        score = 0.0
        
        # Si no hay contexto, asumir riesgo moderado
        if not context:
            return 0.5
        
        # Si el requisito ID no aparece en contexto de dependencias,
        # podría ser huérfano
        if requirement_id not in str(context).lower():
            score += 0.4
        
        return min(1.0, score)
    
    def _calculate_conformance_risk(self, text: str) -> float:
        """Calcula riesgo por no conformidad de estándares"""
        score = 0.0
        
        # Verificar palabras clave de buena especificación
        good_keywords = ['shall', 'must', 'is required', 'will', 'is able']
        bad_keywords = ['should', 'may', 'could', 'might', 'shall not']
        
        good_count = sum(1 for kw in good_keywords if kw in text.lower())
        bad_count = sum(1 for kw in bad_keywords if kw in text.lower())
        
        score = (bad_count - good_count) * 0.15
        
        # Verificar que empieza con verbo o sustantivo
        first_word = text.split()[0].lower() if text.split() else ""
        if first_word not in ['the', 'a', 'an']:
            score -= 0.2
        
        return max(0.0, min(1.0, score))
    
    def _calculate_coverage_risk(
        self,
        text: str,
        project_context: Dict[str, Any]
    ) -> float:
        """Calcula riesgo por cobertura de áreas funcionales"""
        score = 0.0
        
        # Tipo de proyecto
        project_type = project_context.get('type', 'unknown').lower()
        
        # Buscar palabras clave de seguridad
        has_security = any(kw in text.lower() for kw in self.security_keywords)
        if project_type in ['finance', 'healthcare', 'government'] and not has_security:
            score += 0.3
        
        # Buscar palabras clave de performance
        has_performance = any(kw in text.lower() for kw in self.performance_keywords)
        if project_type == 'web' and not has_performance:
            score += 0.2
        
        return min(1.0, score)
    
    # =========================================================================
    # MISSING REQUIREMENTS DETECTION
    # =========================================================================
    
    def detect_missing_requirements(
        self,
        requirements: List[Dict[str, Any]],
        project_context: Optional[Dict[str, Any]] = None
    ) -> List[MissingRequirement]:
        """
        Detecta tipos de requisitos potencialmente faltantes.
        
        Args:
            requirements: Lista de requisitos existentes
            project_context: Contexto del proyecto
        
        Returns:
            Lista de MissingRequirement
        """
        missing = []
        project_type = (project_context or {}).get('type', 'general').lower()
        
        # Combinar todo el texto de requisitos
        all_text = ' '.join(req.get('description', '') for req in requirements)
        all_text_lower = all_text.lower()
        
        # Verificar Security
        has_security = any(kw in all_text_lower for kw in self.security_keywords)
        if not has_security and project_type in ['finance', 'healthcare', 'web', 'saas']:
            missing.append(MissingRequirement(
                missing_type='security',
                priority='critical' if project_type in ['finance', 'healthcare'] else 'high',
                description='Security and data protection requirements',
                rationale='No explicit security requirements found for sensitive data handling',
                affected_areas=['authentication', 'authorization', 'data_protection'],
                confidence=0.8
            ))
        
        # Verificar Performance
        has_performance = any(kw in all_text_lower for kw in self.performance_keywords)
        if not has_performance and project_type in ['web', 'api', 'mobile']:
            missing.append(MissingRequirement(
                missing_type='performance',
                priority='high',
                description='Performance and response time requirements',
                rationale='No explicit performance SLAs defined',
                affected_areas=['api', 'ui', 'database'],
                confidence=0.7
            ))
        
        # Verificar Reliability
        has_reliability = any(kw in all_text_lower for kw in self.reliability_keywords)
        if not has_reliability and project_type in ['saas', 'enterprise']:
            missing.append(MissingRequirement(
                missing_type='reliability',
                priority='high',
                description='Availability and reliability requirements',
                rationale='No uptime or SLA targets specified',
                affected_areas=['infrastructure', 'backup', 'recovery'],
                confidence=0.75
            ))
        
        # Verificar Error Handling
        has_error_handling = any(
            kw in all_text_lower for kw in ['error', 'exception', 'validation', 'fallback']
        )
        if not has_error_handling:
            missing.append(MissingRequirement(
                missing_type='error_handling',
                priority='medium',
                description='Error handling and validation requirements',
                rationale='No explicit error handling or input validation specified',
                affected_areas=['api', 'database', 'ui'],
                confidence=0.6
            ))
        
        # Verificar Monitoring
        has_monitoring = any(kw in all_text_lower for kw in ['logging', 'monitoring', 'metric', 'alert'])
        if not has_monitoring and project_type in ['saas', 'enterprise']:
            missing.append(MissingRequirement(
                missing_type='monitoring',
                priority='medium',
                description='Monitoring and observability requirements',
                rationale='No logging or monitoring requirements specified',
                affected_areas=['infrastructure', 'operations'],
                confidence=0.65
            ))
        
        self.logger.info(f"Detected {len(missing)} potentially missing requirement types")
        return missing
    
    # =========================================================================
    # INCONSISTENCY DETECTION
    # =========================================================================
    
    def detect_inconsistencies(
        self,
        requirements: List[Dict[str, Any]],
        relationships: Optional[List[Dict[str, str]]] = None
    ) -> List[Inconsistency]:
        """
        Detecta inconsistencias entre requisitos.
        
        Args:
            requirements: Lista de requisitos
            relationships: Lista de relaciones entre requisitos
        
        Returns:
            Lista de Inconsistency
        """
        inconsistencies = []
        
        # Detectar requisitos duplicados o muy similares
        duplicates = self._detect_duplicates(requirements)
        inconsistencies.extend(duplicates)
        
        # Detectar prioridades conflictivas
        priority_conflicts = self._detect_priority_conflicts(requirements)
        inconsistencies.extend(priority_conflicts)
        
        # Detectar dependencias circulares (si se proporcionan relaciones)
        if relationships:
            circular_deps = self._detect_circular_dependencies(
                requirements,
                relationships
            )
            inconsistencies.extend(circular_deps)
        
        self.logger.info(f"Detected {len(inconsistencies)} inconsistencies")
        return inconsistencies
    
    def _detect_duplicates(self, requirements: List[Dict[str, Any]]) -> List[Inconsistency]:
        """Detecta requisitos duplicados"""
        duplicates = []
        
        for i, req1 in enumerate(requirements):
            for j, req2 in enumerate(requirements[i+1:], i+1):
                desc1 = req1.get('description', '').lower()
                desc2 = req2.get('description', '').lower()
                
                # Calcular similitud simple (Jaccard)
                words1 = set(desc1.split())
                words2 = set(desc2.split())
                
                if words1 and words2:
                    intersection = len(words1 & words2)
                    union = len(words1 | words2)
                    similarity = intersection / union
                    
                    if similarity > 0.8:
                        duplicates.append(Inconsistency(
                            inconsistency_type='duplicate',
                            requirement_ids=[req1['id'], req2['id']],
                            severity='high',
                            description=f'Requirements are highly similar (similarity: {similarity:.2f})',
                            resolution_suggestions=[
                                'Merge similar requirements',
                                'Remove duplicate requirement',
                                'Clarify distinction between requirements'
                            ],
                            confidence=similarity
                        ))
        
        return duplicates
    
    def _detect_priority_conflicts(self, requirements: List[Dict[str, Any]]) -> List[Inconsistency]:
        """Detecta prioridades conflictivas"""
        conflicts = []
        
        # Buscar requisitos con múltiples prioridades asignadas
        for req in requirements:
            description = req.get('description', '').lower()
            priorities = [p for p in ['critical', 'high', 'medium', 'low'] if p in description]
            
            if len(priorities) > 1:
                conflicts.append(Inconsistency(
                    inconsistency_type='conflicting_priority',
                    requirement_ids=[req['id']],
                    severity='medium',
                    description=f'Multiple priority levels mentioned: {priorities}',
                    resolution_suggestions=['Clarify single priority for requirement'],
                    confidence=0.7
                ))
        
        return conflicts
    
    def _detect_circular_dependencies(
        self,
        requirements: List[Dict[str, Any]],
        relationships: List[Dict[str, str]]
    ) -> List[Inconsistency]:
        """Detecta dependencias circulares"""
        # Simplified: just check for obvious cycles (A->B->A)
        cycles = []
        
        for rel1 in relationships:
            source1 = rel1.get('source_id')
            target1 = rel1.get('target_id')
            
            for rel2 in relationships:
                source2 = rel2.get('source_id')
                target2 = rel2.get('target_id')
                
                # A depends on B and B depends on A
                if source1 == target2 and target1 == source2 and source1 != source2:
                    cycles.append(Inconsistency(
                        inconsistency_type='circular_dependency',
                        requirement_ids=[source1, target1],
                        severity='high',
                        description=f'Circular dependency detected: {source1} ↔ {target1}',
                        resolution_suggestions=[
                            'Break circular dependency by reordering requirements',
                            'Introduce intermediate requirement',
                            'Reconsider requirement relationship'
                        ],
                        confidence=0.95
                    ))
        
        # Remove duplicates
        return list({c.requirement_ids[0] + c.requirement_ids[1]: c for c in cycles}.values())
    
    # =========================================================================
    # COMPREHENSIVE PREDICTION REPORT
    # =========================================================================
    
    def generate_prediction_report(
        self,
        requirements: List[Dict[str, Any]],
        relationships: Optional[List[Dict[str, str]]] = None,
        project_context: Optional[Dict[str, Any]] = None,
        project_id: Optional[str] = None
    ) -> PredictionReport:
        """
        Genera reporte completo de predicciones.
        
        Args:
            requirements: Lista de requisitos
            relationships: Lista de relaciones
            project_context: Contexto del proyecto
            project_id: ID del proyecto (opcional)
        
        Returns:
            PredictionReport con todos los análisis
        """
        # Risk predictions para cada requisito
        risk_predictions = []
        for req in requirements:
            prediction = self.predict_requirement_risk(
                req.get('id', ''),
                req.get('description', ''),
                project_context=project_context
            )
            risk_predictions.append(prediction)
        
        # Detectar requisitos faltantes
        missing_requirements = self.detect_missing_requirements(
            requirements,
            project_context
        )
        
        # Detectar inconsistencias
        inconsistencies = self.detect_inconsistencies(
            requirements,
            relationships
        )
        
        # Calcular resumen
        risk_distribution = {}
        for pred in risk_predictions:
            level = pred.risk_level
            risk_distribution[level] = risk_distribution.get(level, 0) + 1
        
        avg_risk = sum(p.risk_score for p in risk_predictions) / len(risk_predictions) if risk_predictions else 0
        
        summary = {
            'total_requirements': len(requirements),
            'average_risk_score': round(avg_risk, 3),
            'risk_distribution': risk_distribution,
            'total_missing_types': len(missing_requirements),
            'total_inconsistencies': len(inconsistencies),
            'critical_count': risk_distribution.get('critical', 0),
            'high_count': risk_distribution.get('high', 0),
            'overall_assessment': self._assess_overall_health(
                avg_risk,
                len(missing_requirements),
                len(inconsistencies)
            )
        }
        
        report = PredictionReport(
            project_id=project_id,
            total_requirements=len(requirements),
            risk_predictions=risk_predictions,
            missing_requirements=missing_requirements,
            inconsistencies=inconsistencies,
            summary=summary
        )
        
        self.logger.info(
            f"Generated prediction report: {len(risk_predictions)} risks, "
            f"{len(missing_requirements)} missing types, "
            f"{len(inconsistencies)} inconsistencies"
        )
        return report
    
    def _assess_overall_health(
        self,
        avg_risk: float,
        missing_count: int,
        inconsistency_count: int
    ) -> str:
        """Evalúa la salud general del proyecto"""
        score = 100.0
        
        # Restar por riesgo promedio
        score -= avg_risk * 40
        
        # Restar por requisitos faltantes
        score -= min(missing_count * 10, 30)
        
        # Restar por inconsistencias
        score -= min(inconsistency_count * 15, 30)
        
        score = max(0, min(100, score))
        
        if score >= 80:
            return "excellent"
        elif score >= 60:
            return "good"
        elif score >= 40:
            return "fair"
        elif score >= 20:
            return "poor"
        else:
            return "critical"


# =============================================================================
# FACTORY FUNCTIONS
# =============================================================================

_engine_instance = None


def get_engine() -> PredictionEngine:
    """Singleton factory para PredictionEngine"""
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = PredictionEngine()
    return _engine_instance


def reset_engine():
    """Reset engine (para testing)"""
    global _engine_instance
    _engine_instance = None
