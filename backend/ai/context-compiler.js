/**
 * CONTEXT COMPILER
 * 
 * Capa 1 de la arquitectura estable de 4 capas (X.txt)
 * 
 * Responsabilidad ÚNICA: Reducir mundo antes de razonar
 * 
 * Input:  Full graph (438 relations)
 * Output: Compressed context pack (10-30 relevant nodes)
 * 
 * Esto es CRÍTICO porque:
 * - Previene token explosion
 * - Reduce ruido cognitivo
 * - Garantiza que planner vea mundo coherente
 */

import StructuredLogger from './logger/structured.logger.js';

const logger = new StructuredLogger('context-compiler');

/**
 * SAFETY GUARD: Safe string conversion
 * Prevents "Cannot read properties of undefined (reading 'toLowerCase')" errors
 */
function safeString(value) {
  if (value === null || value === undefined) return '';
  return (value ?? '').toString().toLowerCase().trim();
}

/**
 * CONTRACT GUARD: Validate relation structure
 * Returns true if relation has required fields
 */
function isValidRelation(rel) {
  return (
    rel &&
    typeof rel === 'object' &&
    rel.fromName !== null &&
    rel.fromName !== undefined &&
    rel.toName !== null &&
    rel.toName !== undefined &&
    rel.type !== null &&
    rel.type !== undefined
  );
}

/**
 * Compile and reduce full graph to relevant context
 * 
 * Takes full project graph and reduces it to actionable context
 * based on user goal and structural importance
 */
export async function compileContext({ 
  projectId, 
  goal,
  graph,
  depthLimit = 2,
  maxContextNodes = 25 // Conservative limit
}) {
  logger.info('🔄 CONTEXT COMPILATION START', {
    goal: goal.substring(0, 100),
    graphSize: graph?.length || 0,
    depthLimit,
    maxContextNodes
  });

  try {
    // GRAPH TYPE SAFETY (CRITICAL)
    if (!Array.isArray(graph)) {
      logger.warn('⚠️ GRAPH TYPE INVALID - RETURNING SAFE EMPTY CONTEXT', {
        type: typeof graph,
        isArray: Array.isArray(graph),
        value: graph?.constructor?.name || 'unknown'
      });
      
      return {
        goal,
        nodes: [],
        relations: [],
        summary: 'No hay grafo disponible',
        confidenceMap: {},
        metadata: {
          compiledAt: new Date().toISOString(),
          originalGraphSize: 0,
          compressedSize: 0,
          compressionRatio: 0,
          nodesIncluded: 0,
          nodesDiscarded: 0,
          depthLimit,
          strategy: 'safe_mode_empty',
          error: 'Invalid graph type'
        }
      };
    }

    // Step 1: Score all nodes by relevance to goal
    const scoredNodes = scoreNodesByRelevance(goal, graph);
    
    logger.info('📊 NODES SCORED', {
      totalNodes: scoredNodes.length,
      topScoresAvg: scoredNodes.slice(0, 5).reduce((a, n) => a + n.score, 0) / 5
    });

    // Step 2: Select top-k nodes by relevance + structural importance
    const selectedNodes = selectTopKNodes(scoredNodes, maxContextNodes);
    
    logger.info('🎯 TOP-K NODES SELECTED', {
      selectedCount: selectedNodes.length,
      coverage: `${((selectedNodes.length / scoredNodes.length) * 100).toFixed(1)}%`
    });

    // Step 3: Build subgraph containing only selected nodes + connecting relations
    const subgraph = buildSubgraph(selectedNodes, graph);
    
    logger.info('🌐 SUBGRAPH BUILT', {
      nodes: subgraph.nodes.length,
      relations: subgraph.relations.length,
      density: (subgraph.relations.length / (subgraph.nodes.length * (subgraph.nodes.length - 1))).toFixed(3)
    });

    // Step 4: Generate summary of compressed context
    const summary = generateContextSummary(subgraph, goal);
    
    logger.info('📝 CONTEXT SUMMARY GENERATED', {
      summaryLength: summary.length,
      keyInsights: extractKeyInsights(subgraph).slice(0, 3)
    });

    // Step 5: Create confidence map (what we know vs what we discarded)
    const confidenceMap = createConfidenceMap(selectedNodes, scoredNodes);

    // Step 6: Compile final context pack
    const contextPack = {
      goal,
      nodes: subgraph.nodes,
      relations: subgraph.relations,
      summary,
      confidenceMap,
      
      metadata: {
        compiledAt: new Date().toISOString(),
        originalGraphSize: graph.length,
        compressedSize: subgraph.relations.length,
        compressionRatio: (graph.length / subgraph.relations.length).toFixed(2),
        nodesIncluded: subgraph.nodes.length,
        nodesDiscarded: scoredNodes.length - subgraph.nodes.length,
        depthLimit,
        strategy: 'relevance_scoring + structural_pruning'
      }
    };

    logger.info('✅ CONTEXT COMPILATION COMPLETE', {
      contextPackSize: JSON.stringify(contextPack).length,
      compressionRatio: contextPack.metadata.compressionRatio,
      nodesCovered: `${contextPack.nodes.length}/${scoredNodes.length}`,
      discardedRatio: `${((contextPack.metadata.nodesDiscarded / scoredNodes.length) * 100).toFixed(1)}%`
    });

    return contextPack;

  } catch (error) {
    logger.error('❌ CONTEXT COMPILATION FAILED', {
      error: error.message,
      goal: goal.substring(0, 100)
    });
    throw error;
  }
}

