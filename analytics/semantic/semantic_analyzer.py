"""
ETAPA 2: Semantic Intelligence - Core Analyzer
Análisis semántico avanzado de requisitos

Componentes:
1. Semantic health scoring - Calidad semántica general
2. Ambiguity detection - Detección de ambigüedad
3. Semantic drift - Cambios semánticos en el tiempo
4. Topic extraction - Temas principales con BERTopic
5. Coherence analysis - Coherencia entre requisitos
"""

import numpy as np
from typing import List, Dict, Tuple, Optional
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class SemanticAnalyzer:
    """
    Analizador semántico para requisitos
    Usa embeddings y análisis lingüístico para evaluar calidad semántica
    """
    
    def __init__(self, embedding_model=None):
        """
        Inicializa el analizador
        
        Args:
            embedding_model: Modelo de embeddings (ej: sentence-transformers)
        """
        self.embedding_model = embedding_model
        
        # Palabras de baja confianza (indicadores de ambigüedad)
        self.ambiguity_indicators = {
            'vague': ['maybe', 'perhaps', 'possibly', 'somewhat', 'sort of', 'kind of', 
                     'approximately', 'roughly', 'about', 'almost', 'cerca de', 'más o menos'],
            'vague_adjectives': ['good', 'bad', 'nice', 'ugly', 'beautiful', 'horrible', 'great'],
            'imprecise': ['many', 'few', 'some', 'several', 'lots', 'quite', 'very', 'really'],
            'future_tense': ['will', 'shall', 'might', 'could', 'may', 'should'],
            'subjective': ['i think', 'i believe', 'in my opinion', 'seems like', 'feels like']
        }
        
        # Palabras de precisión (buen indicador)
        self.precision_keywords = {
            'precise': ['exactly', 'precisely', 'specifically', 'must', 'shall', 'required'],
            'measurable': ['metric', 'measure', 'count', 'percentage', 'rate', 'ms', 'seconds',
                          'bytes', 'gb', 'number', 'maximum', 'minimum'],
            'quantified': ['100%', '%', 'threshold', '<=', '>=', '<', '>']
        }
        
        logger.info("SemanticAnalyzer initialized")
    
    def calculate_semantic_health(self, requirement: str, context: Optional[List[str]] = None) -> Dict:
        """
        Calcula puntuación de salud semántica de un requisito
        
        Factores:
        - Ambigüedad (palabras vagas)
        - Precisión (palabras precisas)
        - Coherencia (relación con contexto)
        - Complejidad (longevidad, nesting)
        - Completitud (tiene objetivo, métrica, criterio)
        
        Args:
            requirement: Texto del requisito
            context: Requisitos de contexto para comparación
            
        Returns:
            Dict con scores y recomendaciones
        """
        health_score = 100.0
        issues = []
        recommendations = []
        
        # 1. SCORE DE AMBIGÜEDAD
        ambiguity_score, ambiguous_terms = self._detect_ambiguity(requirement)
        health_score -= (50 * (1 - ambiguity_score))  # Hasta -50 puntos
        
        if ambiguous_terms:
            issues.append({
                'type': 'ambiguity',
                'severity': 'high' if ambiguity_score < 0.3 else 'medium',
                'terms': ambiguous_terms,
                'score': ambiguity_score
            })
            recommendations.append(f"Replace vague terms: {', '.join(ambiguous_terms[:3])}")
        
        # 2. SCORE DE PRECISIÓN
        precision_score, precision_terms = self._detect_precision(requirement)
        health_score += (25 * precision_score)  # Hasta +25 puntos
        
        # 3. ANÁLISIS DE COMPLETITUD
        completeness_score, missing_elements = self._analyze_completeness(requirement)
        health_score += (15 * completeness_score)  # Hasta +15 puntos
        
        if missing_elements:
            issues.append({
                'type': 'incompleteness',
                'missing': missing_elements,
                'score': completeness_score
            })
            for elem in missing_elements:
                recommendations.append(f"Add {elem} to make requirement measurable")
        
        # 4. ANÁLISIS DE COMPLEJIDAD
        complexity_score = self._analyze_complexity(requirement)
        if complexity_score > 0.7:
            issues.append({
                'type': 'complexity',
                'severity': 'medium',
                'score': complexity_score,
                'suggestion': 'Consider breaking this requirement into smaller ones'
            })
            recommendations.append("Break into smaller, more focused requirements")
        
        # 5. COHERENCIA CON CONTEXTO
        coherence_score = 1.0
        if context:
            coherence_score = self._analyze_coherence(requirement, context)
            health_score += (10 * coherence_score)  # Hasta +10 puntos
        
        # Normalizar score a 0-100
        health_score = max(0, min(100, health_score))
        
        return {
            'overall_score': round(health_score, 2),
            'components': {
                'ambiguity': round(ambiguity_score * 100, 2),
                'precision': round(precision_score * 100, 2),
                'completeness': round(completeness_score * 100, 2),
                'complexity': round(complexity_score * 100, 2),
                'coherence': round(coherence_score * 100, 2)
            },
            'issues': issues,
            'recommendations': recommendations,
            'verdict': 'high_quality' if health_score >= 75 else 'medium_quality' if health_score >= 50 else 'low_quality',
            'timestamp': datetime.now().isoformat()
        }
    
    def detect_ambiguity(self, requirement: str, threshold: float = 0.5) -> Dict:
        """
        Detecta ambigüedad específica en un requisito
        
        Args:
            requirement: Texto a analizar
            threshold: Threshold de confianza (0-1)
            
        Returns:
            Dict con detalles de ambigüedad
        """
        ambiguity_score, ambiguous_terms = self._detect_ambiguity(requirement)
        
        ambiguity_level = 'high' if ambiguity_score < 0.3 else 'medium' if ambiguity_score < 0.6 else 'low'
        
        return {
            'ambiguity_score': round(ambiguity_score, 3),
            'ambiguity_level': ambiguity_level,
            'vague_terms': ambiguous_terms,
            'risk_level': 'critical' if ambiguity_score < 0.2 else 'high' if ambiguity_score < 0.4 else 'medium',
            'clarification_needed': ambiguity_score < threshold,
            'suggestions': self._generate_clarification_suggestions(requirement, ambiguous_terms)
        }
    
    def detect_semantic_drift(self, 
                             current_requirements: List[str],
                             previous_requirements: Optional[List[str]] = None,
                             threshold: float = 0.6) -> Dict:
        """
        Detecta drift semántico (cambios significativos en significado)
        
        Args:
            current_requirements: Requisitos actuales
            previous_requirements: Requisitos anteriores (para comparación)
            threshold: Threshold de similaridad para detectar drift
            
        Returns:
            Dict con análisis de drift
        """
        if not previous_requirements:
            return {
                'has_drift': False,
                'message': 'No previous requirements to compare',
                'drift_analysis': []
            }
        
        drift_analysis = []
        total_drift = 0
        
        for i, current in enumerate(current_requirements):
            if i < len(previous_requirements):
                prev = previous_requirements[i]
                
                # Calcular similaridad semántica
                similarity = self._calculate_similarity(current, prev)
                
                if similarity < threshold:
                    drift_analysis.append({
                        'index': i,
                        'similarity': round(similarity, 3),
                        'drift_magnitude': round(1 - similarity, 3),
                        'previous_requirement': prev[:100],
                        'current_requirement': current[:100],
                        'is_drift': True
                    })
                    total_drift += (1 - similarity)
                else:
                    drift_analysis.append({
                        'index': i,
                        'similarity': round(similarity, 3),
                        'is_drift': False
                    })
        
        avg_drift = total_drift / max(len(current_requirements), 1)
        
        return {
            'has_significant_drift': avg_drift > (1 - threshold),
            'average_drift': round(avg_drift, 3),
            'drift_count': sum(1 for d in drift_analysis if d.get('is_drift', False)),
            'drift_analysis': drift_analysis,
            'recommendation': 'Review changed requirements for unintended semantic shifts' if avg_drift > 0.2 else None
        }
    
    def extract_topics(self, requirements: List[str], n_topics: int = 5) -> Dict:
        """
        Extrae temas principales de requisitos
        
        Nota: Implementación simplificada aquí. 
        Para producción, usar BERTopic:
        
        ```python
        from bertopic import BERTopic
        model = BERTopic(language="english")
        topics, probs = model.fit_transform(requirements)
        ```
        
        Args:
            requirements: Lista de requisitos
            n_topics: Número de temas a extraer
            
        Returns:
            Dict con temas y asignaciones
        """
        
        if not requirements:
            return {'topics': [], 'assignments': [], 'message': 'No requirements provided'}
        
        # Análisis simple de palabras clave para demostración
        # En producción: usar BERTopic
        keywords_by_req = []
        for req in requirements:
            keywords = self._extract_keywords(req, top_k=3)
            keywords_by_req.append(keywords)
        
        # Agrupar por similaridad de keywords
        topics = []
        assignments = []
        
        # Tema simple: agrupar por primera palabra clave más frecuente
        from collections import Counter
        all_keywords = [kw for keywords in keywords_by_req for kw in keywords]
        top_keywords = Counter(all_keywords).most_common(n_topics)
        
        for i, req_keywords in enumerate(keywords_by_req):
            # Encontrar tema más similar
            best_topic = 0
            best_overlap = 0
            
            for topic_idx, (top_kw, _) in enumerate(top_keywords):
                if top_kw in req_keywords:
                    best_topic = topic_idx
                    break
            
            assignments.append(best_topic)
        
        # Crear resumen de temas
        for topic_idx, (keyword, frequency) in enumerate(top_keywords):
            topic_reqs = [requirements[i] for i, t in enumerate(assignments) if t == topic_idx]
            topics.append({
                'topic_id': topic_idx,
                'keyword': keyword,
                'frequency': frequency,
                'requirement_count': len(topic_reqs),
                'sample_requirements': topic_reqs[:2]
            })
        
        return {
            'total_topics': len(topics),
            'topics': topics,
            'assignments': assignments,
            'entropy': self._calculate_topic_entropy(assignments, len(topics))
        }
    
    # ================== PRIVATE METHODS ==================
    
    def _detect_ambiguity(self, requirement: str) -> Tuple[float, List[str]]:
        """Detecta términos ambiguos en requisito"""
        req_lower = requirement.lower()
        ambiguous_terms = []
        
        # Buscar términos ambiguos
        for category, terms in self.ambiguity_indicators.items():
            for term in terms:
                if term in req_lower:
                    ambiguous_terms.append(term)
        
        # Score: penalizar por cada término ambiguo
        # 0.0 = muy ambiguo, 1.0 = nada ambiguo
        ambiguity_penalty = len(set(ambiguous_terms)) * 0.15
        ambiguity_score = max(0.0, 1.0 - ambiguity_penalty)
        
        return ambiguity_score, list(set(ambiguous_terms))
    
    def _detect_precision(self, requirement: str) -> Tuple[float, List[str]]:
        """Detecta términos de precisión"""
        req_lower = requirement.lower()
        precise_terms = []
        
        for category, terms in self.precision_keywords.items():
            for term in terms:
                if term in req_lower:
                    precise_terms.append(term)
        
        # Score: bonificar por términos precisos
        precision_score = min(1.0, len(set(precise_terms)) * 0.2)
        
        return precision_score, list(set(precise_terms))
    
    def _analyze_completeness(self, requirement: str) -> Tuple[float, List[str]]:
        """Analiza si el requisito tiene todos los elementos necesarios"""
        req_lower = requirement.lower()
        missing = []
        
        # Buscar elementos clave
        has_what = any(word in req_lower for word in ['the system', 'system', 'application', 'user', 'module'])
        has_how = any(word in req_lower for word in ['by', 'through', 'using', 'via', 'with', 'shall'])
        has_criteria = any(word in req_lower for word in ['within', 'before', 'after', 'when', 'if', '%', 'ms', 'seconds'])
        
        if not has_what:
            missing.append('subject (What?)')
        if not has_how:
            missing.append('action (How?)')
        if not has_criteria:
            missing.append('acceptance criteria (How much?)')
        
        completeness = (len(['x' for x in [has_what, has_how, has_criteria] if x]) / 3.0)
        
        return completeness, missing
    
    def _analyze_complexity(self, requirement: str) -> float:
        """Analiza complejidad (longevidad, condicionales, etc)"""
        words = requirement.split()
        word_count = len(words)
        
        # Penalizar por ser demasiado largo
        length_score = min(1.0, word_count / 50.0)
        
        # Contar condicionales y operadores lógicos
        conditionals = sum(1 for word in requirement.lower().split() if word in ['if', 'when', 'unless', 'and', 'or'])
        conditional_score = min(1.0, conditionals / 5.0)
        
        complexity = (length_score * 0.5) + (conditional_score * 0.5)
        
        return complexity
    
    def _analyze_coherence(self, requirement: str, context: List[str]) -> float:
        """Analiza coherencia con requisitos de contexto"""
        if not context or not self.embedding_model:
            return 1.0
        
        # Calcular similaridad promedio con contexto
        similarities = [self._calculate_similarity(requirement, ctx) for ctx in context]
        
        if not similarities:
            return 1.0
        
        # Coherencia: similaridad promedio
        avg_similarity = np.mean(similarities)
        
        # Si es muy diferente (< 0.3) o muy similar (> 0.95), potencialmente problemático
        if avg_similarity < 0.3:
            coherence = 0.5  # Muy diferente del contexto
        elif avg_similarity > 0.95:
            coherence = 0.7  # Posible duplicado
        else:
            coherence = 0.9  # Coherente
        
        return coherence
    
    def _calculate_similarity(self, text1: str, text2: str) -> float:
        """Calcula similaridad entre dos textos (placeholder)"""
        # En producción: usar embedding cosine similarity
        # Por ahora: simple Jaccard similarity
        set1 = set(text1.lower().split())
        set2 = set(text2.lower().split())
        
        if not set1 and not set2:
            return 1.0
        
        intersection = len(set1 & set2)
        union = len(set1 | set2)
        
        return intersection / union if union > 0 else 0.0
    
    def _extract_keywords(self, text: str, top_k: int = 3) -> List[str]:
        """Extrae palabras clave simples"""
        # Palabras stop básicas
        stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'be', 'by', 'for', 'to', 'of', 'in'}
        
        words = text.lower().split()
        keywords = [w for w in words if w not in stop_words and len(w) > 3]
        
        return keywords[:top_k]
    
    def _generate_clarification_suggestions(self, requirement: str, ambiguous_terms: List[str]) -> List[str]:
        """Genera sugerencias para aclarar requisito"""
        suggestions = []
        
        for term in ambiguous_terms[:3]:
            if term in ['maybe', 'perhaps', 'possibly']:
                suggestions.append(f"Replace '{term}' with specific conditions (if/when)")
            elif term in ['good', 'bad', 'nice']:
                suggestions.append(f"Replace '{term}' with measurable criteria")
            elif term in ['many', 'few']:
                suggestions.append(f"Replace '{term}' with specific number or percentage")
        
        return suggestions
    
    def _calculate_topic_entropy(self, assignments: List[int], n_topics: int) -> float:
        """Calcula entropía de distribución de temas"""
        if not assignments:
            return 0.0
        
        from collections import Counter
        counts = Counter(assignments)
        probabilities = [count / len(assignments) for count in counts.values()]
        
        entropy = -sum(p * np.log(p) for p in probabilities if p > 0)
        
        return round(entropy, 3)


# Funciones de convenience
def calculate_semantic_health(requirement: str, context: Optional[List[str]] = None) -> Dict:
    """Helper: calcula semantic health"""
    analyzer = SemanticAnalyzer()
    return analyzer.calculate_semantic_health(requirement, context)


def detect_ambiguity(requirement: str) -> Dict:
    """Helper: detecta ambigüedad"""
    analyzer = SemanticAnalyzer()
    return analyzer.detect_ambiguity(requirement)


def extract_topics(requirements: List[str], n_topics: int = 5) -> Dict:
    """Helper: extrae temas"""
    analyzer = SemanticAnalyzer()
    return analyzer.extract_topics(requirements, n_topics)
