import express from 'express';
import AnalysisResult from '../models/AnalysisResult.js';
import {
  emitProjectAnalyticsUpdated,
  emitProjectGraphRecomputed,
  emitProjectPredictionGenerated,
  emitProjectSemanticDrift,
  emitProjectRiskDetected
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

async function getAnalyticsUrl() {
  if (resolvedAnalyticsUrl) {
    return resolvedAnalyticsUrl;
  }

  if (!configuredAnalyticsUrl) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ANALYTICS_URL is not configured in production. Set ANALYTICS_URL to the public analytics service URL.');
    }
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
        if (candidate !== configuredAnalyticsUrl && configuredAnalyticsUrl) {
          console.warn(`[Analytics Proxy] Falling back to analytics service URL: ${candidate}`);
        }
        return candidate;
      }

      console.warn(`[Analytics Proxy] Candidate ${candidate} returned status ${healthResponse.status}`);
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn(`[Analytics Proxy] Health check timed out for ${candidate}`);
      } else {
        console.warn(`[Analytics Proxy] Cannot reach analytics service at ${candidate}: ${error.message}`);
      }
    }
  }

  const attempted = configuredAnalyticsUrl ? configuredAnalyticsUrl : defaultDevAnalyticsUrls.join(', ');
  throw new Error(`Analytics service unavailable. Tried: ${attempted}`);
}

async function fetchAnalytics(path, options = {}) {
  const baseUrl = await getAnalyticsUrl();
  return fetch(`${baseUrl}${path}`, options);
}

