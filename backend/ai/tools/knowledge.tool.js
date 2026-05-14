import {
  promoteRequirement,
  promoteSymbol,
  promotePattern,
  getTopKnowledge,
  searchKnowledge,
  getKnowledgeSummary
} from '../knowledge/knowledge.service.js';
import StructuredLogger from '../logger/structured.logger.js';

const logger = new StructuredLogger('knowledge-tool');

/**
 * Query knowledge base for relevant patterns and insights
 */
export async function queryKnowledgeBase({ projectId, query, type = null, limit = 5 }) {
  if (!projectId || !query) {
    throw new Error('projectId y query son requeridos.');
  }

  try {
    const startTime = Date.now();
    
    // Search semantically for relevant knowledge
    const results = await searchKnowledge({ projectId, query, limit });
    
    const duration = Date.now() - startTime;
    logger.info('Knowledge base query executed', { 
      projectId, 
      query, 
      resultCount: results.length,
      duration 
    });

    return {
      success: true,
      query,
      results: results.map(r => ({
        id: r._id?.toString(),
        type: r.type,
        content: r.content,
        score: r.quality_score,
        usedCount: r.usageCount,
        tags: r.tags
      })),
      count: results.length,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Knowledge base query failed', { projectId, query, error: error.message });
    return {
      error: error.message,
      fallback: true,
      results: []
    };
  }
}

/**
 * Get summary of project knowledge
 */
export async function getProjectKnowledge({ projectId }) {
  if (!projectId) {
    throw new Error('projectId es requerido.');
  }

  try {
    const startTime = Date.now();
    
    const summary = await getKnowledgeSummary({ projectId });
    
    const duration = Date.now() - startTime;
    logger.info('Project knowledge summary retrieved', { projectId, duration });

    return {
      success: true,
      projectId,
      summary,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Failed to get project knowledge', { projectId, error: error.message });
    return {
      error: error.message,
      fallback: true,
      summary: null
    };
  }
}

/**
 * Get top patterns and insights from knowledge base
 */
export async function getTopInsights({ projectId, type = null, limit = 10 }) {
  if (!projectId) {
    throw new Error('projectId es requerido.');
  }

  try {
    const startTime = Date.now();
    
    const insights = await getTopKnowledge({ projectId, type, limit });
    
    const duration = Date.now() - startTime;
    logger.info('Top insights retrieved', { projectId, count: insights.length, duration });

    return {
      success: true,
      projectId,
      insights: insights.map(i => ({
        id: i._id?.toString(),
        type: i.type,
        content: i.content,
        quality: i.quality_score,
        consistency: i.consistency_score,
        frequency: i.frequency,
        reason: i.promotionReason,
        tags: i.tags
      })),
      count: insights.length,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Failed to get top insights', { projectId, error: error.message });
    return {
      error: error.message,
      fallback: true,
      insights: []
    };
  }
}

export default {
  queryKnowledgeBase,
  getProjectKnowledge,
  getTopInsights
};
