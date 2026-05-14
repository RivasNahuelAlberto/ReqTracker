import Relation from '../../models/Relation.js';
import Project from '../../models/Project.js';
import SymbolModel from '../../models/Symbol.js';
import { getCachedAnalysisResult, cacheAnalysisResult } from '../cache/redis.cache.js';
import { fetchWithRetry } from '../utils/retry.util.js';
import StructuredLogger from '../logger/structured.logger.js';
import crypto from 'crypto';

const logger = new StructuredLogger('systemic-impact-tool');
const ANALYTICS_URL = process.env.ANALYTICS_URL || 'http://localhost:8000';

/**
 * Helper: create cache key
 */
function createCacheKey(type, projectId, params) {
  const paramStr = JSON.stringify(params);
  const hash = crypto.createHash('sha256').update(paramStr).digest('hex').substring(0, 12);
  return hash;
}

/**
 * Find symbol by name
 */
async function findSymbolByName(projectId, symbolName) {
  let symbol = await SymbolModel.findOne({
    project: projectId,
    name: { $regex: `^${symbolName}$`, $options: 'i' }
  }).lean();

  if (symbol) return symbol;

  symbol = await SymbolModel.findOne({
    project: projectId,
    name: { $regex: symbolName, $options: 'i' }
  }).lean();

  return symbol;
}

/**
 * Build adjacency list
 */
async function buildAdjacencyList(projectId) {
  const relations = await Relation.find({ projectId }).lean();
  const forward = new Map();
  const backward = new Map();

  for (const rel of relations) {
    const fromId = rel.fromId?.toString();
    const toId = rel.toId?.toString();

    // Forward edges
    if (!forward.has(fromId)) forward.set(fromId, []);
    forward.get(fromId).push({
      to: toId,
      type: rel.type || 'depends_on',
      score: (rel.strength || 5) / 10
    });

    // Backward edges (for impact propagation)
    if (!backward.has(toId)) backward.set(toId, []);
    backward.get(toId).push({
      from: fromId,
      type: rel.type || 'depends_on',
      score: (rel.strength || 5) / 10
    });
  }

  return { forward, backward };
}

/**
 * Calculate propagation impact using BFS from target backwards
 */
async function calculatePropagationImpact(projectId, targetSymbolId, adjacency) {
  const { backward } = adjacency;
  const impacted = new Map();
  const queue = [{ id: targetSymbolId, depth: 0, propagationScore: 1.0 }];
  const visited = new Set([targetSymbolId]);

  while (queue.length > 0) {
    const current = queue.shift();

    if (current.depth > 0) {
      impacted.set(current.id, {
        depth: current.depth,
        propagationScore: current.propagationScore.toFixed(3),
        type: 'backward'
      });
    }

    const predecessors = backward.get(current.id) || [];

    for (const edge of predecessors) {
      if (!visited.has(edge.from) && current.depth < 3) {
        visited.add(edge.from);
        const newScore = current.propagationScore * (edge.score || 0.8) * 0.9; // Decay
        queue.push({
          id: edge.from,
          depth: current.depth + 1,
          propagationScore: newScore
        });
      }
    }
  }

  return impacted;
}

/**
 * Calculate dependency impact (what breaks if we remove this symbol)
 */
async function calculateDependencyImpact(projectId, targetSymbolId, adjacency) {
  const { forward } = adjacency;
  const dependent = new Map();
  const queue = [{ id: targetSymbolId, depth: 0, dependencyScore: 1.0 }];
  const visited = new Set([targetSymbolId]);

  while (queue.length > 0) {
    const current = queue.shift();

    if (current.depth > 0) {
      dependent.set(current.id, {
        depth: current.depth,
        dependencyScore: current.dependencyScore.toFixed(3),
        type: 'forward'
      });
    }

    const successors = forward.get(current.id) || [];

    for (const edge of successors) {
      if (!visited.has(edge.to) && current.depth < 3) {
        visited.add(edge.to);
        const newScore = current.dependencyScore * (edge.score || 0.8) * 0.9;
        queue.push({
          id: edge.to,
          depth: current.depth + 1,
          dependencyScore: newScore
        });
      }
    }
  }

  return dependent;
}

/**
 * Get symbol details
 */
async function getSymbolDetails(symbolId) {
  const symbol = await SymbolModel.findById(symbolId).lean();
  return symbol
    ? {
        id: symbol._id?.toString(),
        name: symbol.name,
        type: symbol.type,
        notion: symbol.notion
      }
    : null;
}

/**
 * Analyze systemic impact of modifying a symbol
 */
