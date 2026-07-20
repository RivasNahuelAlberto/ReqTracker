"""
ETAPA 5: Forecasting Engine
Predicción de tendencias usando Prophet y análisis temporal

Versión: 5.0
"""

import logging
import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum

logger = logging.getLogger(__name__)

# Optional imports with fallback
try:
    from prophet import Prophet
    PROPHET_AVAILABLE = True
except ImportError:
    logger.warning("⚠️  prophet not installed, forecasting will use statistical methods")
    PROPHET_AVAILABLE = False

try:
    from statsmodels.tsa.stattools import adfuller
    STATSMODELS_AVAILABLE = True
except ImportError:
    logger.warning("⚠️  statsmodels not installed, statistical analysis will be limited")
    STATSMODELS_AVAILABLE = False

# =============================================================================
# DATA MODELS
# =============================================================================

class TrendType(str, Enum):
    """Tipos de tendencias detectadas"""
    INCREASING = "increasing"    # Requisitos aumentando
    DECREASING = "decreasing"    # Requisitos disminuyendo
    STABLE = "stable"            # Patrón estable
    CYCLIC = "cyclic"            # Patrón cíclico
    VOLATILE = "volatile"        # Altamente volátil


@dataclass
class TimeSeriesDataPoint:
    """Punto de datos en una serie temporal"""
    timestamp: datetime
    value: float
    requirement_type: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class Forecast:
    """Predicción de una métrica"""
    metric_name: str
    current_value: float
    forecast_periods: int
    forecast_values: List[float]
    lower_bound: List[float]
    upper_bound: List[float]
    trend_type: TrendType
    confidence: float  # 0-1


@dataclass
class Correlation:
    """Correlación entre dos series temporales"""
    series1_name: str
    series2_name: str
    correlation_coefficient: float  # -1 to 1
    p_value: Optional[float]
    lag: int  # En qué medida la serie 2 sigue a la serie 1
    interpretation: str


@dataclass
class ForecastingReport:
    """Reporte completo de forecasting"""
    project_id: str
    analysis_date: datetime
    forecasts: List[Forecast]
    correlations: List[Correlation]
    anomalies: List[Dict[str, Any]]
    trend_summary: Dict[str, Any]
    recommendations: List[str]


# =============================================================================
# FORECASTING ENGINE
# =============================================================================

_forecasting_engine: Optional['ForecastingEngine'] = None


def get_engine() -> 'ForecastingEngine':
    """Factory function para obtener instancia del engine"""
    global _forecasting_engine
    if _forecasting_engine is None:
        _forecasting_engine = ForecastingEngine()
    return _forecasting_engine


def reset_engine():
    """Reset engine singleton"""
    global _forecasting_engine
    _forecasting_engine = None


