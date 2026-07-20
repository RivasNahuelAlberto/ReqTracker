import {
  promoteRequirement,
  promoteSymbol,
  promotePattern,
  getTopKnowledge,
  searchKnowledge,
  getKnowledgeSummary
} from '../knowledge/knowledge.service.js';
import StructuredLogger from '../logger/structured.logger.js';
import { generateEmbedding } from '../embeddings.js';
import KnowledgeEntry from '../../models/KnowledgeEntry.js';

const logger = new StructuredLogger('knowledge-tool');

/**
 * Calcula similitud coseno entre dos vectores de embedding
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) {
    return 0;
  }

  if (vecA.length !== vecB.length) {
    return 0;
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Query knowledge base for relevant patterns and insights
 * MEJORA 2: Usa matching semántico con embeddings para relevancia
 */
export async function queryKnowledgeBase({ projectId, query, type = null, limit = 5 }) {
  if (!projectId || !query) {
    throw new Error('projectId y query son requeridos.');
  }

  try {
    const startTime = Date.now();
    
    // Obtener entries base
    let results = await searchKnowledge({ projectId, query, limit: limit * 2 });
    
    // MEJORA 2: Agregar matching semántico con embeddings
    if (results.length > 0) {
      try {
        const queryEmbedding = await generateEmbedding(query);
        if (queryEmbedding && queryEmbedding.length > 0) {
          // Calcular similitud semántica para cada resultado
          results = results.map(r => {
            let semanticScore = 0;
            if (r.embedding && Array.isArray(r.embedding) && r.embedding.length > 0) {
              semanticScore = cosineSimilarity(queryEmbedding, r.embedding);
            }
            return {
              ...r,
              semanticScore: Math.round(semanticScore * 1000) / 1000,
              // Combinar quality score con semantic score
              combinedScore: (r.quality_score || 0.5) * 0.4 + semanticScore * 0.6
            };
          });
          
          // Ordenar por combined score
          results.sort((a, b) => b.combinedScore - a.combinedScore);
        }
      } catch (embeddingError) {
        logger.warn('Failed to generate embedding for semantic matching', {
          projectId,
          error: embeddingError.message
        });
        // Continuar sin matching semántico
      }
    }
    
    results = results.slice(0, limit);
    
    const duration = Date.now() - startTime;
    logger.info('Knowledge base query executed', { 
      projectId, 
      query, 
      resultCount: results.length,
      duration,
      semanticMatchingUsed: true
    });

    return {
      success: true,
      query,
      results: results.map(r => ({
        id: r._id?.toString(),
        type: r.type,
        content: r.content,
        score: r.quality_score,
        semanticRelevance: r.semanticScore || null,
        combinedRelevance: r.combinedScore || r.quality_score,
        usedCount: r.usageCount,
        tags: r.tags
      })),
      count: results.length,
      timestamp: new Date().toISOString(),
      method: 'semantic_matching'
    };
  } catch (error) {
    logger.error('Knowledge base query failed', { projectId, query, error: error.message });
    return {
      error: error.message,
      fallback: true,
      results: [],
      success: false
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
