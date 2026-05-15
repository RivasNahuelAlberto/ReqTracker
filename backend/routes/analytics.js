import express from 'express';
import AnalysisResult from '../models/AnalysisResult.js';

const router = express.Router();
const analyticsUrl = process.env.ANALYTICS_URL || 'http://localhost:8000';

// Quality scoring
router.post('/quality', async (req, res) => {
  try {
    const response = await fetch(`${analyticsUrl}/quality`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Similarity
router.post('/similarity', async (req, res) => {
  try {
    const response = await fetch(`${analyticsUrl}/similarity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Recommendation
router.post('/recommendation', async (req, res) => {
  try {
    const response = await fetch(`${analyticsUrl}/recommendation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Impact prediction
router.post('/impact', async (req, res) => {
  try {
    const response = await fetch(`${analyticsUrl}/impact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Consistency check
router.post('/consistency', async (req, res) => {
  try {
    const response = await fetch(`${analyticsUrl}/consistency`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Helper to proxy or filter analytics service responses
async function proxyAnalyticsService(req, res, path) {
  try {
    const query = Object.keys(req.query).length ? `?${new URLSearchParams(req.query).toString()}` : '';
    const url = `${analyticsUrl}${path}${query}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
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
    
    const response = await fetch(`${analyticsUrl}/health`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error(`[Analytics Health] Status ${response.status} from ${analyticsUrl}/health`);
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
    const url = `${analyticsUrl}/advanced/monitoring/${req.params.projectId}/dashboard${query}`;
    const response = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
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
    const url = `${analyticsUrl}/advanced/monitoring/${req.params.projectId}/dashboard${query}`;
    const response = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    return res.json({
      project_id: req.params.projectId,
      risk_score: data.snapshot?.risk_score,
      consistency_score: data.snapshot?.consistency_score,
      trend: data.trends?.risk_score,
      active_alerts: data.alerts?.active_details || [],
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
    const url = `${analyticsUrl}/advanced/monitoring/${req.params.projectId}/dashboard${query}`;
    const response = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    return res.json({
      project_id: req.params.projectId,
      semantic_health: data.snapshot?.semantic_health,
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
    const response = await fetch(`${analyticsUrl}/compare-entities`, {
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
    const response = await fetch(`${analyticsUrl}/analyze-text`, {
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
    const response = await fetch(`${analyticsUrl}/generate-embeddings`, {
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
    const response = await fetch(`${analyticsUrl}/compare-requirements`, {
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
    const healthResponse = await fetch(`${analyticsUrl}/health`);
    const healthData = await healthResponse.json();

    return res.json({
      service: 'ReqTracker Analytics',
      url: analyticsUrl,
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
      url: analyticsUrl,
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
