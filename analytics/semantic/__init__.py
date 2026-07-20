"""
ETAPA 2: Semantic Intelligence Module

Provides advanced semantic analysis of requirements:
- Semantic health scoring
- Ambiguity detection
- Semantic drift detection
- Topic extraction
- Coherence analysis
"""

from .semantic_analyzer import (
    SemanticAnalyzer,
    calculate_semantic_health,
    detect_ambiguity,
    extract_topics
)

from .routes import router, setup_semantic_routes

__all__ = [
    'SemanticAnalyzer',
    'calculate_semantic_health',
    'detect_ambiguity',
    'extract_topics',
    'router',
    'setup_semantic_routes'
]

__version__ = '2.0.0'
__etapa__ = 'ETAPA 2'