/**
 * Score nodes by relevance to user goal
 * 
 * Scoring strategy (in order):
 * 1. Semantic similarity to goal (embeddings or keywords)
 * 2. Structural importance (edge weight, centrality)
 * 3. Recency / activity level
 * 4. Domain-specific heuristics
 */
function scoreNodesByRelevance(goal, graph) {
  const nodeScores = new Map();

  // Initialize all nodes with base score (SAFETY: filter out invalid relations)
  const validRelations = graph.filter(isValidRelation);
  const uniqueNodes = new Set();
  
  validRelations.forEach(rel => {
    uniqueNodes.add(rel.fromName);
    uniqueNodes.add(rel.toName);
  });

  uniqueNodes.forEach(nodeName => {
    nodeScores.set(nodeName, {
      name: nodeName,
      score: 0,
      scoreBreakdown: {
        semantic: 0,
        structural: 0,
        recency: 0,
        heuristic: 0
      }
    });
  });

  // Scoring strategy 1: Semantic relevance
  // Simple keyword matching (advanced: use embeddings)
  const goalWords = safeString(goal).split(/\s+/).filter(w => w.length > 0);
  
  nodeScores.forEach((node, nodeName) => {
    const nodeWords = safeString(nodeName).split(/[\s_-]+/).filter(w => w.length > 0);
    const matches = nodeWords.filter(w => 
      goalWords.some(gw => gw.includes(w) || w.includes(gw))
    ).length;
    
    node.scoreBreakdown.semantic = Math.min(matches * 0.3, 1.0);
  });

  // Scoring strategy 2: Structural importance
  // Count edges, weight by strength (SAFETY: use validRelations)
  validRelations.forEach(rel => {
    const fromNode = nodeScores.get(rel.fromName);
    const toNode = nodeScores.get(rel.toName);
    
    const weight = rel.strength ? rel.strength / 10 : 0.5; // Normalize to 0-1
    
    if (fromNode) fromNode.scoreBreakdown.structural += weight * 0.1;
    if (toNode) toNode.scoreBreakdown.structural += weight * 0.1;
  });

  // Cap structural at 1.0
  nodeScores.forEach(node => {
    node.scoreBreakdown.structural = Math.min(node.scoreBreakdown.structural, 1.0);
  });

  // Scoring strategy 3: Heuristic boost for analysis-related keywords
  const analysisKeywords = [
    'dependencia', 'relacion', 'impacto', 'cambio', 'modificar',
    'eliminar', 'riesgo', 'ciclo', 'loop', 'criticidad'
  ];
  
  const goalLower = safeString(goal);
  nodeScores.forEach((node, nodeName) => {
    const goalMatch = analysisKeywords.some(kw => 
      goalLower.includes(kw)
    );
    
    if (goalMatch) {
      node.scoreBreakdown.heuristic = 0.2;
    }
  });

  // Combine scores (weighted average)
  nodeScores.forEach(node => {
    node.score = 
      (node.scoreBreakdown.semantic * 0.4) +  // Semantic most important
      (node.scoreBreakdown.structural * 0.3) +
      (node.scoreBreakdown.recency * 0.15) +
      (node.scoreBreakdown.heuristic * 0.15);
  });

  // Convert map to sorted array
  return Array.from(nodeScores.values())
    .sort((a, b) => b.score - a.score);
}

/**
 * Select top-K nodes by relevance
 * 
 * Strategy:
 * - Always include high-relevance nodes (score > 0.5)
 * - Then add up to maxContextNodes
 * - Prefer structural importance if score is similar
 */
function selectTopKNodes(scoredNodes, maxContextNodes) {
  // First: High confidence nodes (score > 0.5)
  const highConfidence = scoredNodes.filter(n => n.score > 0.5);
  
  // Then: Add medium-confidence until we hit limit
  const remaining = scoredNodes.filter(n => n.score <= 0.5);
  
  const selected = [
    ...highConfidence,
    ...remaining.slice(0, Math.max(0, maxContextNodes - highConfidence.length))
  ];

  return selected.slice(0, maxContextNodes);
}