// Quality scoring
router.post('/quality', async (req, res) => {
  try {
    const response = await fetchAnalytics('/quality', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    if (response.ok) {
      emitProjectAnalyticsUpdated(req.body.projectId, {
        endpoint: 'quality',
        message: 'Evaluación de calidad completada.'
      });
    }
    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Similarity
router.post('/similarity', async (req, res) => {
  try {
    const response = await fetchAnalytics('/similarity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    if (response.ok) {
      emitProjectAnalyticsUpdated(req.body.projectId, {
        endpoint: 'similarity',
        message: 'Comparación semántica completada.'
      });
    }
    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Recommendation
router.post('/recommendation', async (req, res) => {
  try {
    const response = await fetchAnalytics('/recommendation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    if (response.ok) {
      emitProjectPredictionGenerated(req.body.projectId, {
        endpoint: 'recommendation',
        message: 'Nueva recomendación generada.',
        prediction: data
      });
    }
    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Impact prediction
router.post('/impact', async (req, res) => {
  try {
    const response = await fetchAnalytics('/impact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    if (response.ok) {
      emitProjectPredictionGenerated(req.body.projectId, {
        endpoint: 'impact',
        message: 'Predicción de impacto generada.',
        prediction: data
      });
    }
    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Consistency check
router.post('/consistency', async (req, res) => {
  try {
    const response = await fetchAnalytics('/consistency', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    if (response.ok) {
      emitProjectAnalyticsUpdated(req.body.projectId, {
        endpoint: 'consistency',
        message: 'Revisión de consistencia completada.'
      });
    }
    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Helper to proxy or filter analytics service responses
async function proxyAnalyticsService(req, res, path) {
  try {
    const query = Object.keys(req.query).length ? `?${new URLSearchParams(req.query).toString()}` : '';
    const serviceUrl = `${await getAnalyticsUrl()}${path}${query}`;
    const response = await fetch(serviceUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    if (response.ok && path.includes('/dashboard')) {
      const projectId = req.params.projectId || req.query.projectId || req.body?.projectId;
      emitProjectAnalyticsUpdated(projectId, {
        endpoint: 'dashboard',
        message: 'Dashboard actualizado en tiempo real'
      });
    }
    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (error) {
    console.error(`[Analytics Proxy] Error calling ${path}: ${error.message}`);
    return res.status(503).json({ status: 'error', message: `Analytics service unavailable: ${error.message}` });
  }
}

// Health check del servicio analytics
router.get('/health', async (req, res) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetchAnalytics('/health', {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const effectiveUrl = await getAnalyticsUrl();
      console.error(`[Analytics Health] Status ${response.status} from ${effectiveUrl}/health`);
      return res.status(response.status).json({
        status: "error",
        message: `Analytics service returned status ${response.status}`
      });
    }
    
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error(`[Analytics Health] Error: ${error.message}`);
    if (error.name === 'AbortError') {
      return res.status(503).json({ status: "error", message: "Analytics service timeout" });
    }
    return res.status(503).json({ status: "error", message: `Cannot reach analytics service: ${error.message}` });
  }
});

// Dashboard API - consumable desde el backend
router.get('/dashboard/:projectId', async (req, res) => {
  return proxyAnalyticsService(req, res, `/advanced/monitoring/${req.params.projectId}/dashboard`);
});

router.get('/graph/:projectId', async (req, res) => {
  try {
    const query = Object.keys(req.query).length ? `?${new URLSearchParams(req.query).toString()}` : '';
    const url = `${await getAnalyticsUrl()}/advanced/monitoring/${req.params.projectId}/dashboard${query}`;
    const response = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    emitProjectGraphRecomputed(req.params.projectId, {
      graph_metrics: data.snapshot?.graph_metrics || {},
      message: 'Grafo recalculado y disponible en tiempo real.'
    });
    return res.json({
      project_id: req.params.projectId,
      graph_metrics: data.snapshot?.graph_metrics || {},
      trends: data.trends || {},
      alerts: data.alerts || {},
      raw_snapshot: data.snapshot || {}
    });
  } catch (error) {
    console.error(`[Analytics Graph] Error: ${error.message}`);
    return res.status(503).json({ status: 'error', message: `Analytics service unavailable: ${error.message}` });
  }
});

router.get('/risk/:projectId', async (req, res) => {
  try {
    const query = Object.keys(req.query).length ? `?${new URLSearchParams(req.query).toString()}` : '';
    const url = `${await getAnalyticsUrl()}/advanced/monitoring/${req.params.projectId}/dashboard${query}`;
    const response = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    const riskScore = data.snapshot?.risk_score;
    const activeAlerts = data.alerts?.active_details || [];
    if ((typeof riskScore === 'number' && riskScore >= 0.7) || (Array.isArray(activeAlerts) && activeAlerts.length > 0)) {
      emitProjectRiskDetected(req.params.projectId, {
        risk_score: riskScore,
        active_alerts: activeAlerts,
        message: 'Riesgo crítico detectado en el dashboard.'
      });
    } else {
      emitProjectAnalyticsUpdated(req.params.projectId, {
        endpoint: 'risk',
        message: 'Revisión de riesgo actualizada.'
      });
    }
    return res.json({
      project_id: req.params.projectId,
      risk_score: riskScore,
      consistency_score: data.snapshot?.consistency_score,
      trend: data.trends?.risk_score,
      active_alerts: activeAlerts,
      summary: data.snapshot || {}
    });
  } catch (error) {
    console.error(`[Analytics Risk] Error: ${error.message}`);
    return res.status(503).json({ status: 'error', message: `Analytics service unavailable: ${error.message}` });
  }
});

router.get('/semantic/:projectId', async (req, res) => {
  try {
    const query = Object.keys(req.query).length ? `?${new URLSearchParams(req.query).toString()}` : '';
    const url = `${await getAnalyticsUrl()}/advanced/monitoring/${req.params.projectId}/dashboard${query}`;
    const response = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    const semanticHealth = data.snapshot?.semantic_health;
    const driftDetected = data.snapshot?.semantic_drift || (typeof semanticHealth === 'number' && semanticHealth < 0.6);
    if (driftDetected) {
      emitProjectSemanticDrift(req.params.projectId, {
        semantic_health: semanticHealth,
        drift_details: data.snapshot?.semantic_drift || {},
        message: 'Se detectó drift semántico en el proyecto.'
      });
    } else {
      emitProjectAnalyticsUpdated(req.params.projectId, {
        endpoint: 'semantic',
        message: 'Salud semántica actualizada.'
      });
    }
    return res.json({
      project_id: req.params.projectId,
      semantic_health: semanticHealth,
      predictions: data.snapshot?.predictions || {},
      quality_history: data.metrics?.quality_history || [],
      summary: data.snapshot || {},
      trends: data.trends || {}
    });
  } catch (error) {
    console.error(`[Analytics Semantic] Error: ${error.message}`);
    return res.status(503).json({ status: 'error', message: `Analytics service unavailable: ${error.message}` });
  }
});

// Comparación de entidades
router.post('/compare-entities', async (req, res) => {
  const startTime = Date.now();

  try {
    const response = await fetchAnalytics('/compare-entities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();

    if (response.ok) {
      // Guardar resultado en base de datos
      const analysisResult = new AnalysisResult({
        analysisType: 'compare-entities',
        input: req.body,
        output: data,
        metadata: {
          processingTime: Date.now() - startTime,
          userId: req.user?.id,
          projectId: req.body.projectId,
          status: 'success'
        },
        similarity: data.similarity
      });

      await analysisResult.save();
    }

    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (error) {
    // Guardar error en base de datos
    const analysisResult = new AnalysisResult({
      analysisType: 'compare-entities',
      input: req.body,
      output: { error: error.message },
      metadata: {
        processingTime: Date.now() - startTime,
        userId: req.user?.id,
        projectId: req.body.projectId,
        status: 'error',
        errorMessage: error.message
      }
    });

    await analysisResult.save().catch(err => console.error('Error saving failed analysis:', err));

    return res.status(500).json({ success: false, error: error.message });
  }
});

// Análisis de texto (NER, keywords, sentiment, summary)
router.post('/analyze-text', async (req, res) => {
  const startTime = Date.now();

  try {
    const response = await fetchAnalytics('/analyze-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();

    if (response.ok) {
      // Guardar resultado en base de datos
      const analysisResult = new AnalysisResult({
        analysisType: 'analyze-text',
        input: req.body,
        output: data,
        metadata: {
          processingTime: Date.now() - startTime,
          userId: req.user?.id,
          projectId: req.body.projectId,
          status: 'success'
        },
        entities: data.entities,
        keywords: data.keywords,
        sentiment: data.sentiment
      });

      await analysisResult.save();
    }

    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (error) {
    // Guardar error en base de datos
    const analysisResult = new AnalysisResult({
      analysisType: 'analyze-text',
      input: req.body,
      output: { error: error.message },
      metadata: {
        processingTime: Date.now() - startTime,
        userId: req.user?.id,
        projectId: req.body.projectId,
        status: 'error',
        errorMessage: error.message
      }
    });

    await analysisResult.save().catch(err => console.error('Error saving failed analysis:', err));

    return res.status(500).json({ success: false, error: error.message });
  }
});

// Generación de embeddings
router.post('/generate-embeddings', async (req, res) => {
  const startTime = Date.now();

  try {
    const response = await fetchAnalytics('/generate-embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();

    if (response.ok) {
      // Preparar embeddings para guardar
      const embeddings = data.embeddings?.map((emb, index) => ({
        text: req.body.texts?.[index] || `Text ${index + 1}`,
        vector: emb,
        model: data.model || 'all-MiniLM-L6-v2'
      })) || [];

      // Guardar resultado en base de datos
      const analysisResult = new AnalysisResult({
        analysisType: 'generate-embeddings',
        input: req.body,
        output: data,
        metadata: {
          processingTime: Date.now() - startTime,
          userId: req.user?.id,
          projectId: req.body.projectId,
          status: 'success'
        },
        embeddings: embeddings
      });

      await analysisResult.save();
    }

    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (error) {
    // Guardar error en base de datos
    const analysisResult = new AnalysisResult({
      analysisType: 'generate-embeddings',
      input: req.body,
      output: { error: error.message },
      metadata: {
        processingTime: Date.now() - startTime,
        userId: req.user?.id,
        projectId: req.body.projectId,
        status: 'error',
        errorMessage: error.message
      }
    });

    await analysisResult.save().catch(err => console.error('Error saving failed analysis:', err));

    return res.status(500).json({ success: false, error: error.message });
  }
});

// Comparación de requisitos
router.post('/compare-requirements', async (req, res) => {
  const startTime = Date.now();

  try {
    const response = await fetchAnalytics('/compare-requirements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();

    if (response.ok) {
      // Guardar resultado en base de datos
      const analysisResult = new AnalysisResult({
        analysisType: 'compare-requirements',
        input: req.body,
        output: data,
        metadata: {
          processingTime: Date.now() - startTime,
          userId: req.user?.id,
          projectId: req.body.projectId,
          status: 'success'
        },
        similarity: data.similarity
      });

      await analysisResult.save();
    }

    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (error) {
    // Guardar error en base de datos
    const analysisResult = new AnalysisResult({
      analysisType: 'compare-requirements',
      input: req.body,
      output: { error: error.message },
      metadata: {
        processingTime: Date.now() - startTime,
        userId: req.user?.id,
        projectId: req.body.projectId,
        status: 'error',
        errorMessage: error.message
      }
    });

    await analysisResult.save().catch(err => console.error('Error saving failed analysis:', err));

    return res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para obtener información del servicio
router.get('/info', async (req, res) => {
  try {
    const healthResponse = await fetchAnalytics('/health');
    const healthData = await healthResponse.json();

    const effectiveUrl = await getAnalyticsUrl();
    return res.json({
      service: 'ReqTracker Analytics',
      url: effectiveUrl,
      status: healthData.status,
      models_loaded: healthData.models_loaded,
      services: healthData.services,
      endpoints: [
        'GET /health',
        'GET /dashboard/:projectId',
        'GET /graph/:projectId',
        'GET /risk/:projectId',
        'GET /semantic/:projectId',
        'POST /compare-entities',
        'POST /analyze-text',
        'POST /generate-embeddings',
        'POST /compare-requirements'
      ]
    });
  } catch (error) {
    return res.status(500).json({
      service: 'ReqTracker Analytics',
      url: configuredAnalyticsUrl || 'not configured',
      status: 'error',
      error: error.message
    });
  }
});

// Historial de análisis por usuario
router.get('/history', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { page = 1, limit = 20, type, projectId } = req.query;

    const query = {};
    if (userId) query['metadata.userId'] = userId;
    if (type) query.analysisType = type;
    if (projectId) query['metadata.projectId'] = projectId;

    const results = await AnalysisResult.find(query)
      .sort({ 'metadata.timestamp': -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('metadata.userId', 'username')
      .populate('metadata.projectId', 'name');

    const total = await AnalysisResult.countDocuments(query);

    res.json({
      results,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Estadísticas de análisis
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user?.id;
    const matchStage = userId ? { 'metadata.userId': userId } : {};

    const stats = await AnalysisResult.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            type: '$analysisType',
            status: '$metadata.status'
          },
          count: { $sum: 1 },
          avgProcessingTime: { $avg: '$metadata.processingTime' },
          lastAnalysis: { $max: '$metadata.timestamp' }
        }
      },
      {
        $group: {
          _id: '$_id.type',
          total: { $sum: '$count' },
          successful: {
            $sum: {
              $cond: [{ $eq: ['$_id.status', 'success'] }, '$count', 0]
            }
          },
          failed: {
            $sum: {
              $cond: [{ $eq: ['$_id.status', 'error'] }, '$count', 0]
            }
          },
          avgProcessingTime: { $avg: '$avgProcessingTime' },
          lastAnalysis: { $max: '$lastAnalysis' }
        }
      }
    ]);

    res.json({ stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Limpiar cache expirado (mantenimiento)
router.post('/clean-cache', async (req, res) => {
  try {
    const result = await AnalysisResult.cleanExpiredCache();
    res.json({
      message: 'Cache limpiado exitosamente',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