export async function analyzeSytemicImpact({ projectId, symbolName, changeDescription }) {
  if (!projectId || !symbolName) {
    throw new Error('projectId y symbolName son requeridos.');
  }

  const startTime = Date.now();
  const cacheKey = createCacheKey('systemic_impact', projectId, {
    symbolName,
    changeDescription
  });

  try {
    logger.info('Starting systemic impact analysis', {
      projectId,
      symbolName,
      changeDescription
    });

    // Try cache first
    let cached = await getCachedAnalysisResult('systemic_impact', projectId, cacheKey);
    if (cached) {
      logger.info('Systemic impact analysis from cache', { projectId, symbolName });
      return { ...cached, fromCache: true };
    }

    // Find symbol
    const sourceSymbol = await findSymbolByName(projectId, symbolName);
    if (!sourceSymbol) {
      return {
        success: false,
        error: `Símbolo "${symbolName}" no encontrado`,
        impacts: []
      };
    }

    const symbolId = sourceSymbol._id?.toString();

    // Build graph
    const adjacency = await buildAdjacencyList(projectId);

    // Calculate both types of impact
    const [propagationImpact, dependencyImpact] = await Promise.all([
      calculatePropagationImpact(projectId, symbolId, adjacency),
      calculateDependencyImpact(projectId, symbolId, adjacency)
    ]);

    // Combine and enrich
    const allImpactedIds = new Set([
      ...propagationImpact.keys(),
      ...dependencyImpact.keys()
    ]);

    const impactedDetails = await Promise.all(
      Array.from(allImpactedIds).map(async (id) => {
        const details = await getSymbolDetails(id);
        const prop = propagationImpact.get(id);
        const dep = dependencyImpact.get(id);

        return {
          symbol: details?.name || 'Unknown',
          type: details?.type || 'unknown',
          propagationImpact: prop ? parseFloat(prop.propagationScore) : 0,
          dependencyImpact: dep ? parseFloat(dep.dependencyScore) : 0,
          totalImpact: (parseFloat(prop?.propagationScore || 0) + parseFloat(dep?.dependencyScore || 0)) / 2,
          direction: prop && dep ? 'bidirectional' : prop ? 'incoming' : 'outgoing'
        };
      })
    );

    // Sort by total impact
    impactedDetails.sort((a, b) => b.totalImpact - a.totalImpact);

    const result = {
      success: true,
      sourceSymbol: sourceSymbol.name,
      change: changeDescription,
      analysis: {
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        symbolsAffected: allImpactedIds.size,
        criticalImpacts: impactedDetails.filter(i => i.totalImpact > 0.7).length,
        averageImpact: (
          impactedDetails.reduce((sum, i) => sum + i.totalImpact, 0) / impactedDetails.length
        ).toFixed(3)
      },
      impacts: impactedDetails.slice(0, 15), // Top 15
      riskLevel:
        impactedDetails.filter(i => i.totalImpact > 0.7).length > 5
          ? 'HIGH'
          : impactedDetails.filter(i => i.totalImpact > 0.5).length > 3
            ? 'MEDIUM'
            : 'LOW',
      mitigationStrategies: generateMitigationStrategies(
        sourceSymbol.name,
        impactedDetails,
        changeDescription
      )
    };

    // Cache result
    await cacheAnalysisResult('systemic_impact', projectId, cacheKey, result, 3600);

    logger.info('Systemic impact analysis completed', {
      projectId,
      symbolName,
      affectedCount: allImpactedIds.size
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Systemic impact analysis failed', {
      projectId,
      symbolName,
      duration,
      error: error.message
    });

    return {
      success: false,
      error: error.message,
      impacts: []
    };
  }
}

/**
 * Generate mitigation strategies
 */
function generateMitigationStrategies(symbolName, impacts, changeDescription) {
  const strategies = [];

  if (impacts.length === 0) {
    strategies.push(`El cambio en "${symbolName}" tiene impacto aislado. Proceder con confianza.`);
    return strategies;
  }

  const highImpact = impacts.filter(i => i.totalImpact > 0.7);
  if (highImpact.length > 0) {
    strategies.push(
      `Coordinar con propietarios de: ${highImpact.map(i => i.symbol).join(', ')} antes de aplicar cambios.`
    );
  }

  const bidirectional = impacts.filter(i => i.direction === 'bidirectional');
  if (bidirectional.length > 0) {
    strategies.push(
      `Revisar bidireccionalidad en: ${bidirectional.map(i => i.symbol).join(', ')} - posible acoplamiento excesivo.`
    );
  }

  strategies.push(`Implementar tests de integración para validar el cambio en todas las dependencias.`);
  strategies.push(`Planificar rollback si detectas comportamientos inesperados post-cambio.`);

  return strategies;
}

/**
 * Analyze potential inconsistencies from systemic changes
 */
export async function analyzeInconsistencyRisk({ projectId, affectedSymbols }) {
  if (!projectId || !affectedSymbols || affectedSymbols.length === 0) {
    throw new Error('projectId y affectedSymbols son requeridos.');
  }

  const startTime = Date.now();

  try {
    logger.info('Starting inconsistency risk analysis', {
      projectId,
      symbolCount: affectedSymbols.length
    });

    // Call analytics for consistency check
    const response = await fetchWithRetry(
      `${ANALYTICS_URL}/consistency`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requirements: affectedSymbols.map(s => ({
            id: s.id,
            name: s.name,
            text: s.description || s.notion || ''
          })),
          projectId
        })
      },
      'checkInconsistencyRisk'
    );

    const result = await response.json();
    const duration = Date.now() - startTime;

    logger.info('Inconsistency risk analysis completed', {
      projectId,
      symbolCount: affectedSymbols.length,
      duration
    });

    return {
      success: true,
      analysis: result,
      duration,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Inconsistency risk analysis failed', {
      projectId,
      duration,
      error: error.message
    });

    return {
      success: false,
      error: error.message,
      analysis: null
    };
  }
}

export default {
  analyzeSytemicImpact,
  analyzeInconsistencyRisk
};
