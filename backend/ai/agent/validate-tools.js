/**
 * Validation script to ensure all tools can be imported and are properly registered
 * Run: node backend/ai/agent/validate-tools.js
 */

import { toolImplementations } from './toolImplementations.js';
import StructuredLogger from '../logger/structured.logger.js';

const logger = new StructuredLogger('tool-validation');

const requiredTools = [
  'createRequirement',
  'updateRequirement',
  'deleteRequirement',
  'createSymbol',
  'updateSymbol',
  'deleteSymbol',
  'createScenario',
  'updateScenario',
  'deleteScenario',
  'generateProjectGraph',
  'regenerateEmbeddings',
  'analyzeRequirement',
  'findDuplicates',
  'findSimilarRequirements',
  'clusterRequirementsAnalysis',
  'checkConsistency',
  'checkImpact',
  'analyzeSymbolQuality',
  'generateRecommendations',
  'semanticSearch',
  'findTransitiveDependencies',
  'detectDependencyCycles',
  'analyzeSytemicImpact',
  'analyzeInconsistencyRisk'
];

async function validateTools() {
  logger.info('Starting tool validation', { requiredToolCount: requiredTools.length });

  let missingTools = [];
  let foundTools = [];

  for (const toolName of requiredTools) {
    if (typeof toolImplementations[toolName] === 'function') {
      foundTools.push(toolName);
      logger.info(`✅ Tool registered: ${toolName}`);
    } else {
      missingTools.push(toolName);
      logger.error(`❌ Tool NOT registered: ${toolName}`);
    }
  }

  logger.info('Validation complete', {
    totalRequired: requiredTools.length,
    found: foundTools.length,
    missing: missingTools.length,
    missingTools: missingTools
  });

  if (missingTools.length === 0) {
    logger.info('✅ ALL TOOLS PROPERLY INTEGRATED');
    process.exit(0);
  } else {
    logger.error(`❌ MISSING ${missingTools.length} TOOLS`);
    process.exit(1);
  }
}

validateTools().catch(error => {
  logger.error('Validation failed with error', { error: error.message });
  process.exit(1);
});