/**
 * Build subgraph containing only selected nodes
 * 
 * Includes all relations where both nodes are selected
 * SAFETY: Filters out invalid relations
 */
function buildSubgraph(selectedNodes, graph) {
  const nodeNameSet = new Set(selectedNodes.map(n => n.name));
  
  // SAFETY: Filter valid relations before building subgraph
  const validRelations = graph.filter(isValidRelation);
  
  const subgraphRelations = validRelations.filter(rel =>
    nodeNameSet.has(rel.fromName) && nodeNameSet.has(rel.toName)
  );

  return {
    nodes: Array.from(nodeNameSet).map(name => ({
      name,
      score: selectedNodes.find(n => n.name === name)?.score || 0
    })),
    relations: subgraphRelations
  };
}

/**
 * Generate human-readable summary of compressed context
 * 
 * Explains what the subgraph contains and why
 */
function generateContextSummary(subgraph, goal) {
  const nodeCount = subgraph.nodes.length;
  const relationCount = subgraph.relations.length;
  
  // Find key structural patterns
  const centrality = calculateCentrality(subgraph);
  const topCentral = Object.entries(centrality)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  const summary = 
    `Context compilado para: "${goal}"\n` +
    `Nodos incluidos: ${nodeCount}, Relaciones: ${relationCount}\n` +
    `Densidad: ${(relationCount / Math.max(1, nodeCount * (nodeCount - 1))).toFixed(3)}\n` +
    `Nodos centrales: ${topCentral.join(', ')}\n` +
    `Este contexto representa el ~${((nodeCount / 438) * 100).toFixed(1)}% del grafo original, ` +
    `seleccionados por relevancia a tu objetivo.`;

  return summary;
}

/**
 * Calculate node centrality (simple version: degree + weighted edges)
 * SAFETY: Validates relations before processing
 */
function calculateCentrality(subgraph) {
  const centrality = {};

  subgraph.nodes.forEach(node => {
    centrality[node.name] = 0;
  });

  // SAFETY: Filter valid relations before computing centrality
  subgraph.relations.filter(isValidRelation).forEach(rel => {
    const weight = rel.strength ? rel.strength / 10 : 0.5;
    centrality[rel.fromName] = (centrality[rel.fromName] || 0) + weight;
    centrality[rel.toName] = (centrality[rel.toName] || 0) + weight;
  });

  return centrality;
}

/**
 * Extract key insights from subgraph
 * SAFETY: Validates data before processing
 */
function extractKeyInsights(subgraph) {
  const insights = [];

  // Insight 1: Grafo structure
  const validRelCount = subgraph.relations.filter(isValidRelation).length;
  const density = validRelCount / Math.max(1, subgraph.nodes.length * (subgraph.nodes.length - 1));
  if (density > 0.3) {
    insights.push(`Grafo denso (${(density * 100).toFixed(1)}% densidad)`);
  } else {
    insights.push(`Grafo sparse (${(density * 100).toFixed(1)}% densidad)`);
  }

  // Insight 2: Top central node
  const centrality = calculateCentrality(subgraph);
  const topCentral = Object.entries(centrality)
    .sort((a, b) => b[1] - a[1])[0];
  
  if (topCentral) {
    insights.push(`Nodo más central: ${topCentral[0]}`);
  }

  // Insight 3: Relation types (SAFETY: filter valid relations)
  const validRelations = subgraph.relations.filter(isValidRelation);
  const relTypes = new Set(
    validRelations
      .map(r => safeString(r.type))
      .filter(t => t.length > 0)
  );
  if (relTypes.size > 0) {
    insights.push(`Tipos de relación: ${Array.from(relTypes).join(', ')}`);
  }

  return insights;
}

  return insights;
}

/**
 * Create confidence map
 * 
 * Maps which nodes are included with confidence scores
 * and what was discarded
 */
function createConfidenceMap(selectedNodes, allScoredNodes) {
  const confidenceMap = {};

  selectedNodes.forEach(node => {
    confidenceMap[node.name] = {
      included: true,
      score: node.score,
      breakdown: node.scoreBreakdown,
      confidence: Math.round(node.score * 100)
    };
  });

  // Also note top discarded nodes (for debugging)
  const discarded = allScoredNodes
    .slice(selectedNodes.length)
    .slice(0, 5); // Top 5 discarded

  return {
    included: confidenceMap,
    discardedTop5: discarded.map(n => ({
      name: n.name,
      score: n.score,
      reason: 'Outside top-K threshold'
    }))
  };
}

/**
 * EXPORT for testing
 */
export {
  scoreNodesByRelevance,
  selectTopKNodes,
  buildSubgraph,
  generateContextSummary,
  createConfidenceMap,
  calculateCentrality
};
