"""
ETAPA 9.1: Tool Efficiency Matrix
Analiza la eficiencia de herramientas usadas por agentes IA
"""

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class ToolEfficiencyAnalyzer:
    """Análisis de eficiencia de herramientas del agente"""
    
    def __init__(self):
        # Simulación de datos históricos
        # En producción, esto vendría de una BD
        self.tool_metrics = {}
    
    def analyze_tool_efficiency(self, project_id: str, tool_logs: Optional[List[Dict]] = None) -> Dict[str, Any]:
        """
        Analiza eficiencia de herramientas:
        - Latencia promedio
        - Utilidad (éxito en tareas)
        - Hallucination rate
        - Costo de tokens
        - Frecuencia de uso
        
        Args:
            project_id: ID del proyecto
            tool_logs: Lista de ejecuciones de herramientas
        
        Returns:
            {
                "tools": {
                    "tool_name": {
                        "latency_ms": float,
                        "usefulness_score": 0-1,
                        "hallucination_rate": 0-1,
                        "token_cost": float,
                        "frequency": int,
                        "success_rate": 0-1,
                        "avg_result_quality": 0-1
                    }
                },
                "overall_efficiency": 0-1,
                "recommendations": [...]
            }
        """
        try:
            # Mock data para demostración
            tool_logs = tool_logs or self._get_mock_tool_logs(project_id)
            
            if not tool_logs:
                return {
                    "tools": {},
                    "overall_efficiency": 0.0,
                    "recommendations": ["No tool logs available"]
                }
            
            # Agrupar por herramienta
            tools_data = {}
            for log in tool_logs:
                tool_name = log.get("tool_name", "unknown")
                if tool_name not in tools_data:
                    tools_data[tool_name] = []
                tools_data[tool_name].append(log)
            
            # Calcular métricas por herramienta
            tools_metrics = {}
            for tool_name, logs in tools_data.items():
                metrics = self._calculate_tool_metrics(tool_name, logs)
                tools_metrics[tool_name] = metrics
            
            # Calcular eficiencia general
            overall_efficiency = self._calculate_overall_efficiency(tools_metrics)
            
            # Generar recomendaciones
            recommendations = self._generate_recommendations(tools_metrics)
            
            return {
                "tools": tools_metrics,
                "overall_efficiency": overall_efficiency,
                "recommendations": recommendations,
                "project_id": project_id,
                "timestamp": datetime.utcnow().isoformat()
            }
        
        except Exception as e:
            logger.error(f"Error analyzing tool efficiency: {str(e)}")
            return {
                "error": str(e),
                "tools": {},
                "overall_efficiency": 0.0
            }
    
    def _calculate_tool_metrics(self, tool_name: str, logs: List[Dict]) -> Dict[str, Any]:
        """Calcula métricas para una herramienta específica"""
        
        latencies = [log.get("latency_ms", 0) for log in logs if log.get("latency_ms")]
        successes = [log for log in logs if log.get("status") == "success"]
        usefulness_scores = [log.get("usefulness_score", 0) for log in logs if "usefulness_score" in log]
        token_costs = [log.get("token_cost", 0) for log in logs if "token_cost" in log]
        hallucination_flags = [log for log in logs if log.get("hallucination", False)]
        
        avg_latency = sum(latencies) / len(latencies) if latencies else 0
        success_rate = len(successes) / len(logs) if logs else 0
        avg_usefulness = sum(usefulness_scores) / len(usefulness_scores) if usefulness_scores else 0
        avg_token_cost = sum(token_costs) / len(token_costs) if token_costs else 0
        hallucination_rate = len(hallucination_flags) / len(logs) if logs else 0
        
        # Calcular quality score: combinar multiple factores
        quality_score = (
            min(1.0, success_rate) * 0.4 +      # 40% success rate
            min(1.0, avg_usefulness) * 0.3 +     # 30% usefulness
            max(0, 1 - hallucination_rate) * 0.3  # 30% no hallucinations
        )
        
        return {
            "latency_ms": round(avg_latency, 2),
            "usefulness_score": round(avg_usefulness, 3),
            "hallucination_rate": round(hallucination_rate, 3),
            "token_cost": round(avg_token_cost, 2),
            "frequency": len(logs),
            "success_rate": round(success_rate, 3),
            "avg_result_quality": round(quality_score, 3),
            "confidence": min(1.0, len(logs) / 10)  # Más logs = más confianza
        }
    
    def _calculate_overall_efficiency(self, tools_metrics: Dict) -> float:
        """Calcula eficiencia general de todas las herramientas"""
        
        if not tools_metrics:
            return 0.0
        
        quality_scores = [
            m.get("avg_result_quality", 0) 
            for m in tools_metrics.values()
        ]
        
        if not quality_scores:
            return 0.0
        
        # Promedio ponderado por confianza
        total_weight = 0
        weighted_sum = 0
        
        for tool_name, metrics in tools_metrics.items():
            weight = metrics.get("confidence", 0.5)
            score = metrics.get("avg_result_quality", 0)
            weighted_sum += score * weight
            total_weight += weight
        
        return round(weighted_sum / total_weight if total_weight > 0 else 0, 3)
    
    def _generate_recommendations(self, tools_metrics: Dict) -> List[str]:
        """Genera recomendaciones basadas en métricas"""
        recommendations = []
        
        for tool_name, metrics in tools_metrics.items():
            quality = metrics.get("avg_result_quality", 0)
            hallucination = metrics.get("hallucination_rate", 0)
            latency = metrics.get("latency_ms", 0)
            
            # Herramientas con baja calidad
            if quality < 0.5:
                recommendations.append(f"⚠️  {tool_name} has low quality (score: {quality}). Consider improving or replacing.")
            
            # Herramientas con alto hallucination
            if hallucination > 0.3:
                recommendations.append(f"🚨 {tool_name} has high hallucination rate ({hallucination*100:.1f}%). Needs refinement.")
            
            # Herramientas lentas
            if latency > 5000:  # > 5 segundos
                recommendations.append(f"⏱️  {tool_name} is slow ({latency}ms). Consider caching or optimization.")
        
        if not recommendations:
            recommendations.append("✅ All tools operating within acceptable parameters")
        
        return recommendations
    
    def _get_mock_tool_logs(self, project_id: str) -> List[Dict]:
        """Retorna logs mock para demostración"""
        return [
            {
                "tool_name": "semantic_search",
                "latency_ms": 250,
                "status": "success",
                "usefulness_score": 0.85,
                "token_cost": 150,
                "hallucination": False
            },
            {
                "tool_name": "semantic_search",
                "latency_ms": 280,
                "status": "success",
                "usefulness_score": 0.82,
                "token_cost": 160,
                "hallucination": False
            },
            {
                "tool_name": "graph_analysis",
                "latency_ms": 450,
                "status": "success",
                "usefulness_score": 0.78,
                "token_cost": 200,
                "hallucination": False
            },
            {
                "tool_name": "requirement_prediction",
                "latency_ms": 600,
                "status": "success",
                "usefulness_score": 0.65,
                "token_cost": 250,
                "hallucination": True
            },
            {
                "tool_name": "code_generation",
                "latency_ms": 5000,
                "status": "success",
                "usefulness_score": 0.45,
                "token_cost": 1500,
                "hallucination": True
            }
        ]

def get_tool_efficiency_analyzer():
    """Factory para obtener analyzer singleton"""
    return ToolEfficiencyAnalyzer()
