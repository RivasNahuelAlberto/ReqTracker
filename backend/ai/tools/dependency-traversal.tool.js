import Relation from '../../models/Relation.js';
import Project from '../../models/Project.js';
import SymbolModel from '../../models/Symbol.js';
import StructuredLogger from '../logger/structured.logger.js';

const logger = new StructuredLogger('dependency-traversal-tool');

/**
 * Find a symbol by name across project
 */
async function findSymbolByName(projectId, symbolName) {
  if (!symbolName) return null;

  // Try exact match first
  let symbol = await SymbolModel.findOne({
    project: projectId,
    name: { $regex: `^${symbolName}$`, $options: 'i' }
  }).lean();

  if (symbol) return symbol;

  // Try substring match
  symbol = await SymbolModel.findOne({
    project: projectId,
    name: { $regex: symbolName, $options: 'i' }
  }).lean();

  return symbol;
}

/**
 * Build adjacency list for efficient traversal
 */
async function buildAdjacencyList(projectId) {
  const relations = await Relation.find({ projectId }).lean();
  const adjacency = new Map();

  for (const rel of relations) {
    const fromId = rel.fromId?.toString();
    const toId = rel.toId?.toString();

    if (!adjacency.has(fromId)) {
      adjacency.set(fromId, []);
    }

    adjacency.get(fromId).push({
      to: toId,
      type: rel.type || 'depends_on',
      description: rel.description || '',
      score: (rel.strength || 5) / 10 // Convert strength (1-10) to score (0-1)
    });
  }

  return adjacency;
}

/**
 * BFS traversal for transitive dependencies
 */
async function traverseTransitiveDependencies(projectId, sourceSymbolId, maxDepth) {
  const visited = new Set();
  const paths = [];
  const adjacency = await buildAdjacencyList(projectId);

  const queue = [
    {
      nodeId: sourceSymbolId,
      path: [sourceSymbolId],
      depth: 0,
      relationTypes: []
    }
  ];

  let visitedCount = 0;

  while (queue.length > 0 && visitedCount < 1000) {
    // Limit iterations to prevent infinite loops
    const current = queue.shift();

    if (current.depth >= maxDepth) {
      continue;
    }

    const key = `${current.nodeId}-${current.depth}`;
    if (visited.has(key)) {
      continue;
    }

    visited.add(key);
    visitedCount++;

    const neighbors = adjacency.get(current.nodeId) || [];

    for (const edge of neighbors) {
      const newPath = [...current.path, edge.to];
      const newTypes = [...current.relationTypes, edge.type];

      paths.push({
        path: newPath,
        depth: current.depth + 1,
        relationTypes: newTypes,
        edgeScores: [edge.score],
        relationDescription: edge.description
      });

      if (current.depth + 1 < maxDepth) {
        queue.push({
          nodeId: edge.to,
          path: newPath,
          depth: current.depth + 1,
          relationTypes: newTypes
        });
      }
    }
  }

  return paths;
}

/**
 * Get symbol details by ID
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
 * Calculate criticality score based on path characteristics
 */
function calculateCriticalityScore(path, relationTypes) {
  // Factors: depth, relation types, score
  let score = 0.5; // base

  // Longer paths = more critical
  score += (path.length - 1) * 0.1;

  // Depends_on relations = more critical
  const dependsOnCount = relationTypes.filter(t => t === 'depends_on').length;
  score += dependsOnCount * 0.15;

  // Cap at 1.0
  return Math.min(score, 1.0);
}

/**
 * Find all transitive dependencies with full path information
 * This is the REAL tool that should actually execute
 */
