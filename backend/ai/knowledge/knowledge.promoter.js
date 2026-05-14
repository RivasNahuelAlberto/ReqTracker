import Project from '../../models/Project.js';
import SymbolModel from '../../models/Symbol.js';
import {
  promoteRequirement,
  promoteSymbol,
  promotePattern
} from '../knowledge/knowledge.service.js';
import StructuredLogger from '../logger/structured.logger.js';

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
          if (entry) promotedCount++;
        }
      }
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

    for (const symbol of symbols) {
      // Check consistency
      if (symbol.consistency_score && symbol.consistency_score > QUALITY_THRESHOLDS.CONSISTENCY_MIN) {
        const entry = await promoteSymbol({
          projectId: symbol.project.toString(),
          symbol,
          reason: 'consistent'
        });
        if (entry) promotedCount++;
      }
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
          if (pattern) patternsDetected++;
        }
      }
    }

    logger.info('Pattern detection and promotion completed', { patternsDetected });
    return patternsDetected;
  } catch (error) {
    logger.error('Failed to detect and promote patterns', { error: error.message });
    return 0;
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
  runKnowledgePromotion,
  setupKnowledgePromotionWorker
};
