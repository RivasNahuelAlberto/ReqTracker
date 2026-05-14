import KnowledgeEntry from '../../models/KnowledgeEntry.js';
import Project from '../../models/Project.js';
import SymbolModel from '../../models/Symbol.js';
import { generateEmbedding } from '../embeddings.js';
import StructuredLogger from '../logger/structured.logger.js';

const logger = new StructuredLogger('knowledge-service');

/**
 * Promotion criteria thresholds
 */
const THRESHOLDS = {
  QUALITY_SCORE: 0.75,      // Requisito/símbolo debe tener quality > 75%
  CONSISTENCY_SCORE: 0.70,  // Debe ser muy consistente
  MIN_FREQUENCY: 3,         // Debe ocurrir al menos 3 veces
  CONFIDENCE: 0.80          // Confianza en la promoción
};

/**
 * Promote a requirement to knowledge base if it meets criteria
 */
export async function promoteRequirement({ projectId, requirement, reason = 'high_quality' }) {
  if (!projectId || !requirement) {
    logger.warn('Invalid promotion parameters', { projectId, reason });
    return null;
  }

  try {
    // Check if already in knowledge base
    const existing = await KnowledgeEntry.findOne({
      projectId,
      sourceId: requirement._id?.toString(),
      sourceType: 'requirement'
    });

    if (existing) {
      // Update usage
      existing.usageCount += 1;
      existing.lastUsed = new Date();
      await existing.save();
      return existing;
    }

    // Extract knowledge from requirement
    const content = `${requirement.name}: ${requirement.description || requirement.text}`;
    
    // Generate embedding
    let embedding = requirement.embedding;
    if (!embedding || embedding.length === 0) {
      try {
        embedding = await generateEmbedding(content);
      } catch (error) {
        logger.warn('Could not generate embedding for knowledge entry', { error: error.message });
        embedding = [];
      }
    }

    // Calculate validation score based on metrics
    let validationScore = 0.5;
    if (reason === 'high_quality' && requirement.quality_score) {
      validationScore = Math.min(requirement.quality_score, 1);
    } else if (reason === 'consistent') {
      validationScore = 0.85;
    } else if (reason === 'validated') {
      validationScore = 0.95;
    }

    // Create knowledge entry
    const entry = new KnowledgeEntry({
      projectId,
      type: 'requirement',
      sourceId: requirement._id?.toString(),
      sourceType: 'requirement',
      content,
      embedding,
      quality_score: requirement.quality_score || 0.7,
      consistency_score: requirement.consistency_score || 0.7,
      promotionReason: reason,
      validatedBy: 'system',
      validationScore,
      tags: [requirement.type, 'requirement', reason],
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
    });

    await entry.save();
    
    logger.info('Requirement promoted to knowledge base', {
      projectId,
      requirementId: requirement._id?.toString(),
      reason,
      score: validationScore
    });

    return entry;
  } catch (error) {
    logger.error('Failed to promote requirement', { projectId, error: error.message });
    return null;
  }
}

/**
 * Promote a symbol to knowledge base if it meets criteria
 */
export async function promoteSymbol({ projectId, symbol, reason = 'high_quality' }) {
  if (!projectId || !symbol) {
    logger.warn('Invalid promotion parameters', { projectId, reason });
    return null;
  }

  try {
    const existing = await KnowledgeEntry.findOne({
      projectId,
      sourceId: symbol._id?.toString(),
      sourceType: 'symbol'
    });

    if (existing) {
      existing.usageCount += 1;
      existing.lastUsed = new Date();
      await existing.save();
      return existing;
    }

    const content = `${symbol.name} (${symbol.type}): ${symbol.notion || symbol.impact || 'Symbol definition'}`;
    
    let embedding = symbol.embedding;
    if (!embedding || embedding.length === 0) {
      try {
        embedding = await generateEmbedding(content);
      } catch (error) {
        logger.warn('Could not generate embedding for symbol knowledge', { error: error.message });
        embedding = [];
      }
    }

    let validationScore = 0.5;
    if (reason === 'high_quality') {
      validationScore = 0.80;
    } else if (reason === 'consistent') {
      validationScore = 0.85;
    } else if (reason === 'validated') {
      validationScore = 0.95;
    }

    const entry = new KnowledgeEntry({
      projectId,
      type: 'symbol',
      sourceId: symbol._id?.toString(),
      sourceType: 'symbol',
      content,
      embedding,
      quality_score: 0.75,
      consistency_score: 0.75,
      promotionReason: reason,
      validatedBy: 'system',
      validationScore,
      tags: [symbol.type, 'symbol', reason],
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    });

    await entry.save();
    
    logger.info('Symbol promoted to knowledge base', {
      projectId,
      symbolId: symbol._id?.toString(),
      reason,
      score: validationScore
    });

    return entry;
  } catch (error) {
    logger.error('Failed to promote symbol', { projectId, error: error.message });
    return null;
  }
}

/**
 * Promote a pattern detected across multiple requirements
 */
