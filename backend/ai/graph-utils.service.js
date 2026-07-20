/**
 * GRAPH UTILITIES
 * 
 * Helper functions for graph operations using GSE
 */

import { GraphSanityEngine } from './graph-sanity-engine.service.js';
import StructuredLogger from './logger/structured.logger.js';

const logger = new StructuredLogger('graph-utils');

export class GraphUtils {
  constructor() {
    this.gse = new GraphSanityEngine();
  }

  /**
   * Validate and normalize a graph using GSE
   * 
   * @param {*} graph - Raw graph from getProjectGraph()
   * @returns {Promise<{valid: boolean, graph: object}>}
   */
  async validateAndNormalize(graph) {
    try {
      const result = await this.gse.run({
        graph,
        startNode: null,
        depthLimit: 2
      });

      return {
        valid: result.validation.valid,
        graph: result.graph,
        issues: result.validation.issues,
        stability: result.stability
      };
    } catch (error) {
      logger.error('❌ GRAPH VALIDATION FAILED', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Trace a path in the graph from a starting node
   * 
   * @param {object} graph - Validated graph
   * @param {string} startNode - Node label or ID to start from
   * @param {number} depth - Maximum traversal depth
   * @returns {Promise<object>} Traversal trace
   */
  async traceGraph(graph, startNode, depth = 3) {
    try {
      const result = await this.gse.run({
        graph,
        startNode,
        depthLimit: depth
      });

      return result.traversal;
    } catch (error) {
      logger.error('❌ GRAPH TRACE FAILED', {
        error: error.message,
        startNode
      });
      throw error;
    }
  }

  /**
   * Analyze graph stability
   * 
   * @param {object} graph - Normalized graph
   * @returns {object} Stability report
   */
  analyzeStability(graph) {
    return this.gse.analyzeStability(graph);
  }
}

// Export singleton instance
export const graphUtils = new GraphUtils();
