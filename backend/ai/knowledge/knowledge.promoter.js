import Project from '../../models/Project.js';
import SymbolModel from '../../models/Symbol.js';
import {
  promoteRequirement,
  promoteSymbol,
  promotePattern
} from '../knowledge/knowledge.service.js';
import StructuredLogger from '../logger/structured.logger.js';
import { findBestMatchingRequirement } from './semantic-matcher.js';
import { invalidateKBContextCache } from '../cache/redis.cache.js';

const logger = new StructuredLogger('knowledge-promoter');

const QUALITY_THRESHOLDS = {
  REQUIREMENT_QUALITY: 0.75,
  SYMBOL_QUALITY: 0.70,
  CONSISTENCY_MIN: 0.70
};

/**
 * Auto-promote high-quality requirements to knowledge base
 */
export async function promoteHighQualityRequirements() {
  try {
    const projects = await Project.find({}).lean();
    let promotedCount = 0;
    const projectIds = new Set();

    for (const project of projects) {
      if (!project.requirements || project.requirements.length === 0) continue;

      for (const req of project.requirements) {
        // Check quality thresholds
        if (req.quality_score && req.quality_score > QUALITY_THRESHOLDS.REQUIREMENT_QUALITY) {
          const entry = await promoteRequirement({
            projectId: project._id.toString(),
            requirement: req,
            reason: 'high_quality'
          });
          if (entry) {
            promotedCount++;
            projectIds.add(project._id.toString());
          }
        }
      }
    }

    // Invalidar KB context cache para proyectos afectados (MEJORA 3)
    for (const projectId of projectIds) {
      await invalidateKBContextCache(projectId).catch(err => {
        logger.warn('Failed to invalidate KB context cache', { projectId, error: err.message });
      });
    }

    logger.info('Auto-promotion of high-quality requirements completed', { promotedCount });
    return promotedCount;
  } catch (error) {
    logger.error('Failed to auto-promote requirements', { error: error.message });
    return 0;
  }
}

/**
 * Auto-promote consistent symbols to knowledge base
 */
export async function promoteConsistentSymbols() {
  try {
    const symbols = await SymbolModel.find({}).lean();
    let promotedCount = 0;
    const projectIds = new Set();

    for (const symbol of symbols) {
      // Check consistency
      if (symbol.consistency_score && symbol.consistency_score > QUALITY_THRESHOLDS.CONSISTENCY_MIN) {
        const entry = await promoteSymbol({
          projectId: symbol.project.toString(),
          symbol,
          reason: 'consistent'
        });
        if (entry) {
          promotedCount++;
          projectIds.add(symbol.project.toString());
        }
      }
    }

    // Invalidar KB context cache para proyectos afectados (MEJORA 3)
    for (const projectId of projectIds) {
      await invalidateKBContextCache(projectId).catch(err => {
        logger.warn('Failed to invalidate KB context cache', { projectId, error: err.message });
      });
    }

    logger.info('Auto-promotion of consistent symbols completed', { promotedCount });
    return promotedCount;
  } catch (error) {
    logger.error('Failed to auto-promote symbols', { error: error.message });
    return 0;
  }
}

/**
 * Detect and promote recurring patterns
 */
export async function detectAndPromotePatterns() {
  try {
    const projects = await Project.find({}).lean();
    let patternsDetected = 0;
    const projectIds = new Set();

    for (const project of projects) {
      if (!project.requirements || project.requirements.length < 3) continue;

      // Simple pattern detection: duplicate quality scores
      const qualityScores = {};
      for (const req of project.requirements) {
        const score = req.quality_score ? Math.round(req.quality_score * 10) / 10 : null;
        if (score) {
          qualityScores[score] = (qualityScores[score] || 0) + 1;
        }
      }

      // Find patterns that occur frequently
      for (const [score, count] of Object.entries(qualityScores)) {
        if (count >= 3) {
          const pattern = await promotePattern({
            projectId: project._id.toString(),
            pattern: {
              description: `Requisitos con quality_score ${score}`,
              occurrences: count,
              consistency: parseFloat(score),
              tags: ['quality_pattern', 'requirement']
            },
            reason: 'recurring'
          });
          if (pattern) {
            patternsDetected++;
            projectIds.add(project._id.toString());
          }
        }
      }
    }

    // Invalidar KB context cache para proyectos afectados (MEJORA 3)
    for (const projectId of projectIds) {
      await invalidateKBContextCache(projectId).catch(err => {
        logger.warn('Failed to invalidate KB context cache', { projectId, error: err.message });
      });
    }

    logger.info('Pattern detection and promotion completed', { patternsDetected });
    return patternsDetected;
  } catch (error) {
    logger.error('Failed to detect and promote patterns', { error: error.message });
    return 0;
  }
}