export async function promotePattern({ projectId, pattern, reason = 'recurring' }) {
  if (!projectId || !pattern) return null;

  try {
    // Check if pattern already exists
    const existing = await KnowledgeEntry.findOne({
      projectId,
      type: 'pattern',
      content: new RegExp(`^${pattern.description}`)
    });

    if (existing) {
      existing.frequency += 1;
      existing.usageCount += 1;
      existing.lastUsed = new Date();
      await existing.save();
      return existing;
    }

    let embedding = [];
    try {
      embedding = await generateEmbedding(pattern.description);
    } catch (error) {
      logger.warn('Could not generate embedding for pattern', { error: error.message });
    }

    const entry = new KnowledgeEntry({
      projectId,
      type: 'pattern',
      content: pattern.description,
      embedding,
      quality_score: 0.7,
      consistency_score: pattern.consistency || 0.7,
      frequency: pattern.occurrences || 1,
      promotionReason: reason,
      validatedBy: 'system',
      validationScore: 0.75,
      tags: ['pattern', reason, ...(pattern.tags || [])],
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    });

    await entry.save();
    
    logger.info('Pattern promoted to knowledge base', {
      projectId,
      pattern: pattern.description,
      frequency: pattern.occurrences || 1
    });

    return entry;
  } catch (error) {
    logger.error('Failed to promote pattern', { projectId, error: error.message });
    return null;
  }
}

/**
 * Get top knowledge entries by score
 */
export async function getTopKnowledge({ projectId, type = null, limit = 10 }) {
  try {
    const query = { projectId, isActive: true };
    if (type) query.type = type;

    const entries = await KnowledgeEntry.find(query)
      .sort({ quality_score: -1, usageCount: -1 })
      .limit(limit)
      .lean();

    return entries;
  } catch (error) {
    logger.error('Failed to fetch top knowledge', { projectId, error: error.message });
    return [];
  }
}

/**
 * Search knowledge base semantically
 */
export async function searchKnowledge({ projectId, query, limit = 5 }) {
  try {
    if (!query) return [];

    // Generate embedding for query
    let queryEmbedding = [];
    try {
      queryEmbedding = await generateEmbedding(query);
    } catch (error) {
      logger.warn('Could not generate query embedding', { error: error.message });
    }

    if (queryEmbedding.length === 0) {
      // Fallback to text search
      return await KnowledgeEntry.find({
        projectId,
        isActive: true,
        $text: { $search: query }
      })
        .sort({ quality_score: -1 })
        .limit(limit)
        .lean();
    }

    // Use vector similarity search (MongoDB doesn't have built-in, but we can use linear search on embeddings)
    // In production, use a vector database like Pinecone or Redis
    const entries = await KnowledgeEntry.find({
      projectId,
      isActive: true,
      embedding: { $exists: true }
    })
      .limit(100) // Get more results and filter
      .lean();

    // Simple cosine similarity (in production use proper vector DB)
    const scored = entries
      .map(entry => ({
        ...entry,
        similarity: cosineSimilarity(queryEmbedding, entry.embedding || [])
      }))
      .filter(e => e.similarity > 0.5)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return scored;
  } catch (error) {
    logger.error('Failed to search knowledge', { projectId, error: error.message });
    return [];
  }
}

/**
 * Get knowledge summary for project
 */
export async function getKnowledgeSummary({ projectId }) {
  try {
    const [byType, recent, topUsed, expiring] = await Promise.all([
      KnowledgeEntry.aggregate([
        { $match: { projectId: new (require('mongoose')).Types.ObjectId(projectId), isActive: true } },
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ]),
      KnowledgeEntry.find({ projectId, isActive: true })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      KnowledgeEntry.find({ projectId, isActive: true })
        .sort({ usageCount: -1 })
        .limit(5)
        .lean(),
      KnowledgeEntry.find({
        projectId,
        isActive: true,
        expiresAt: { $lt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
      })
        .sort({ expiresAt: 1 })
        .limit(5)
        .lean()
    ]);

    return {
      totalEntries: await KnowledgeEntry.countDocuments({ projectId, isActive: true }),
      byType: Object.fromEntries(byType.map(t => [t._id, t.count])),
      recentlyAdded: recent.length,
      topUsed: topUsed.map(e => ({ content: e.content, uses: e.usageCount })),
      expiring: expiring.map(e => ({ content: e.content, expiresAt: e.expiresAt }))
    };
  } catch (error) {
    logger.error('Failed to get knowledge summary', { projectId, error: error.message });
    return null;
  }
}

/**
 * Prune expired entries and low-scoring entries
 */
export async function pruneKnowledge({ projectId }) {
  try {
    const now = new Date();
    const result = await KnowledgeEntry.deleteMany({
      projectId,
      $or: [
        { expiresAt: { $lt: now } },
        { quality_score: { $lt: 0.3 }, createdAt: { $lt: new Date(now - 30 * 24 * 60 * 60 * 1000) } }
      ]
    });

    logger.info('Knowledge base pruned', { projectId, deleted: result.deletedCount });
    return result.deletedCount;
  } catch (error) {
    logger.error('Failed to prune knowledge', { projectId, error: error.message });
    return 0;
  }
}

/**
 * Helper: Cosine similarity between two vectors
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < Math.min(vecA.length, vecB.length); i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export default {
  promoteRequirement,
  promoteSymbol,
  promotePattern,
  getTopKnowledge,
  searchKnowledge,
  getKnowledgeSummary,
  pruneKnowledge
};
