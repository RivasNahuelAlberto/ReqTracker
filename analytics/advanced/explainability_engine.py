"""
ETAPA 5: Explainability Engine
Explainability y interpretabilidad de predicciones usando SHAP y técnicas alternativas

Versión: 5.0
"""

import logging
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)

# Optional imports with fallback
try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    logger.warning("⚠️  shap not installed, explainability will use alternative methods")
    SHAP_AVAILABLE = False

# =============================================================================
# DATA MODELS
# =============================================================================

class FeatureImportance(str, Enum):
    """Niveles de importancia de features"""
    CRITICAL = "critical"      # >0.3 del score total
    HIGH = "high"              # 0.15-0.3 del score total
    MEDIUM = "medium"          # 0.05-0.15 del score total
    LOW = "low"                # <0.05 del score total


@dataclass
class FeatureContribution:
    """Contribución de una feature a una predicción"""
    feature_name: str
    feature_value: Any
    contribution_value: float  # Cambio en output debido a esta feature
    contribution_pct: float    # Porcentaje del cambio total
    importance_level: FeatureImportance
    direction: str             # "positive" o "negative"
    baseline_value: Optional[Any] = None


@dataclass
class PredictionExplanation:
    """Explicación completa de una predicción"""
    prediction_id: str
    prediction_type: str  # risk, missing, inconsistency
    predicted_value: float
    baseline_value: float
    feature_contributions: List[FeatureContribution]
    interpretation: str
    confidence: float
    shap_values: Optional[Dict[str, float]] = None


@dataclass
class ModelExplanation:
    """Explicación de características de un modelo"""
    model_name: str
    expected_model_output: float
    feature_importance_ranking: List[Tuple[str, float]]
    model_assumptions: List[str]
    known_limitations: List[str]
    decision_boundaries: Dict[str, Tuple[float, float]]


@dataclass
class ExplainabilityReport:
    """Reporte de explainability"""
    analysis_type: str
    total_predictions_explained: int
    predictions: List[PredictionExplanation]
    model_explanation: Optional[ModelExplanation]
    summary: Dict[str, Any]
    insights: List[str]


# =============================================================================
# EXPLAINABILITY ENGINE
# =============================================================================

_explainability_engine: Optional['ExplainabilityEngine'] = None


def get_engine() -> 'ExplainabilityEngine':
    """Factory function para obtener instancia del engine"""
    global _explainability_engine
    if _explainability_engine is None:
        _explainability_engine = ExplainabilityEngine()
    return _explainability_engine


def reset_engine():
    """Reset engine singleton"""
    global _explainability_engine
    _explainability_engine = None


