"""
ETAPA 4: Prediction Engine - Module Initialization
Motor de predicción de riesgos y detección de anomalías.

Versión: 4.0
"""

from analytics.prediction.prediction_engine import (
    PredictionEngine,
    RiskLevel,
    MissingType,
    InconsistencyType,
    RiskPrediction,
    MissingRequirement,
    Inconsistency,
    PredictionReport,
    get_engine,
    reset_engine
)

from analytics.prediction.routes import (
    router,
    setup_prediction_routes,
    RiskPredictionRequest,
    MissingRequirementsRequest,
    InconsistencyDetectionRequest,
    ComprehensivePredictionRequest
)

__version__ = "4.0"
__all__ = [
    # Core classes
    "PredictionEngine",
    "RiskLevel",
    "MissingType",
    "InconsistencyType",
    
    # Data models
    "RiskPrediction",
    "MissingRequirement",
    "Inconsistency",
    "PredictionReport",
    
    # Factory functions
    "get_engine",
    "reset_engine",
    
    # FastAPI integration
    "router",
    "setup_prediction_routes",
    
    # Request models
    "RiskPredictionRequest",
    "MissingRequirementsRequest",
    "InconsistencyDetectionRequest",
    "ComprehensivePredictionRequest"
]
