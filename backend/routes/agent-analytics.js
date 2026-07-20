import express from 'express';
import {
  emitProjectAnalyticsUpdated,
  emitAgentReasoningUpdated,
  emitAgentWarning
} from '../socket.js';

const router = express.Router();
const configuredAnalyticsUrl = process.env.ANALYTICS_URL || null;
const defaultDevAnalyticsUrls = [
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'http://localhost:10000',
  'http://127.0.0.1:10000'
];
let resolvedAnalyticsUrl = null;

/**
 * Obtiene URL del servicio analytics
 */
async function getAnalyticsUrl() {
  if (resolvedAnalyticsUrl) {
    return resolvedAnalyticsUrl;
  }

  const candidates = configuredAnalyticsUrl ? [configuredAnalyticsUrl] : defaultDevAnalyticsUrls;

  for (const candidate of candidates) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const healthResponse = await fetch(`${candidate}/health`, {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (healthResponse.ok) {
        resolvedAnalyticsUrl = candidate;
        return candidate;
      }
    } catch (error) {
      // Continue to next candidate
    }
  }

  throw new Error('Analytics service unavailable');
}

/**
 * Fetch desde analytics service
 */
async function fetchAnalytics(path, options = {}) {
  const baseUrl = await getAnalyticsUrl();
  return fetch(`${baseUrl}${path}`, options);
}

// ==================== ETAPA 9 ENDPOINTS ====================

/**
 * POST /api/agent/tool-efficiency
 * Analiza eficiencia de herramientas del agente
 * 
 * Body:
 * {
 *   "project_id": "proj_123",
 *   "tool_logs": [
 *     { "tool_name": "search", "latency_ms": 250, "status": "success", ... },
 *     ...
 *   ]
 * }
 */
