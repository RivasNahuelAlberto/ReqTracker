import express from 'express';
import {
  promoteRequirement,
  promoteSymbol,
  promotePattern,
  getTopKnowledge,
  searchKnowledge,
  getKnowledgeSummary,
  pruneKnowledge
} from '../ai/knowledge/knowledge.service.js';
import StructuredLogger from '../ai/logger/structured.logger.js';

const logger = new StructuredLogger('knowledge-controller');
const router = express.Router();

/**
 * Query the knowledge base
 */
export async function queryKnowledge(req, res) {
  try {
    const { projectId, query, type, limit = 5 } = req.body;

    if (!projectId || !query) {
      logger.warn('Invalid query parameters', { projectId, query });
      return res.status(400).json({ error: 'projectId y query son requeridos.' });
    }

    logger.info('Querying knowledge base', { projectId, query });

    const results = await searchKnowledge({ projectId, query, limit });

    res.json({
      success: true,
      query,
      results: results.map(r => ({
        id: r._id?.toString(),
        type: r.type,
        content: r.content,
        quality_score: r.quality_score,
        consistency_score: r.consistency_score,
        usageCount: r.usageCount,
        tags: r.tags,
        promotionReason: r.promotionReason
      })),
      count: results.length
    });
  } catch (error) {
    logger.error('Knowledge query failed', { error: error.message });
    res.status(500).json({ error: 'Error al consultar knowledge base' });
  }
}

/**
 * Get knowledge summary for a project
 */
export async function getKnowledge(req, res) {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      logger.warn('Missing projectId');
      return res.status(400).json({ error: 'projectId es requerido.' });
    }

    logger.info('Fetching knowledge summary', { projectId });

    const summary = await getKnowledgeSummary({ projectId });

    res.json({
      success: true,
      projectId,
      summary
    });
  } catch (error) {
    logger.error('Failed to fetch knowledge summary', { error: error.message });
    res.status(500).json({ error: 'Error al obtener resumen de knowledge base' });
  }
}

/**
 * Get top insights/patterns
 */
export async function getTopKnowledgeInsights(req, res) {
  try {
    const { projectId } = req.params;
    const { type, limit = 10 } = req.query;

    if (!projectId) {
      logger.warn('Missing projectId');
      return res.status(400).json({ error: 'projectId es requerido.' });
    }

    logger.info('Fetching top knowledge insights', { projectId, type, limit });

    const insights = await getTopKnowledge({
      projectId,
      type: type || null,
      limit: parseInt(limit) || 10
    });

    res.json({
      success: true,
      projectId,
      insights: insights.map(i => ({
        id: i._id?.toString(),
        type: i.type,
        content: i.content,
        quality_score: i.quality_score,
        consistency_score: i.consistency_score,
        frequency: i.frequency,
        usageCount: i.usageCount,
        promotionReason: i.promotionReason,
        tags: i.tags
      })),
      count: insights.length
    });
  } catch (error) {
    logger.error('Failed to fetch top insights', { error: error.message });
    res.status(500).json({ error: 'Error al obtener insights principales' });
  }
}

/**
 * Manually promote a requirement to knowledge base
 */
export async function promoteRequirementToKnowledge(req, res) {
  try {
    const { projectId, requirementId, reason = 'validated' } = req.body;

    if (!projectId || !requirementId) {
      logger.warn('Missing required parameters', { projectId, requirementId });
      return res.status(400).json({ error: 'projectId y requirementId son requeridos.' });
    }

    logger.info('Promoting requirement to knowledge base', { projectId, requirementId, reason });

    const project = await Project.findById(projectId);
    
    if (!project) {
      return res.status(404).json({ error: 'Proyecto no encontrado.' });
    }

    const requirement = await RequirementModel.findOne({ _id: requirementId, project: projectId });
    if (!requirement) {
      return res.status(404).json({ error: 'Requisito no encontrado.' });
    }

    const entry = await promoteRequirement({
      projectId,
      requirement,
      reason
    });

    if (!entry) {
      return res.status(500).json({ error: 'No se pudo promocionar el requisito.' });
    }

    res.json({
      success: true,
      message: 'Requisito promocionado a knowledge base',
      entry: {
        id: entry._id?.toString(),
        type: entry.type,
        content: entry.content,
        quality_score: entry.quality_score,
        promotionReason: entry.promotionReason
      }
    });
  } catch (error) {
    logger.error('Failed to promote requirement', { error: error.message });
    res.status(500).json({ error: 'Error al promocionar requisito' });
  }
}

/**
 * Manually promote a symbol to knowledge base
 */
export async function promoteSymbolToKnowledge(req, res) {
  try {
    const { projectId, symbolId, reason = 'validated' } = req.body;

    if (!projectId || !symbolId) {
      logger.warn('Missing required parameters', { projectId, symbolId });
      return res.status(400).json({ error: 'projectId y symbolId son requeridos.' });
    }

    logger.info('Promoting symbol to knowledge base', { projectId, symbolId, reason });

    const SymbolModel = require('../../models/Symbol.js').default || require('../../models/Symbol.js');
    const symbol = await SymbolModel.findOne({ _id: symbolId, project: projectId });
    
    if (!symbol) {
      return res.status(404).json({ error: 'Símbolo no encontrado.' });
    }

    const entry = await promoteSymbol({
      projectId,
      symbol,
      reason
    });

    if (!entry) {
      return res.status(500).json({ error: 'No se pudo promocionar el símbolo.' });
    }

    res.json({
      success: true,
      message: 'Símbolo promocionado a knowledge base',
      entry: {
        id: entry._id?.toString(),
        type: entry.type,
        content: entry.content,
        quality_score: entry.quality_score,
        promotionReason: entry.promotionReason
      }
    });
  } catch (error) {
    logger.error('Failed to promote symbol', { error: error.message });
    res.status(500).json({ error: 'Error al promocionar símbolo' });
  }
}

/**
 * Prune expired and low-quality knowledge
 */
export async function pruneProjectKnowledge(req, res) {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      logger.warn('Missing projectId');
      return res.status(400).json({ error: 'projectId es requerido.' });
    }

    logger.info('Pruning project knowledge', { projectId });

    const deletedCount = await pruneKnowledge({ projectId });

    res.json({
      success: true,
      message: `Se eliminaron ${deletedCount} entradas de knowledge base`,
      deletedCount
    });
  } catch (error) {
    logger.error('Failed to prune knowledge', { error: error.message });
    res.status(500).json({ error: 'Error al limpiar knowledge base' });
  }
}

// Routes
router.post('/query', queryKnowledge);
router.get('/:projectId', getKnowledge);
router.get('/:projectId/insights', getTopKnowledgeInsights);
router.post('/:projectId/promote/requirement', promoteRequirementToKnowledge);
router.post('/:projectId/promote/symbol', promoteSymbolToKnowledge);
router.post('/:projectId/prune', pruneProjectKnowledge);

export default router;