export async function findTransitiveDependencies({ projectId, symbolName, maxDepth = 3 }) {
  if (!projectId || !symbolName) {
    throw new Error('projectId y symbolName son requeridos.');
  }

  const startTime = Date.now();

  try {
    logger.info('Starting transitive dependency analysis', { projectId, symbolName, maxDepth });

    // Find the source symbol
    const sourceSymbol = await findSymbolByName(projectId, symbolName);
    if (!sourceSymbol) {
      logger.warn('Symbol not found', { projectId, symbolName });
      return {
        success: false,
        error: `Símbolo "${symbolName}" no encontrado en el proyecto`,
        paths: []
      };
    }

    const sourceId = sourceSymbol._id?.toString();

    // Find all transitive paths
    const paths = await traverseTransitiveDependencies(projectId, sourceId, maxDepth);

    // Enrich with symbol details and calculate criticality
    const enrichedPaths = await Promise.all(
      paths.map(async (pathObj) => {
        const symbols = await Promise.all(
          pathObj.path.map(async (symbolId) => {
            const details = await getSymbolDetails(symbolId);
            return details || { id: symbolId, name: 'Unknown' };
          })
        );

        const criticality = calculateCriticalityScore(pathObj.path, pathObj.relationTypes);

        return {
          path: symbols.map(s => `${s.name} (${s.type || 'unknown'})`).join(' → '),
          pathIds: pathObj.path,
          depth: pathObj.depth,
          relationTypes: pathObj.relationTypes,
          criticality: criticality.toFixed(2),
          nodesAffected: pathObj.path.length - 1,
          relationDescription: pathObj.relationDescription
        };
      })
    );

    // Sort by criticality and depth
    enrichedPaths.sort((a, b) => {
      const critDiff = parseFloat(b.criticality) - parseFloat(a.criticality);
      return critDiff !== 0 ? critDiff : b.depth - a.depth;
    });

    const duration = Date.now() - startTime;

    logger.info('Transitive dependency analysis completed', {
      projectId,
      symbolName,
      pathsFound: enrichedPaths.length,
      duration
    });

    return {
      success: true,
      sourceSymbol: sourceSymbol.name,
      analysis: {
        totalPaths: enrichedPaths.length,
        maxDepth: maxDepth,
        duration: duration,
        timestamp: new Date().toISOString()
      },
      paths: enrichedPaths.slice(0, 20), // Top 20 paths
      summary: {
        criticalPaths: enrichedPaths.filter(p => parseFloat(p.criticality) > 0.7).length,
        averageCriticality: (
          enrichedPaths.reduce((sum, p) => sum + parseFloat(p.criticality), 0) / enrichedPaths.length
        ).toFixed(2),
        deepestPath: Math.max(...enrichedPaths.map(p => p.depth), 0)
      }
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Transitive dependency analysis failed', {
      projectId,
      symbolName,
      duration,
      error: error.message
    });

    return {
      success: false,
      error: error.message,
      paths: []
    };
  }
}

/**
 * Detect dependency cycles
 */
export async function detectDependencyCycles({ projectId, symbolName }) {
  if (!projectId || !symbolName) {
    throw new Error('projectId y symbolName son requeridos.');
  }

  const startTime = Date.now();

  try {
    logger.info('Starting cycle detection', { projectId, symbolName });

    const sourceSymbol = await findSymbolByName(projectId, symbolName);
    if (!sourceSymbol) {
      return {
        success: false,
        error: `Símbolo "${symbolName}" no encontrado`,
        cycles: []
      };
    }

    const adjacency = await buildAdjacencyList(projectId);
    const cycles = [];
    const visited = new Set();
    const recursionStack = new Set();

    // DFS to find cycles
    function dfs(nodeId, path) {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const neighbors = adjacency.get(nodeId) || [];

      for (const edge of neighbors) {
        if (!visited.has(edge.to)) {
          dfs(edge.to, [...path, edge.to]);
        } else if (recursionStack.has(edge.to)) {
          // Found a cycle
          const cycleStart = path.indexOf(edge.to);
          if (cycleStart !== -1) {
            const cycle = path.slice(cycleStart).concat([edge.to]);
            cycles.push(cycle);
          }
        }
      }

      recursionStack.delete(nodeId);
    }

    dfs(sourceSymbol._id?.toString(), [sourceSymbol._id?.toString()]);

    const duration = Date.now() - startTime;

    logger.info('Cycle detection completed', {
      projectId,
      symbolName,
      cyclesFound: cycles.length,
      duration
    });

    return {
      success: true,
      sourceSymbol: sourceSymbol.name,
      cycles: cycles,
      cycleCount: cycles.length,
      duration: duration,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Cycle detection failed', {
      projectId,
      symbolName,
      duration,
      error: error.message
    });

    return {
      success: false,
      error: error.message,
      cycles: []
    };
  }
}

export default {
  findTransitiveDependencies,
  detectDependencyCycles
};