/**
 * Auto-promote analysis results to existing requirements using semantic matching
 * MEJORA 1: Usa embeddings para matching en lugar de substring
 * 
 * Caso de uso: Cuando un análisis genera un input potencialmente relacionado
 * con un requisito existente, encuentra el match semántico más probable
 * y lo promociona a knowledge base (evitando duplicados)
 * 
 * @param {string} projectId - ID del proyecto
 * @param {Object} analysisResult - {input, output, quality_score, risk_level, etc}
 * @param {number} similarityThreshold - Umbral de similitud (default: 0.85)
 * @returns {Promise<Object>} {matched: bool, requirement: Object|null, similarity: number}
 */
export async function autoPromoteFromAnalysis(projectId, analysisResult, similarityThreshold = 0.85) {
  try {
    if (!projectId || !analysisResult || !analysisResult.input) {
      logger.warn('Invalid parameters for autoPromoteFromAnalysis', {
        projectId,
        hasAnalysisResult: !!analysisResult,
        hasInput: !!analysisResult?.input
      });
      return { matched: false, requirement: null, similarity: 0, promoted: false };
    }

    // Obtener proyecto y requisitos
    const project = await Project.findById(projectId).lean();
    if (!project || !project.requirements || project.requirements.length === 0) {
      logger.debug('No project or requirements found', { projectId });
      return { matched: false, requirement: null, similarity: 0, promoted: false };
    }

    // Usar matching semántico para encontrar requisito similar
    const bestMatch = await findBestMatchingRequirement(
      analysisResult.input,
      project.requirements,
      similarityThreshold
    );

    if (!bestMatch) {
      logger.debug('No matching requirement found for analysis input', {
        projectId,
        inputLength: analysisResult.input.length,
        threshold: similarityThreshold
      });
      return { matched: false, requirement: null, similarity: 0, promoted: false };
    }

    // Si encontramos un match, intentar promocionarlo
    try {
      const entry = await promoteRequirement({
        projectId,
        requirement: bestMatch.requirement,
        reason: 'semantic_match_from_analysis',
        metadata: {
          analysisQuality: analysisResult.quality_score,
          semanticSimilarity: bestMatch.similarity,
          analysisRisk: analysisResult.risk_level
        }
      });

        // Invalidar KB context cache (MEJORA 3)
        if (entry) {
          await invalidateKBContextCache(projectId).catch(err => {
            logger.warn('Failed to invalidate KB context cache', { projectId, error: err.message });
          });
        }

        matched: true,
        requirement: bestMatch.requirement,
        similarity: bestMatch.similarity,
        promoted: false,
        promotionError: promotionError.message
      };
    }
  } catch (error) {
    logger.error('Error in autoPromoteFromAnalysis', {
      projectId,
      error: error.message
    });
    return { matched: false, requirement: null, similarity: 0, promoted: false, error: error.message };
  }
}

/**
 * Run all knowledge base promotions
 * Should be called periodically (daily/hourly depending on project size)
 */
export async function runKnowledgePromotion() {
  try {
    logger.info('Starting knowledge base promotion cycle');

    const [requirementsPromoted, symbolsPromoted, patternsDetected] = await Promise.all([
      promoteHighQualityRequirements(),
      promoteConsistentSymbols(),
      detectAndPromotePatterns()
    ]);

    logger.info('Knowledge base promotion cycle completed', {
      requirementsPromoted,
      symbolsPromoted,
      patternsDetected,
      total: requirementsPromoted + symbolsPromoted + patternsDetected
    });

    return {
      success: true,
      requirementsPromoted,
      symbolsPromoted,
      patternsDetected,
      total: requirementsPromoted + symbolsPromoted + patternsDetected,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Knowledge promotion cycle failed', { error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Setup periodic knowledge promotion (runs every hour)
 */
export function setupKnowledgePromotionWorker() {
  // Run on startup
  runKnowledgePromotion().catch(err => 
    logger.error('Initial knowledge promotion failed', { error: err.message })
  );

  // Run every hour
  const interval = setInterval(async () => {
    try {
      await runKnowledgePromotion();
    } catch (error) {
      logger.error('Scheduled knowledge promotion failed', { error: error.message });
    }
  }, 60 * 60 * 1000); // 1 hour

  return () => clearInterval(interval); // Return stop function
}

export default {
  promoteHighQualityRequirements,
  promoteConsistentSymbols,
  detectAndPromotePatterns,
  autoPromoteFromAnalysis,
  runKnowledgePromotion,
  setupKnowledgePromotionWorker
};
