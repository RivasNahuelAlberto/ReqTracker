"""
ETAPA 5: Advanced Features - Module Initialization
Clustering avanzado, forecasting y explainability

Versión: 5.0
"""

from analytics.advanced.clustering_engine import (
    ClusteringEngine,
    ClusterType,
    Cluster,
    ClusteringReport,
    EmergentPattern,
    get_engine as get_clustering_engine,
    reset_engine as reset_clustering_engine
)

from analytics.advanced.forecasting_engine import (
    ForecastingEngine,
    TrendType,
    Forecast,
    Correlation,
    TimeSeriesDataPoint,
    ForecastingReport,
    get_engine as get_forecasting_engine,
    reset_engine as reset_forecasting_engine
)

from analytics.advanced.explainability_engine import (
    ExplainabilityEngine,
    FeatureImportance,
    FeatureContribution,
    PredictionExplanation,
    ModelExplanation,
    ExplainabilityReport,
    get_engine as get_explainability_engine,
    reset_engine as reset_explainability_engine
)

from analytics.advanced.routes import (
    router,
    setup_advanced_routes,
    ClusteringRequest,
    ClusteringResponse,
    ForecastingRequest,
    ForecastingResponse,
    ExplainabilityRequest,
    ExplainabilityResponse
)

__version__ = "5.0"
__all__ = [
    # Clustering
    "ClusteringEngine",
    "ClusterType",
    "Cluster",
    "ClusteringReport",
    "EmergentPattern",
    "get_clustering_engine",
    "reset_clustering_engine",
    
    # Forecasting
    "ForecastingEngine",
    "TrendType",
    "Forecast",
    "Correlation",
    "TimeSeriesDataPoint",
    "ForecastingReport",
    "get_forecasting_engine",
    "reset_forecasting_engine",
    
    # Explainability
    "ExplainabilityEngine",
    "FeatureImportance",
    "FeatureContribution",
    "PredictionExplanation",
    "ModelExplanation",
    "ExplainabilityReport",
    "get_explainability_engine",
    "reset_explainability_engine",
    
    # FastAPI
    "router",
    "setup_advanced_routes",
    
    # Request/Response models
    "ClusteringRequest",
    "ClusteringResponse",
    "ForecastingRequest",
    "ForecastingResponse",
    "ExplainabilityRequest",
    "ExplainabilityResponse"
]
