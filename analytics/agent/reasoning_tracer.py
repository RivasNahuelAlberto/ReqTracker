"""
ETAPA 9.3: Reasoning Path Visualization
Traza y visualiza el razonamiento del agente en tiempo real
"""

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime

logger = logging.getLogger(__name__)

class ReasoningTracer:
    """Traza y visualiza el razonamiento del agente"""
    
    def trace_agent_reasoning(self, 
                             execution_id: str,
                             reasoning_steps: Optional[List[Dict]] = None) -> Dict[str, Any]:
        """
        Traza el camino de razonamiento del agente:
        - reasoning_path: pasos del razonamiento
        - tools_called: herramientas utilizadas
        - chunks_used: fragmentos de contexto usados
        - decision_points: puntos donde el agente decidió entre opciones
        
        Args:
            execution_id: ID de la ejecución del agente
            reasoning_steps: Pasos registrados durante la ejecución
        
        Returns:
            {
                "execution_id": str,
                "reasoning_path": [
                    {
                        "step_number": int,
                        "action": str,
                        "tool_used": str,
                        "context": {...},
                        "result": {...},
                        "time_ms": int,
                        "tokens_used": int
                    }
                ],
                "tools_called": ["tool1", "tool2", ...],
                "chunks_used": [...],
                "decision_points": [
                    {
                        "point": int,
                        "question": str,
                        "options": [...],
                        "chosen": str,
                        "confidence": 0-1
                    }
                ],
                "visualization": {...}  # Para graficar
            }
        """
        try:
            reasoning_steps = reasoning_steps or self._get_mock_reasoning_steps()
            
            # Procesar pasos
            reasoning_path = self._build_reasoning_path(reasoning_steps)
            
            # Extraer herramientas
            tools_called = self._extract_tools(reasoning_path)
            
            # Extraer chunks de contexto
            chunks_used = self._extract_chunks(reasoning_path)
            
            # Detectar puntos de decisión
            decision_points = self._detect_decision_points(reasoning_path)
            
            # Generar visualización
            visualization = self._generate_visualization(reasoning_path, decision_points)
            
            return {
                "execution_id": execution_id,
                "reasoning_path": reasoning_path,
                "tools_called": tools_called,
                "chunks_used": chunks_used,
                "decision_points": decision_points,
                "visualization": visualization,
                "summary": self._generate_summary(reasoning_path),
                "timestamp": datetime.utcnow().isoformat()
            }
        
        except Exception as e:
            logger.error(f"Error tracing reasoning: {str(e)}")
            return {
                "error": str(e),
                "execution_id": execution_id,
                "reasoning_path": []
            }
    
    def _build_reasoning_path(self, steps: List[Dict]) -> List[Dict]:
        """Construye el camino de razonamiento"""
        path = []
        total_time = 0
        total_tokens = 0
        
        for i, step in enumerate(steps):
            processed_step = {
                "step_number": i + 1,
                "action": step.get("action", "unknown"),
                "tool_used": step.get("tool", None),
                "context": step.get("context", {}),
                "result": step.get("result", {}),
                "time_ms": step.get("duration_ms", 0),
                "tokens_used": step.get("tokens", 0),
                "reasoning": step.get("reasoning", ""),
                "confidence": step.get("confidence", 0.5)
            }
            path.append(processed_step)
            total_time += processed_step["time_ms"]
            total_tokens += processed_step["tokens_used"]
        
        # Agregar metadata
        if path:
            path[0]["is_first"] = True
            path[-1]["is_final"] = True
        
        return path
    
    def _extract_tools(self, reasoning_path: List[Dict]) -> List[str]:
        """Extrae lista única de herramientas utilizadas"""
        tools = []
        seen = set()
        
        for step in reasoning_path:
            tool = step.get("tool_used")
            if tool and tool not in seen:
                tools.append(tool)
                seen.add(tool)
        
        return tools
    
    def _extract_chunks(self, reasoning_path: List[Dict]) -> List[Dict]:
        """Extrae chunks de contexto utilizados"""
        chunks = []
        seen = set()
        
        for step in reasoning_path:
            context = step.get("context", {})
            retrieved_chunks = context.get("chunks", [])
            
            for chunk in retrieved_chunks:
                chunk_id = chunk.get("id")
                if chunk_id and chunk_id not in seen:
                    chunks.append({
                        "chunk_id": chunk_id,
                        "content": chunk.get("content", ""),
                        "relevance": chunk.get("relevance_score", 0),
                        "used_in_step": step.get("step_number"),
                        "source": chunk.get("source", "unknown")
                    })
                    seen.add(chunk_id)
        
        return chunks
    
    def _detect_decision_points(self, reasoning_path: List[Dict]) -> List[Dict]:
        """Detecta puntos donde el agente tuvo que decidir entre opciones"""
        decision_points = []
        
        for i, step in enumerate(reasoning_path):
            # Un decision point es cuando hay múltiples opciones disponibles
            alternatives = step.get("context", {}).get("alternatives", [])
            if len(alternatives) > 1:
                decision_points.append({
                    "point_number": len(decision_points) + 1,
                    "step": step.get("step_number"),
                    "question": f"Which approach for: {step.get('action')}?",
                    "options": alternatives,
                    "chosen": step.get("reasoning", ""),
                    "confidence": step.get("confidence", 0.5),
                    "impact": "medium"  # low, medium, high
                })
        
        return decision_points
    
    def _generate_visualization(self, reasoning_path: List[Dict], decision_points: List[Dict]) -> Dict:
        """Genera datos para visualización gráfica"""
        
        # Timeline
        timeline = []
        cumulative_time = 0
        for step in reasoning_path:
            duration = step.get("time_ms", 0)
            timeline.append({
                "step": step.get("step_number"),
                "action": step.get("action"),
                "start_time": cumulative_time,
                "duration": duration,
                "tool": step.get("tool_used"),
                "confidence": step.get("confidence")
            })
            cumulative_time += duration
        
        # Tree representation
        tree_nodes = [
            {
                "id": f"step_{s['step_number']}",
                "label": f"Step {s['step_number']}: {s['action'][:30]}",
                "tool": s.get("tool_used"),
                "time": s.get("time_ms"),
                "confidence": s.get("confidence")
            }
            for s in reasoning_path
        ]
        
        tree_edges = [
            {"from": f"step_{i['step_number']}", "to": f"step_{reasoning_path[i['step_number']]['step_number']}"}
            for i in reasoning_path[:-1]
        ]
        
        return {
            "timeline": timeline,
            "tree": {
                "nodes": tree_nodes,
                "edges": tree_edges
            },
            "decision_points": [
                {
                    "id": f"decision_{dp['point_number']}",
                    "step": dp.get("step"),
                    "label": dp.get("question"),
                    "chosen": dp.get("chosen")
                }
                for dp in decision_points
            ]
        }
    
    def _generate_summary(self, reasoning_path: List[Dict]) -> Dict:
        """Genera resumen de la ejecución"""
        
        total_steps = len(reasoning_path)
        total_time = sum(s.get("time_ms", 0) for s in reasoning_path)
        total_tokens = sum(s.get("tokens_used", 0) for s in reasoning_path)
        avg_confidence = (
            sum(s.get("confidence", 0) for s in reasoning_path) / total_steps 
            if total_steps > 0 else 0
        )
        
        return {
            "total_steps": total_steps,
            "total_time_ms": total_time,
            "total_tokens": total_tokens,
            "average_confidence": round(avg_confidence, 3),
            "efficiency": round(total_tokens / max(total_time, 1), 3)  # tokens per ms
        }
    
    def _get_mock_reasoning_steps(self) -> List[Dict]:
        """Retorna steps mock para demostración"""
        return [
            {
                "action": "Parse user query",
                "tool": None,
                "duration_ms": 50,
                "tokens": 10,
                "confidence": 0.95,
                "reasoning": "Query is clear and well-formed",
                "context": {
                    "chunks": [
                        {"id": "chunk_1", "content": "Project metadata", "relevance_score": 0.8, "source": "db"}
                    ],
                    "alternatives": []
                }
            },
            {
                "action": "Retrieve semantic context",
                "tool": "semantic_search",
                "duration_ms": 250,
                "tokens": 100,
                "confidence": 0.85,
                "reasoning": "Search for requirements context",
                "context": {
                    "chunks": [
                        {"id": "chunk_2", "content": "Requirement definition", "relevance_score": 0.9, "source": "db"},
                        {"id": "chunk_3", "content": "Similar requirements", "relevance_score": 0.7, "source": "db"}
                    ],
                    "alternatives": ["Use graph", "Use embeddings"]
                }
            },
            {
                "action": "Analyze requirements",
                "tool": "graph_analysis",
                "duration_ms": 400,
                "tokens": 200,
                "confidence": 0.75,
                "reasoning": "Build dependency graph",
                "context": {
                    "chunks": [
                        {"id": "chunk_4", "content": "Requirement dependencies", "relevance_score": 0.88, "source": "db"}
                    ],
                    "alternatives": []
                }
            },
            {
                "action": "Generate predictions",
                "tool": "requirement_prediction",
                "duration_ms": 600,
                "tokens": 300,
                "confidence": 0.65,
                "reasoning": "Use ML model for risk prediction",
                "context": {
                    "chunks": [
                        {"id": "chunk_5", "content": "Historical requirements", "relevance_score": 0.6, "source": "db"}
                    ],
                    "alternatives": ["Quick heuristics", "Full model", "Cached results"]
                }
            },
            {
                "action": "Format response",
                "tool": None,
                "duration_ms": 100,
                "tokens": 50,
                "confidence": 0.95,
                "reasoning": "Prepare final output",
                "context": {
                    "chunks": [],
                    "alternatives": []
                }
            }
        ]

def get_reasoning_tracer():
    """Factory para obtener tracer singleton"""
    return ReasoningTracer()