router.post('/tool-efficiency', async (req, res) => {
  try {
    const { project_id, tool_logs } = req.body;

    const response = await fetchAnalytics('/agent/tool-efficiency', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id,
        tool_logs
      })
    });

    const data = await response.json();

    if (response.ok) {
      // Emitir evento en tiempo real
      emitProjectAnalyticsUpdated(project_id, {
        endpoint: 'tool-efficiency',
        overall_efficiency: data.overall_efficiency,
        tools_count: Object.keys(data.tools).length,
        message: 'Tool efficiency analysis completed'
      });

      // Emitir advertencias si hay problemas
      const recommendations = data.recommendations || [];
      recommendations.forEach((rec) => {
        if (rec.includes('🚨') || rec.includes('⚠️')) {
          emitAgentWarning(project_id, {
            type: 'tool_efficiency',
            severity: rec.includes('🚨') ? 'high' : 'medium',
            message: rec
          });
        }
      });
    }

    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (error) {
    console.error('Error in tool-efficiency endpoint:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/agent/planner-confidence
 * Calcula puntuación de confianza del planificador
 * 
 * Body:
 * {
 *   "project_id": "proj_123",
 *   "plan_data": { "steps": [...], "decision_points": [...], ... }
 * }
 */
router.post('/planner-confidence', async (req, res) => {
  try {
    const { project_id, plan_data } = req.body;

    const response = await fetchAnalytics('/agent/planner-confidence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id,
        plan_data
      })
    });

    const data = await response.json();

    if (response.ok) {
      emitProjectAnalyticsUpdated(project_id, {
        endpoint: 'planner-confidence',
        overall_score: data.overall_score,
        confidence: data.confidence,
        stability: data.stability,
        message: 'Planner confidence analysis completed'
      });

      // Emitir issues detectados
      if (data.issues && data.issues.length > 0) {
        emitAgentWarning(project_id, {
          type: 'planner_confidence',
          severity: data.overall_score < 0.5 ? 'high' : 'medium',
          issues: data.issues
        });
      }
    }

    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (error) {
    console.error('Error in planner-confidence endpoint:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/agent/reasoning-trace
 * Traza el razonamiento del agente en tiempo real
 * 
 * Body:
 * {
 *   "execution_id": "exec_456",
 *   "reasoning_steps": [
 *     { "action": "parse query", "tool": null, "duration_ms": 50, ... },
 *     ...
 *   ]
 * }
 */
router.post('/reasoning-trace', async (req, res) => {
  try {
    const { execution_id, reasoning_steps, project_id } = req.body;

    const response = await fetchAnalytics('/agent/reasoning-trace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        execution_id,
        reasoning_steps
      })
    });

    const data = await response.json();

    if (response.ok && project_id) {
      // Emitir razonamiento en tiempo real para visualización
      emitAgentReasoningUpdated(project_id, {
        execution_id,
        reasoning_path: data.reasoning_path,
        tools_called: data.tools_called,
        decision_points: data.decision_points,
        summary: data.summary,
        message: 'Agent reasoning trace completed'
      });
    }

    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (error) {
    console.error('Error in reasoning-trace endpoint:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/agent/context-pollution
 * Detecta chunks irrelevantes en el contexto
 * 
 * Body:
 * {
 *   "query": "What are authentication requirements?",
 *   "context_chunks": [
 *     { "id": "chunk_1", "content": "...", "source": "db", "relevance_score": 0.9 },
 *     ...
 *   ],
 *   "project_id": "proj_123"
 * }
 */
router.post('/context-pollution', async (req, res) => {
  try {
    const { query, context_chunks, project_id } = req.body;

    const response = await fetchAnalytics('/agent/context-pollution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        context_chunks,
        project_id
      })
    });

    const data = await response.json();

    if (response.ok && project_id) {
      // Emitir alerta si hay contaminación significativa
      if (data.pollution_detected) {
        emitAgentWarning(project_id, {
          type: 'context_pollution',
          severity: data.pollution_ratio > 0.6 ? 'high' : 'medium',
          pollution_ratio: data.pollution_ratio,
          recommendations: data.recommendations
        });
      }

      emitProjectAnalyticsUpdated(project_id, {
        endpoint: 'context-pollution',
        pollution_detected: data.pollution_detected,
        pollution_ratio: data.pollution_ratio,
        message: 'Context pollution analysis completed'
      });
    }

    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (error) {
    console.error('Error in context-pollution endpoint:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/agent/hallucination-risk
 * Estima riesgo de alucinaciones
 * 
 * Body:
 * {
 *   "prompt": "What are the main security requirements?",
 *   "context": [
 *     { "id": "ctx_1", "content": "...", "source": "db", "relevance_score": 0.9 },
 *     ...
 *   ],
 *   "retrieval_results": [
 *     { "source": "requirements_db", "score": 0.95 },
 *     ...
 *   ],
 *   "project_id": "proj_123"
 * }
 */
router.post('/hallucination-risk', async (req, res) => {
  try {
    const { prompt, context, retrieval_results, project_id } = req.body;

    const response = await fetchAnalytics('/agent/hallucination-risk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        context,
        retrieval_results,
        project_id
      })
    });

    const data = await response.json();

    if (response.ok) {
      // Emitir alerta si el riesgo es alto
      if (data.risk_level === 'risky') {
        emitAgentWarning(project_id, {
          type: 'hallucination_risk',
          severity: 'critical',
          risk_score: data.risk_score,
          risk_level: data.risk_level,
          recommendations: data.recommendations,
          mitigation_strategies: data.mitigation_strategies
        });
      } else if (data.risk_level === 'caution') {
        emitAgentWarning(project_id, {
          type: 'hallucination_risk',
          severity: 'medium',
          risk_score: data.risk_score,
          recommendations: data.recommendations
        });
      }

      if (project_id) {
        emitProjectAnalyticsUpdated(project_id, {
          endpoint: 'hallucination-risk',
          risk_score: data.risk_score,
          risk_level: data.risk_level,
          message: 'Hallucination risk analysis completed'
        });
      }
    }

    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (error) {
    console.error('Error in hallucination-risk endpoint:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/agent/batch-analysis
 * Ejecuta múltiples análisis en una sola petición (optimizado)
 * 
 * Body:
 * {
 *   "project_id": "proj_123",
 *   "include_tool_efficiency": true,
 *   "include_planner_confidence": true,
 *   "include_reasoning_trace": true,
 *   "include_context_pollution": true,
 *   "include_hallucination_risk": true,
 *   "tool_logs": [...],
 *   "plan_data": {...},
 *   "execution_id": "exec_123",
 *   "query": "...",
 *   "prompt": "..."
 * }
 */
router.post('/batch-analysis', async (req, res) => {
  try {
    const { project_id } = req.body;

    const response = await fetchAnalytics('/agent/batch-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();

    if (response.ok && project_id) {
      emitProjectAnalyticsUpdated(project_id, {
        endpoint: 'batch-analysis',
        analyses_completed: Object.keys(data.analyses || {}).length,
        message: 'Batch agent analysis completed'
      });
    }

    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (error) {
    console.error('Error in batch-analysis endpoint:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