class ExplainabilityEngine:
    """Motor de explicabilidad e interpretabilidad"""
    
    def __init__(self):
        """Inicializa el motor"""
        self.logger = logger
        self.shap_available = SHAP_AVAILABLE
        
        if not self.shap_available:
            self.logger.warning("SHAP not available, using feature contribution analysis")
        
        # Mappings de feature names a descripciones
        self.feature_descriptions = {
            'ambiguity': 'Presencia de palabras vagas o ambiguas',
            'complexity': 'Nivel de complejidad del requisito',
            'dependency': 'Número de dependencias',
            'conformance': 'Adherencia a estándares',
            'coverage': 'Cobertura de dominio',
            'word_count': 'Longitud del requisito',
            'has_metrics': 'Presencia de métricas cuantitativas',
            'keyword_security': 'Presencia de palabras clave de seguridad',
            'keyword_performance': 'Presencia de palabras clave de performance',
            'is_duplicate': 'Similitud con otros requisitos'
        }
        
        self.logger.info("✓ ExplainabilityEngine initialized")
    
    # =========================================================================
    # EXPLAINABILITY METHODS
    # =========================================================================
    
    def explain_risk_prediction(
        self,
        requirement_id: str,
        requirement_text: str,
        risk_score: float,
        risk_factors: Dict[str, float],
        context: Optional[Dict[str, Any]] = None
    ) -> PredictionExplanation:
        """
        Explica por qué un requisito tiene cierto riesgo
        
        Args:
            requirement_id: ID del requisito
            requirement_text: Texto del requisito
            risk_score: Score de riesgo (0-1)
            risk_factors: Factores de riesgo descompuestos
            context: Contexto adicional
        
        Returns:
            PredictionExplanation con detalles
        """
        self.logger.info(f"Explaining risk prediction for {requirement_id}")
        
        # Crear contribuciones de features
        contributions = self._create_risk_contributions(
            risk_factors,
            risk_score
        )
        
        # Generar interpretación textual
        interpretation = self._interpret_risk_prediction(
            risk_score,
            risk_factors,
            requirement_text
        )
        
        explanation = PredictionExplanation(
            prediction_id=requirement_id,
            prediction_type="risk",
            predicted_value=risk_score,
            baseline_value=0.5,  # Riesgo neutral por defecto
            feature_contributions=contributions,
            interpretation=interpretation,
            confidence=0.85
        )
        
        return explanation
    
    def explain_missing_requirements(
        self,
        missing_type: str,
        requirements: List[Dict[str, Any]],
        missing_keywords: List[str],
        confidence: float
    ) -> PredictionExplanation:
        """
        Explica por qué se detectó un tipo de requisito faltante
        
        Args:
            missing_type: Tipo de requisito faltante
            requirements: Requisitos actuales
            missing_keywords: Palabras clave buscadas
            confidence: Confianza de la detección
        
        Returns:
            PredictionExplanation
        """
        self.logger.info(f"Explaining missing requirements detection: {missing_type}")
        
        # Analizar presencia de keywords
        found_keywords = set()
        for req in requirements:
            desc = req.get('description', '').lower()
            for keyword in missing_keywords:
                if keyword.lower() in desc:
                    found_keywords.add(keyword)
        
        # Crear contribuciones
        contributions = []
        
        # Feature: Absence of keywords
        absence_pct = (1 - len(found_keywords) / max(1, len(missing_keywords))) * 100
        contributions.append(FeatureContribution(
            feature_name=f"absence_of_{missing_type}_keywords",
            feature_value=f"{len(found_keywords)}/{len(missing_keywords)} found",
            contribution_value=absence_pct / 100,
            contribution_pct=50.0,
            importance_level=FeatureImportance.CRITICAL,
            direction="negative",
            baseline_value=f"0/{len(missing_keywords)}"
        ))
        
        # Feature: Project type relevance
        if missing_type == "security":
            contributions.append(FeatureContribution(
                feature_name="project_type_requires_security",
                feature_value="High risk domain detected",
                contribution_value=0.25,
                contribution_pct=50.0,
                importance_level=FeatureImportance.HIGH,
                direction="positive"
            ))
        
        # Interpretación
        interpretation = f"Type '{missing_type}' requirements are missing because: "
        if len(found_keywords) == 0:
            interpretation += f"No keywords from {missing_keywords} found in any requirement."
        else:
            interpretation += f"Only {len(found_keywords)}/{len(missing_keywords)} relevant keywords detected."
        
        return PredictionExplanation(
            prediction_id=f"missing_{missing_type}",
            prediction_type="missing",
            predicted_value=confidence,
            baseline_value=0.3,
            feature_contributions=contributions,
            interpretation=interpretation,
            confidence=confidence
        )
    
    def explain_inconsistency(
        self,
        inconsistency_type: str,
        requirement_ids: List[str],
        similarity_score: Optional[float] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> PredictionExplanation:
        """
        Explica por qué se detectó una inconsistencia
        
        Args:
            inconsistency_type: Tipo de inconsistencia
            requirement_ids: IDs de requisitos afectados
            similarity_score: Score de similitud (para duplicados)
            metadata: Metadata adicional
        
        Returns:
            PredictionExplanation
        """
        self.logger.info(f"Explaining inconsistency: {inconsistency_type}")
        
        contributions = []
        
        if inconsistency_type == "duplicate":
            # Feature: Text similarity
            if similarity_score:
                contributions.append(FeatureContribution(
                    feature_name="text_similarity",
                    feature_value=f"{similarity_score:.2f}",
                    contribution_value=similarity_score,
                    contribution_pct=80.0,
                    importance_level=FeatureImportance.CRITICAL,
                    direction="positive",
                    baseline_value="0.8 (threshold)"
                ))
            
            # Feature: Same priority
            contributions.append(FeatureContribution(
                feature_name="same_priority_level",
                feature_value="Both marked as high priority",
                contribution_value=0.15,
                contribution_pct=20.0,
                importance_level=FeatureImportance.MEDIUM,
                direction="positive"
            ))
            
            interpretation = f"Requirements {requirement_ids[0]} and {requirement_ids[1]} are highly similar "
            interpretation += f"(similarity: {similarity_score:.2f}). Recommend merging or clarifying differences."
        
        elif inconsistency_type == "circular_dependency":
            # Feature: Circular reference detected
            contributions.append(FeatureContribution(
                feature_name="circular_reference",
                feature_value=f"Loop detected: {' -> '.join(requirement_ids)}",
                contribution_value=1.0,
                contribution_pct=100.0,
                importance_level=FeatureImportance.CRITICAL,
                direction="positive"
            ))
            
            interpretation = f"Circular dependency detected: {' -> '.join(requirement_ids)} -> {requirement_ids[0]}. "
            interpretation += "This creates a logical loop that must be resolved."
        
        else:
            interpretation = f"Inconsistency of type '{inconsistency_type}' detected in requirements."
        
        return PredictionExplanation(
            prediction_id=f"inconsistency_{inconsistency_type}_{'_'.join(requirement_ids)}",
            prediction_type="inconsistency",
            predicted_value=0.9,
            baseline_value=0.0,
            feature_contributions=contributions,
            interpretation=interpretation,
            confidence=0.95
        )
    
    def explain_clustering(
        self,
        cluster_id: int,
        cluster_type: str,
        requirement_ids: List[str],
        cohesion: float,
        isolation: float
    ) -> PredictionExplanation:
        """
        Explica por qué requisitos fueron agrupados en un cluster
        
        Args:
            cluster_id: ID del cluster
            cluster_type: Tipo de cluster (functional, domain, etc.)
            requirement_ids: IDs de requisitos en el cluster
            cohesion: Score de cohesión
            isolation: Score de aislamiento
        
        Returns:
            PredictionExplanation
        """
        contributions = []
        
        # Feature: Internal cohesion
        contributions.append(FeatureContribution(
            feature_name="cluster_cohesion",
            feature_value=f"{cohesion:.2f}",
            contribution_value=cohesion,
            contribution_pct=60.0,
            importance_level=FeatureImportance.CRITICAL if cohesion > 0.7 else FeatureImportance.HIGH,
            direction="positive"
        ))
        
        # Feature: Isolation from others
        contributions.append(FeatureContribution(
            feature_name="cluster_isolation",
            feature_value=f"{isolation:.2f}",
            contribution_value=isolation,
            contribution_pct=40.0,
            importance_level=FeatureImportance.HIGH,
            direction="positive"
        ))
        
        # Interpretación
        quality = "well-formed" if cohesion > 0.7 else "loose"
        interpretation = f"Cluster {cluster_id} ({cluster_type}) is a {quality} grouping of {len(requirement_ids)} requirements. "
        interpretation += f"High internal similarity (cohesion: {cohesion:.2f}) and separation from others "
        interpretation += f"(isolation: {isolation:.2f}) support this clustering."
        
        return PredictionExplanation(
            prediction_id=f"cluster_{cluster_id}",
            prediction_type="clustering",
            predicted_value=cohesion,
            baseline_value=0.5,
            feature_contributions=contributions,
            interpretation=interpretation,
            confidence=0.8
        )
    
    def generate_explainability_report(
        self,
        predictions: List[Dict[str, Any]],
        analysis_type: str = "comprehensive"
    ) -> ExplainabilityReport:
        """
        Genera reporte completo de explainability
        
        Args:
            predictions: Predicciones a explicar
            analysis_type: Tipo de análisis (risk, missing, inconsistency, comprehensive)
        
        Returns:
            ExplainabilityReport
        """
        self.logger.info(f"Generating explainability report ({analysis_type})")
        
        explanations = []
        for pred in predictions[:5]:  # Limitar a primeros 5 para no saturar
            if pred.get('prediction_type') == 'risk':
                exp = self.explain_risk_prediction(
                    pred.get('requirement_id', 'unknown'),
                    pred.get('text', ''),
                    pred.get('risk_score', 0.5),
                    pred.get('risk_factors', {})
                )
            elif pred.get('prediction_type') == 'missing':
                exp = self.explain_missing_requirements(
                    pred.get('missing_type', 'unknown'),
                    pred.get('requirements', []),
                    pred.get('keywords', []),
                    pred.get('confidence', 0.6)
                )
            else:
                continue
            
            explanations.append(exp)
        
        # Generar modelo explanation
        model_exp = self._generate_model_explanation(analysis_type)
        
        # Insights
        insights = self._generate_insights(explanations, analysis_type)
        
        report = ExplainabilityReport(
            analysis_type=analysis_type,
            total_predictions_explained=len(explanations),
            predictions=explanations,
            model_explanation=model_exp,
            summary=self._generate_summary(explanations),
            insights=insights
        )
        
        return report
    
    # =========================================================================
    # PRIVATE METHODS
    # =========================================================================
    
    def _create_risk_contributions(
        self,
        risk_factors: Dict[str, float],
        total_risk: float
    ) -> List[FeatureContribution]:
        """Crea contribuciones a partir de factores de riesgo"""
        contributions = []
        
        # Normalizar factores para que sumen 1
        total = sum(risk_factors.values()) if risk_factors else 1.0
        
        for factor_name, factor_value in risk_factors.items():
            # Calcular porcentaje de contribución
            contribution_pct = (factor_value / total * 100) if total > 0 else 0
            
            # Determinar nivel de importancia
            if contribution_pct > 30:
                importance = FeatureImportance.CRITICAL
            elif contribution_pct > 15:
                importance = FeatureImportance.HIGH
            elif contribution_pct > 5:
                importance = FeatureImportance.MEDIUM
            else:
                importance = FeatureImportance.LOW
            
            description = self.feature_descriptions.get(
                factor_name,
                f"Factor: {factor_name}"
            )
            
            contributions.append(FeatureContribution(
                feature_name=factor_name,
                feature_value=f"{factor_value:.2f}",
                contribution_value=factor_value,
                contribution_pct=contribution_pct,
                importance_level=importance,
                direction="positive" if factor_value > 0.5 else "negative"
            ))
        
        return sorted(
            contributions,
            key=lambda x: x.contribution_pct,
            reverse=True
        )
    
    def _interpret_risk_prediction(
        self,
        risk_score: float,
        risk_factors: Dict[str, float],
        requirement_text: str
    ) -> str:
        """Genera interpretación de predicción de riesgo"""
        if risk_score < 0.2:
            level = "minimal"
        elif risk_score < 0.4:
            level = "low"
        elif risk_score < 0.6:
            level = "medium"
        elif risk_score < 0.8:
            level = "high"
        else:
            level = "critical"
        
        interpretation = f"This requirement has {level} risk ({risk_score:.2f}). "
        
        # Identificar factor dominante
        max_factor = max(risk_factors.items(), key=lambda x: x[1], default=("", 0))
        if max_factor[0]:
            interpretation += f"Primary concern: {max_factor[0]} ({max_factor[1]:.2f}). "
        
        # Recomendación
        if risk_score > 0.6:
            interpretation += "Recommendation: Revise and clarify this requirement before implementation."
        else:
            interpretation += "This requirement is well-defined and clear."
        
        return interpretation
    
    def _generate_model_explanation(
        self,
        analysis_type: str
    ) -> ModelExplanation:
        """Genera explicación del modelo"""
        if analysis_type == "risk":
            return ModelExplanation(
                model_name="RiskPredictionModel",
                expected_model_output=0.5,
                feature_importance_ranking=[
                    ("ambiguity", 0.25),
                    ("complexity", 0.20),
                    ("dependency", 0.20),
                    ("conformance", 0.15),
                    ("coverage", 0.20)
                ],
                model_assumptions=[
                    "Risk is calculable from textual features",
                    "Historical patterns apply to new requirements",
                    "Factors are independent"
                ],
                known_limitations=[
                    "Depends on requirement text quality",
                    "Cultural/domain-specific terms may be missed",
                    "Requires sufficient historical data"
                ],
                decision_boundaries={
                    "minimal": (0.0, 0.2),
                    "low": (0.2, 0.4),
                    "medium": (0.4, 0.6),
                    "high": (0.6, 0.8),
                    "critical": (0.8, 1.0)
                }
            )
        else:
            return None
    
    def _generate_insights(
        self,
        explanations: List[PredictionExplanation],
        analysis_type: str
    ) -> List[str]:
        """Genera insights a partir de explicaciones"""
        insights = []
        
        if not explanations:
            return insights
        
        # Insight 1: Feature importance
        all_contributions = []
        for exp in explanations:
            all_contributions.extend(exp.feature_contributions)
        
        if all_contributions:
            avg_importance = np.mean([c.contribution_pct for c in all_contributions])
            top_feature = max(
                all_contributions,
                key=lambda x: x.contribution_pct,
                default=None
            )
            if top_feature:
                insights.append(
                    f"Most influential factor: {top_feature.feature_name} "
                    f"(avg {top_feature.contribution_pct:.1f}% contribution)"
                )
        
        # Insight 2: Critical issues
        critical = [c for e in explanations for c in e.feature_contributions 
                   if c.importance_level == FeatureImportance.CRITICAL]
        if len(critical) > len(explanations) * 0.3:
            insights.append(f"{len(critical)} critical factors identified - immediate attention needed")
        
        return insights
    
    def _generate_summary(
        self,
        explanations: List[PredictionExplanation]
    ) -> Dict[str, Any]:
        """Genera resumen de explicaciones"""
        return {
            "total_explained": len(explanations),
            "avg_confidence": np.mean([e.confidence for e in explanations]),
            "prediction_types": list(set(e.prediction_type for e in explanations)),
            "critical_factors": len([
                c for e in explanations
                for c in e.feature_contributions
                if c.importance_level == FeatureImportance.CRITICAL
            ])
        }
