import Project from '../../models/Project.js';
import RequirementModel from '../../models/Requirement.js';
import SymbolModel from '../../models/Symbol.js';
import {
  promoteRequirement,
  promoteSymbol,
  promotePattern
} from '../knowledge/knowledge.service.js';
import StructuredLogger from '../logger/structured.logger.js';
import { findBestMatchingRequirement } from './semantic-matcher.js';
import { invalidateKBContextCache } from '../cache/redis.cache.js';
import { analyzeRequirementPatterns } from './pattern-clustering.js';

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
      const requirements = await RequirementModel.find({ project: project._id }).lean();
      if (!requirements || requirements.length === 0) continue;

      for (const req of requirements) {
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
 * Detect and promote recurring patterns using semantic clustering
 * MEJORA 5: Usa algoritmo jerárquico de clustering semántico
 * 
 * Mejora sobre heurística anterior: Detecta patrones coherentes semánticamente
 * en lugar de solo contar palabras o quality scores
 * 
 * Ej: "Validación usuario", "Validación datos", "Validación entrada"
 * → Se agrupan en CLUSTER VALIDACIÓN (concepto común)
 * → Se promociona como patrón coherente
 */
export async function detectAndPromotePatterns() {
  try {
    const projects = await Project.find({}).lean();
    let patternsDetected = 0;
    let clustersAnalyzed = 0;
    const projectIds = new Set();

    for (const project of projects) {
      const requirements = await RequirementModel.find({ project: project._id }).lean();
      if (!requirements || requirements.length < 3) continue;

      // Usar clustering semántico para detectar patrones (MEJORA 5)
      let analysis = null;
      try {
        analysis = await analyzeRequirementPatterns(requirements, 0.75);
      } catch (clusterError) {
        logger.warn('Pattern clustering failed, falling back to simple detection', {
          projectId: project._id?.toString(),
          error: clusterError.message
        });
        // Fallback a heurística simple si clustering falla
        analysis = await fallbackSimplePatternDetection(project._id.toString(), requirements);
      }

      if (!analysis || !analysis.patterns) {
        continue;
      }

      clustersAnalyzed++;

      // Promocionar patrones detectados con alta coherencia
      for (const pattern of analysis.patterns) {
        if (pattern.coherence >= 0.75) {  // Solo patrones fuertes/moderados
          try {
            const promoted = await promotePattern({
              projectId: project._id.toString(),
              pattern: {
                theme: pattern.theme,
                description: pattern.description,
                occurrences: pattern.size,
                consistency: pattern.coherence,
                tags: pattern.tags || [],
                pattern_type: pattern.pattern_type,
                items: pattern.items
              },
              reason: 'semantic_pattern_detected'
            });

            if (promoted) {
              patternsDetected++;
              projectIds.add(project._id.toString());

              logger.debug('Promoted semantic pattern', {
                projectId: project._id?.toString(),
                theme: pattern.theme,
                coherence: pattern.coherence,
                size: pattern.size
              });
            }
          } catch (promoteError) {
            logger.warn('Failed to promote pattern', {
              projectId: project._id?.toString(),
              pattern: pattern.theme,
              error: promoteError.message
            });
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

    logger.info('Pattern detection and promotion completed', {
      patternsDetected,
      clustersAnalyzed,
      projectsAffected: projectIds.size,
      method: 'semantic_clustering'
    });

    return patternsDetected;
  } catch (error) {
    logger.error('Failed to detect and promote patterns', { 
      error: error.message,
      method: 'semantic_clustering'
    });
    return 0;
  }
}

/**
 * Fallback pattern detection (simple heuristic)
 * Used when semantic clustering fails
 */
async function fallbackSimplePatternDetection(projectId, requirements = []) {
  try {
    const qualityScores = {};
    for (const req of requirements) {
      const score = req.quality_score ? Math.round(req.quality_score * 10) / 10 : null;
      if (score) {
        qualityScores[score] = (qualityScores[score] || 0) + 1;
      }
    }

    const patterns = [];
    for (const [score, count] of Object.entries(qualityScores)) {
      if (count >= 3) {
        patterns.push({
          theme: `Quality Score: ${score}`,
          description: `${count} requisitos con quality_score ${score}`,
          size: count,
          coherence: parseFloat(score),
          tags: ['quality_pattern', 'requirement'],
          pattern_type: 'simple_grouping',
          items: count
        });
      }
    }

    return { patterns, stats: { total_items: requirements.length } };
  } catch (error) {
    logger.warn('Fallback pattern detection also failed', { error: error.message });
    return { patterns: [], stats: {} };
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
    const requirements = await RequirementModel.find({ project: projectId }).lean();
    if (!project || !requirements || requirements.length === 0) {
      logger.debug('No project or requirements found', { projectId });
      return { matched: false, requirement: null, similarity: 0, promoted: false };
    }

    // Usar matching semántico para encontrar requisito similar
    const bestMatch = await findBestMatchingRequirement(
      analysisResult.input,
      requirements,
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

      logger.info('Successfully promoted requirement from analysis match', {
        projectId,
        requirementId: bestMatch.requirement._id?.toString(),
        similarity: bestMatch.similarity,
        reason: 'semantic_match'
      });

      return {
        matched: true,
        requirement: bestMatch.requirement,
        similarity: bestMatch.similarity,
        promoted: !!entry,
        entry: entry || null
      };
    } catch (promotionError) {
      logger.warn('Failed to promote matched requirement', {
        projectId,
        requirementId: bestMatch.requirement._id?.toString(),
        error: promotionError.message
      });

      return {
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