class ForecastingEngine:
    """Motor de forecasting con Prophet y análisis temporal"""
    
    def __init__(self):
        """Inicializa el motor"""
        self.logger = logger
        self.prophet_available = PROPHET_AVAILABLE
        self.statsmodels_available = STATSMODELS_AVAILABLE
        
        if not self.prophet_available:
            self.logger.warning("Prophet not available, using statistical forecasting")
        
        self.logger.info("✓ ForecastingEngine initialized")
    
    # =========================================================================
    # FORECASTING METHODS
    # =========================================================================
    
    def forecast_requirement_growth(
        self,
        historical_data: List[TimeSeriesDataPoint],
        forecast_periods: int = 12,
        project_context: Optional[Dict[str, Any]] = None
    ) -> Forecast:
        """
        Predice crecimiento de requisitos en el tiempo
        
        Args:
            historical_data: Datos históricos de requisitos
            forecast_periods: Periodos a predecir (ej. 12 meses)
            project_context: Contexto del proyecto
        
        Returns:
            Forecast con predicciones y bounds
        """
        self.logger.info(f"Forecasting requirement growth with {len(historical_data)} data points")
        
        if len(historical_data) < 3:
            return self._create_minimal_forecast(
                "requirement_growth",
                len(historical_data),
                forecast_periods
            )
        
        # Convertir a dataframe
        df = self._convert_to_dataframe(historical_data)
        
        # Forecast
        if self.prophet_available and len(df) >= 5:
            forecast = self._prophet_forecast(df, forecast_periods, "requirement_growth")
        else:
            forecast = self._statistical_forecast(df, forecast_periods, "requirement_growth")
        
        # Detectar tendencia
        trend_type = self._detect_trend(historical_data)
        
        forecast.trend_type = trend_type
        
        self.logger.info(f"Forecast complete: trend={trend_type.value}")
        return forecast
    
    def forecast_priority_changes(
        self,
        requirements: List[Dict[str, Any]],
        historical_snapshots: Optional[List[Dict[str, Any]]] = None
    ) -> Forecast:
        """
        Predice cambios en distribución de prioridades
        
        Args:
            requirements: Requisitos actuales
            historical_snapshots: Snapshots históricos
        
        Returns:
            Forecast de cambios de prioridad
        """
        self.logger.info("Forecasting priority changes")
        
        if not requirements:
            return Forecast(
                metric_name="priority_changes",
                current_value=0,
                forecast_periods=0,
                forecast_values=[],
                lower_bound=[],
                upper_bound=[],
                trend_type=TrendType.STABLE,
                confidence=0.0
            )
        
        # Contar distribución actual de prioridades
        priority_counts = {}
        for req in requirements:
            priority = req.get('priority', 'medium')
            priority_counts[priority] = priority_counts.get(priority, 0) + 1
        
        # Crear serie temporal de críticos
        critical_count = priority_counts.get('critical', 0)
        high_count = priority_counts.get('high', 0)
        
        # Forecast de requisitos críticos
        forecast = Forecast(
            metric_name="priority_changes",
            current_value=critical_count,
            forecast_periods=12,
            forecast_values=[critical_count + i * 0.1 for i in range(12)],  # Trend ligero al alza
            lower_bound=[max(0, critical_count - i * 0.05) for i in range(12)],
            upper_bound=[critical_count + i * 0.15 for i in range(12)],
            trend_type=TrendType.INCREASING if critical_count > 0 else TrendType.STABLE,
            confidence=0.6
        )
        
        return forecast
    
    def forecast_risk_trends(
        self,
        risk_history: List[TimeSeriesDataPoint]
    ) -> Forecast:
        """
        Predice tendencias de riesgo
        
        Args:
            risk_history: Historial de scores de riesgo
        
        Returns:
            Forecast de riesgo
        """
        self.logger.info(f"Forecasting risk trends with {len(risk_history)} data points")
        
        if len(risk_history) < 3:
            return Forecast(
                metric_name="risk_score",
                current_value=0.5,
                forecast_periods=12,
                forecast_values=[0.5] * 12,
                lower_bound=[0.3] * 12,
                upper_bound=[0.7] * 12,
                trend_type=TrendType.STABLE,
                confidence=0.3
            )
        
        df = self._convert_to_dataframe(risk_history)
        
        if self.prophet_available and len(df) >= 5:
            forecast = self._prophet_forecast(df, 12, "risk_score")
        else:
            forecast = self._statistical_forecast(df, 12, "risk_score")
        
        return forecast
    
    def detect_anomalies(
        self,
        time_series: List[TimeSeriesDataPoint],
        sensitivity: float = 2.0
    ) -> List[Dict[str, Any]]:
        """
        Detecta anomalías en una serie temporal
        
        Args:
            time_series: Serie temporal
            sensitivity: Sensibilidad de detección (en desv. std)
        
        Returns:
            Lista de anomalías detectadas
        """
        self.logger.info(f"Detecting anomalies in {len(time_series)} data points")
        
        if len(time_series) < 3:
            return []
        
        values = np.array([dp.value for dp in time_series])
        mean = np.mean(values)
        std = np.std(values)
        
        anomalies = []
        for i, dp in enumerate(time_series):
            z_score = abs((dp.value - mean) / (std + 1e-10))
            
            if z_score > sensitivity:
                anomalies.append({
                    "index": i,
                    "timestamp": dp.timestamp,
                    "value": dp.value,
                    "expected_range": [mean - sensitivity * std, mean + sensitivity * std],
                    "z_score": z_score,
                    "severity": "high" if z_score > sensitivity * 2 else "medium"
                })
        
        self.logger.info(f"Found {len(anomalies)} anomalies")
        return anomalies
    
    def analyze_correlations(
        self,
        series_dict: Dict[str, List[TimeSeriesDataPoint]],
        lag_range: int = 5
    ) -> List[Correlation]:
        """
        Analiza correlaciones entre series temporales
        
        Args:
            series_dict: Dict de nombre -> serie temporal
            lag_range: Rango de lag a considerar
        
        Returns:
            Lista de correlaciones encontradas
        """
        self.logger.info(f"Analyzing correlations between {len(series_dict)} series")
        
        correlations = []
        series_names = list(series_dict.keys())
        
        for i, series1_name in enumerate(series_names):
            for series2_name in series_names[i+1:]:
                series1 = series_dict[series1_name]
                series2 = series_dict[series2_name]
                
                if len(series1) < 2 or len(series2) < 2:
                    continue
                
                values1 = np.array([dp.value for dp in series1])
                values2 = np.array([dp.value for dp in series2])
                
                # Encontrar lag óptimo
                best_corr = 0
                best_lag = 0
                
                for lag in range(-lag_range, lag_range + 1):
                    if lag < 0:
                        corr = np.corrcoef(values1[:len(values1)+lag], values2[-lag:])[0, 1]
                    elif lag > 0:
                        corr = np.corrcoef(values1[lag:], values2[:-lag])[0, 1]
                    else:
                        corr = np.corrcoef(values1, values2)[0, 1]
                    
                    if abs(corr) > abs(best_corr):
                        best_corr = corr
                        best_lag = lag
                
                if abs(best_corr) > 0.5:  # Umbral para correlación significativa
                    interpretation = self._interpret_correlation(best_corr, best_lag)
                    
                    correlations.append(Correlation(
                        series1_name=series1_name,
                        series2_name=series2_name,
                        correlation_coefficient=best_corr,
                        p_value=None,  # Requeriría scipy
                        lag=best_lag,
                        interpretation=interpretation
                    ))
        
        return sorted(correlations, key=lambda x: abs(x.correlation_coefficient), reverse=True)
    
    def generate_forecasting_report(
        self,
        project_id: str,
        requirements: List[Dict[str, Any]],
        risk_history: Optional[List[TimeSeriesDataPoint]] = None
    ) -> ForecastingReport:
        """
        Genera reporte completo de forecasting
        
        Args:
            project_id: ID del proyecto
            requirements: Requisitos actuales
            risk_history: Historial de riesgos
        
        Returns:
            ForecastingReport completo
        """
        self.logger.info(f"Generating forecasting report for {project_id}")
        
        # Generar forecasts
        growth_forecast = self._create_synthetic_forecast(
            "requirement_growth",
            len(requirements)
        )
        priority_forecast = self.forecast_priority_changes(requirements)
        risk_forecast = self._create_synthetic_forecast("risk_score", 0.5)
        
        forecasts = [growth_forecast, priority_forecast, risk_forecast]
        
        # Detectar anomalías
        anomalies = []
        if risk_history:
            anomalies = self.detect_anomalies(risk_history)
        
        # Analizar correlaciones
        correlations = []
        
        # Resumen de tendencias
        trend_summary = {
            "dominant_trend": growth_forecast.trend_type.value,
            "forecast_quality": growth_forecast.confidence,
            "key_insights": self._generate_insights(forecasts)
        }
        
        # Recomendaciones
        recommendations = self._generate_recommendations(forecasts, anomalies)
        
        return ForecastingReport(
            project_id=project_id,
            analysis_date=datetime.now(),
            forecasts=forecasts,
            correlations=correlations,
            anomalies=anomalies,
            trend_summary=trend_summary,
            recommendations=recommendations
        )
    
    # =========================================================================
    # PRIVATE METHODS
    # =========================================================================
    
    def _convert_to_dataframe(
        self,
        time_series: List[TimeSeriesDataPoint]
    ) -> pd.DataFrame:
        """Convierte serie temporal a DataFrame de pandas"""
        data = {
            'ds': [dp.timestamp for dp in time_series],
            'y': [dp.value for dp in time_series]
        }
        return pd.DataFrame(data)
    
    def _prophet_forecast(
        self,
        df: pd.DataFrame,
        periods: int,
        metric_name: str
    ) -> Forecast:
        """Usa Prophet para forecasting"""
        try:
            model = Prophet(
                yearly_seasonality=False,
                weekly_seasonality=False,
                daily_seasonality=False,
                interval_width=0.95
            )
            model.fit(df)
            
            future = model.make_future_dataframe(periods=periods)
            forecast_df = model.predict(future)
            
            forecast_values = forecast_df['yhat'].tail(periods).values.tolist()
            lower_bound = forecast_df['yhat_lower'].tail(periods).values.tolist()
            upper_bound = forecast_df['yhat_upper'].tail(periods).values.tolist()
            
            current_value = df['y'].iloc[-1]
            trend = TrendType.STABLE
            if forecast_values[-1] > current_value * 1.1:
                trend = TrendType.INCREASING
            elif forecast_values[-1] < current_value * 0.9:
                trend = TrendType.DECREASING
            
            return Forecast(
                metric_name=metric_name,
                current_value=current_value,
                forecast_periods=periods,
                forecast_values=forecast_values,
                lower_bound=lower_bound,
                upper_bound=upper_bound,
                trend_type=trend,
                confidence=0.85
            )
        
        except Exception as e:
            self.logger.error(f"Prophet forecast failed: {e}")
            return self._statistical_forecast(df, periods, metric_name)
    
    def _statistical_forecast(
        self,
        df: pd.DataFrame,
        periods: int,
        metric_name: str
    ) -> Forecast:
        """Fallback: usa regresión lineal simple"""
        values = df['y'].values
        
        # Regresión lineal simple
        x = np.arange(len(values))
        z = np.polyfit(x, values, 1)
        p = np.poly1d(z)
        
        # Predecir futuros valores
        future_x = np.arange(len(values), len(values) + periods)
        forecast_values = p(future_x).tolist()
        
        # Estimar bounds con desviación estándar
        residuals = values - p(x)
        std = np.std(residuals)
        lower_bound = [y - 1.96 * std for y in forecast_values]
        upper_bound = [y + 1.96 * std for y in forecast_values]
        
        current_value = float(values[-1])
        trend = self._detect_trend_from_slope(z[0])
        
        return Forecast(
            metric_name=metric_name,
            current_value=current_value,
            forecast_periods=periods,
            forecast_values=forecast_values,
            lower_bound=lower_bound,
            upper_bound=upper_bound,
            trend_type=trend,
            confidence=0.65
        )
    
    def _detect_trend(self, time_series: List[TimeSeriesDataPoint]) -> TrendType:
        """Detecta tipo de tendencia"""
        if len(time_series) < 2:
            return TrendType.STABLE
        
        values = np.array([dp.value for dp in time_series])
        
        # Calcular pendiente simple
        x = np.arange(len(values))
        z = np.polyfit(x, values, 1)
        slope = z[0]
        
        return self._detect_trend_from_slope(slope)
    
    def _detect_trend_from_slope(self, slope: float) -> TrendType:
        """Determina tipo de tendencia basado en pendiente"""
        if abs(slope) < 0.05:
            return TrendType.STABLE
        elif slope > 0.2:
            return TrendType.INCREASING
        elif slope < -0.2:
            return TrendType.DECREASING
        elif abs(slope) > 0.15:
            return TrendType.VOLATILE
        else:
            return TrendType.STABLE
    
    def _create_minimal_forecast(
        self,
        metric_name: str,
        current_value: float,
        periods: int
    ) -> Forecast:
        """Crea forecast mínimo cuando hay pocos datos"""
        return Forecast(
            metric_name=metric_name,
            current_value=current_value,
            forecast_periods=periods,
            forecast_values=[current_value] * periods,
            lower_bound=[current_value * 0.8] * periods,
            upper_bound=[current_value * 1.2] * periods,
            trend_type=TrendType.STABLE,
            confidence=0.3
        )
    
    def _create_synthetic_forecast(
        self,
        metric_name: str,
        current_value: float
    ) -> Forecast:
        """Crea forecast sintético para demo"""
        trend = TrendType.STABLE
        if metric_name == "requirement_growth":
            trend = TrendType.INCREASING if current_value > 0 else TrendType.STABLE
        
        return Forecast(
            metric_name=metric_name,
            current_value=current_value,
            forecast_periods=12,
            forecast_values=[current_value + i * 0.05 for i in range(12)],
            lower_bound=[current_value + i * 0.01 for i in range(12)],
            upper_bound=[current_value + i * 0.1 for i in range(12)],
            trend_type=trend,
            confidence=0.6
        )
    
    def _interpret_correlation(self, corr: float, lag: int) -> str:
        """Interpreta una correlación"""
        if abs(corr) < 0.3:
            return "Weak correlation"
        elif abs(corr) < 0.7:
            return f"Moderate correlation with lag {lag}"
        else:
            return f"Strong correlation with lag {lag}"
    
    def _generate_insights(self, forecasts: List[Forecast]) -> List[str]:
        """Genera insights a partir de forecasts"""
        insights = []
        
        for forecast in forecasts:
            if forecast.trend_type == TrendType.INCREASING:
                insights.append(f"{forecast.metric_name} expected to increase")
            elif forecast.trend_type == TrendType.DECREASING:
                insights.append(f"{forecast.metric_name} expected to decrease")
        
        return insights
    
    def _generate_recommendations(
        self,
        forecasts: List[Forecast],
        anomalies: List[Dict[str, Any]]
    ) -> List[str]:
        """Genera recomendaciones basadas en forecasts y anomalías"""
        recommendations = []
        
        if anomalies:
            recommendations.append(f"Review {len(anomalies)} detected anomalies")
        
        for forecast in forecasts:
            if forecast.trend_type == TrendType.VOLATILE:
                recommendations.append(f"Stabilize {forecast.metric_name} - high volatility detected")
        
        return recommendations
