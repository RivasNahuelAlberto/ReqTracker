/**
 * GRAPH SANITY ENGINE v1
 * -----------------------
 * Purpose:
 * - Normalize graph input
 * - Validate structural integrity
 * - Trace traversals (DFS/BFS)
 * - Detect anomalies
 * - Produce explainability ledger
 */

import StructuredLogger from './logger/structured.logger.js';

const logger = new StructuredLogger('graph-sanity-engine');

export class GraphSanityEngine {
  constructor(config = {}) {
    this.config = {
      defaultDepthLimit: 3,
      minScoreThreshold: 0.3,
      enableTrace: true,
      enableStabilityChecks: true,
      ...config
    };
  }

  // =========================
  // 1. ENTRY POINT
  // =========================
  async run({
    graph,
    startNode,
    depthLimit = this.config.defaultDepthLimit,
    scoreFn = null
  }) {
    try {
      const normalized = this.normalizeGraph(graph);

      const validation = this.validateGraph(normalized);

      const traversal = this.config.enableTrace
        ? this.traceTraversal({
            graph: normalized,
            startNode,
            depthLimit,
            scoreFn
          })
        : null;

      const stability = this.config.enableStabilityChecks
        ? this.analyzeStability(normalized)
        : null;

      logger.info('🧠 GRAPH SANITY ENGINE COMPLETE', {
        nodesNormalized: normalized.nodes.length,
        edgesNormalized: normalized.edges.length,
        validationPassed: validation.valid,
        issues: validation.issues.length
      });

      return {
        graph: normalized,
        validation,
        traversal,
        stability,
        metadata: {
          nodes: normalized.nodes.length,
          edges: normalized.edges.length,
          depthLimit,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('❌ GRAPH SANITY ENGINE FAILED', {
        error: error.message
      });
      throw error;
    }
  }

  // =========================
  // 2. NORMALIZATION LAYER
  // =========================
  normalizeGraph(graph) {
    if (!graph) {
      return { nodes: [], edges: [] };
    }

    // Case: already correct format
    if (
      graph.nodes &&
      Array.isArray(graph.nodes) &&
      graph.edges &&
      Array.isArray(graph.edges)
    ) {
      return {
        nodes: this.cleanNodes(graph.nodes),
        edges: this.cleanEdges(graph.edges)
      };
    }

    // Case: relations format (from relations.tool.js)
    if (Array.isArray(graph.relations)) {
      return this.fromRelations(graph);
    }

    // Case: array of relations (legacy format)
    if (Array.isArray(graph)) {
      return this.fromRelationsArray(graph);
    }

    return { nodes: [], edges: [] };
  }

  fromRelations(graph) {
    const nodesMap = new Map();
    const edges = [];

    const relations = Array.isArray(graph.relations) ? graph.relations : [];

    for (const rel of relations) {
      if (!rel) continue;

      // Extract source and target from relation
      const source = {
        id: rel.fromId || rel.from || `node-${Math.random()}`,
        label: rel.fromName || rel.fromId || 'origen?',
        type: rel.fromType || 'unknown'
      };

      const target = {
        id: rel.toId || rel.to || `node-${Math.random()}`,
        label: rel.toName || rel.toId || 'destino?',
        type: rel.toType || 'unknown'
      };

      nodesMap.set(source.id, source);
      nodesMap.set(target.id, target);

      edges.push({
        id: rel.id || `${source.id}-${target.id}`,
        source: source.id,
        target: target.id,
        type: rel.type || 'unknown',
        strength: rel.strength ?? 1
      });
    }

    return {
      nodes: Array.from(nodesMap.values()),
      edges
    };
  }

  fromRelationsArray(relArray) {
    const nodesMap = new Map();
    const edges = [];

    for (const rel of relArray) {
      if (!rel) continue;

      const source = {
        id: rel.fromId || `node-${Math.random()}`,
        label: rel.fromName || 'origen?',
        type: rel.fromType || 'unknown'
      };

      const target = {
        id: rel.toId || `node-${Math.random()}`,
        label: rel.toName || 'destino?',
        type: rel.toType || 'unknown'
      };

      nodesMap.set(source.id, source);
      nodesMap.set(target.id, target);

      edges.push({
        id: rel.id || `${source.id}-${target.id}`,
        source: source.id,
        target: target.id,
        type: rel.type || 'unknown',
        strength: rel.strength ?? 1
      });
    }

    return {
      nodes: Array.from(nodesMap.values()),
      edges
    };
  }

  cleanNodes(nodes) {
    return nodes
      .filter(n => n && (n.id || n.label || n.name))
      .map(n => ({
        id: n.id || `node-${Math.random()}`,
        label: n.label || n.name || 'unnamed',
        type: n.type || 'generic'
      }));
  }

  cleanEdges(edges) {
    return edges
      .filter(e => e && (e.source || e.from) && (e.target || e.to))
      .map(e => ({
        id: e.id || `${e.source}-${e.target}`,
        source: e.source || e.from,
        target: e.target || e.to,
        type: e.type || 'unknown',
        weight: e.weight ?? e.strength ?? 1
      }));
  }

  // =========================
  // 3. VALIDATION LAYER
  // =========================
  validateGraph(graph) {
    const issues = [];

    const nodeIds = new Set(graph.nodes.map(n => n.id));

    // Check for broken edges
    for (const edge of graph.edges) {
      if (!nodeIds.has(edge.source)) {
        issues.push({
          type: 'BROKEN_EDGE_SOURCE',
          edge: edge.id,
          sourceId: edge.source
        });
      }

      if (!nodeIds.has(edge.target)) {
        issues.push({
          type: 'BROKEN_EDGE_TARGET',
          edge: edge.id,
          targetId: edge.target
        });
      }
    }

    // Check for missing labels
    for (const node of graph.nodes) {
      if (!node.label || typeof node.label !== 'string') {
        issues.push({
          type: 'MISSING_OR_INVALID_LABEL',
          nodeId: node.id
        });
      }
    }

    return {
      valid: issues.length === 0,
      issueCount: issues.length,
      issues
    };
  }

  // =========================
  // 4. TRAVERSAL ENGINE (CORE)
  // =========================
  traceTraversal({ graph, startNode, depthLimit, scoreFn }) {
    const adjacency = this.buildAdjacency(graph);
    const visited = new Set();
    const trace = [];

    const start = this.findNode(graph, startNode);

    if (!start) {
      logger.warn('⚠️ START NODE NOT FOUND', { startNode });
      return {
        error: 'START_NODE_NOT_FOUND',
        startNode,
        trace: []
      };
    }

    const dfs = (nodeId, depth, path) => {
      if (depth > depthLimit) return;
      if (visited.has(nodeId)) return;

      visited.add(nodeId);

      const node = graph.nodes.find(n => n.id === nodeId);

      trace.push({
        nodeId,
        label: node?.label || 'unknown',
        depth,
        path: [...path, nodeId]
      });

      const neighbors = adjacency[nodeId] || [];

      for (const next of neighbors) {
        const score = scoreFn ? scoreFn(next, depth) : 1;

        if (score < this.config.minScoreThreshold) continue;

        dfs(next, depth + 1, [...path, nodeId]);
      }
    };

    dfs(start.id, 0, []);

    logger.info('📊 TRAVERSAL TRACE COMPLETE', {
      startNode: start.label,
      visitedNodes: visited.size,
      traceLength: trace.length,
      depthLimit
    });

    return {
      startNode: start.id,
      startNodeLabel: start.label,
      visitedNodes: visited.size,
      trace
    };
  }

  buildAdjacency(graph) {
    const adj = {};

    for (const edge of graph.edges) {
      if (!adj[edge.source]) adj[edge.source] = [];
      adj[edge.source].push(edge.target);
    }

    return adj;
  }

  findNode(graph, idOrLabel) {
    if (!idOrLabel) return null;

    // Try exact ID match first
    const byId = graph.nodes.find(n => n.id === idOrLabel);
    if (byId) return byId;

    // Try label match
    const byLabel = graph.nodes.find(
      n =>
        n.label &&
        (n.label === idOrLabel ||
          n.label.toLowerCase() === String(idOrLabel).toLowerCase())
    );

    return byLabel || null;
  }

  // =========================
  // 5. STABILITY ANALYZER
  // =========================
  analyzeStability(graph) {
    const fanOut = {};
    const orphans = [];

    const incoming = new Set();
    const outgoing = new Set();

    for (const edge of graph.edges) {
      fanOut[edge.source] = (fanOut[edge.source] || 0) + 1;
      incoming.add(edge.target);
      outgoing.add(edge.source);
    }

    // Find orphan nodes (no incoming or outgoing edges)
    for (const node of graph.nodes) {
      if (!incoming.has(node.id) && !outgoing.has(node.id)) {
        orphans.push(node.id);
      }
    }

    // Find hub nodes (high fan-out)
    const hubs = Object.entries(fanOut)
      .filter(([_, v]) => v > 5)
      .map(([k]) => k);

    const instabilityScore = Math.min(
      1,
      (orphans.length + hubs.length) / (graph.nodes.length || 1)
    );

    logger.info('⚖️ STABILITY ANALYSIS COMPLETE', {
      orphanNodes: orphans.length,
      hubNodes: hubs.length,
      instabilityScore: instabilityScore.toFixed(3)
    });

    return {
      orphanNodes: orphans,
      hubNodes: hubs,
      cyclesDetected: this.detectCycles(graph),
      instabilityScore,
      warnings: this.generateWarnings({
        orphans,
        hubs,
        instabilityScore,
        graphSize: graph.nodes.length
      })
    };
  }

  detectCycles(graph) {
    const visited = new Set();
    const recStack = new Set();
    let cycleCount = 0;

    const dfs = nodeId => {
      visited.add(nodeId);
      recStack.add(nodeId);

      const neighbors = (function() {
        const adj = {};
        for (const edge of graph.edges) {
          if (!adj[edge.source]) adj[edge.source] = [];
          adj[edge.source].push(edge.target);
        }
        return adj;
      })();

      const adjacentNodes = neighbors[nodeId] || [];

      for (const neighbor of adjacentNodes) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        } else if (recStack.has(neighbor)) {
          cycleCount++;
        }
      }

      recStack.delete(nodeId);
    };

    for (const node of graph.nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id);
      }
    }

    return cycleCount;
  }

  generateWarnings({
    orphans,
    hubs,
    instabilityScore,
    graphSize
  }) {
    const warnings = [];

    if (orphans.length > graphSize * 0.1) {
      warnings.push(
        `Graph has ${orphans.length} orphan nodes (${((orphans.length / graphSize) * 100).toFixed(1)}%)`
      );
    }

    if (hubs.length > 3) {
      warnings.push(`Graph has ${hubs.length} hub nodes (high fan-out)`);
    }

    if (instabilityScore > 0.7) {
      warnings.push(
        `Graph instability is high (${(instabilityScore * 100).toFixed(1)}%)`
      );
    }

    return warnings;
  }
}

// Export singleton instance for convenience
export const graphSanityEngine = new GraphSanityEngine();
