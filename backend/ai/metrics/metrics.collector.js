/**
 * Metrics Collection Module
 * Tracks tool execution performance, success rates, and cache hit rates
 */

class MetricsCollector {
  constructor() {
    this.metrics = {};
    this.startTime = Date.now();
  }

  /**
   * Record a tool execution
   * 
   * @param {string} toolName - Name of the tool
   * @param {number} duration - Execution duration in ms
   * @param {boolean} success - Whether execution was successful
   * @param {boolean} cacheHit - Whether result came from cache
   * @param {Error} error - Error if any
   */
  recordToolExecution(toolName, duration, success, cacheHit = false, error = null) {
    if (!this.metrics[toolName]) {
      this.metrics[toolName] = {
        name: toolName,
        executions: [],
        stats: {
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          cacheHits: 0,
          cacheMisses: 0,
          totalDuration: 0,
          minDuration: Infinity,
          maxDuration: -Infinity,
          avgDuration: 0,
          successRate: 0,
          cacheHitRate: 0,
          errorCounts: {}
        }
      };
    }

    const tool = this.metrics[toolName];
    
    // Record execution
    tool.executions.push({
      timestamp: Date.now(),
      duration,
      success,
      cacheHit,
      error: error ? error.message : null
    });
    
    // Keep only last 1000 executions in memory (for performance)
    if (tool.executions.length > 1000) {
      tool.executions = tool.executions.slice(-1000);
    }

    // Update stats
    tool.stats.totalExecutions++;
    
    if (success) {
      tool.stats.successfulExecutions++;
    } else {
      tool.stats.failedExecutions++;
      if (error) {
        const errorType = error.code || error.name || 'UNKNOWN';
        tool.stats.errorCounts[errorType] = (tool.stats.errorCounts[errorType] || 0) + 1;
      }
    }

    if (cacheHit) {
      tool.stats.cacheHits++;
    } else {
      tool.stats.cacheMisses++;
    }

    tool.stats.totalDuration += duration;
    tool.stats.minDuration = Math.min(tool.stats.minDuration, duration);
    tool.stats.maxDuration = Math.max(tool.stats.maxDuration, duration);
    tool.stats.avgDuration = tool.stats.totalDuration / tool.stats.totalExecutions;
    tool.stats.successRate = (tool.stats.successfulExecutions / tool.stats.totalExecutions) * 100;
    
    const totalCacheOps = tool.stats.cacheHits + tool.stats.cacheMisses;
    tool.stats.cacheHitRate = totalCacheOps > 0 
      ? (tool.stats.cacheHits / totalCacheOps) * 100 
      : 0;
  }

  /**
   * Get metrics for all tools or a specific tool
   * 
   * @param {string} toolName - Optional specific tool name
   * @returns {object} - Metrics object
   */
  getMetrics(toolName = null) {
    if (toolName) {
      return this.metrics[toolName] || null;
    }

    // Calculate aggregate stats
    const allTools = Object.values(this.metrics);
    const aggregated = {
      uptime: Date.now() - this.startTime,
      totalTools: allTools.length,
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalCacheHits: 0,
      totalCacheMisses: 0,
      overallSuccessRate: 0,
      overallCacheHitRate: 0,
      averageToolLatency: 0,
      tools: {}
    };

    for (const tool of allTools) {
      const stats = tool.stats;
      aggregated.totalExecutions += stats.totalExecutions;
      aggregated.successfulExecutions += stats.successfulExecutions;
      aggregated.failedExecutions += stats.failedExecutions;
      aggregated.totalCacheHits += stats.cacheHits;
      aggregated.totalCacheMisses += stats.cacheMisses;
      aggregated.averageToolLatency += stats.avgDuration;
      
      aggregated.tools[tool.name] = {
        executions: stats.totalExecutions,
        successful: stats.successfulExecutions,
        failed: stats.failedExecutions,
        successRate: stats.successRate.toFixed(2) + '%',
        avgDuration: stats.avgDuration.toFixed(2) + 'ms',
        minDuration: stats.minDuration === Infinity ? 0 : stats.minDuration,
        maxDuration: stats.maxDuration === -Infinity ? 0 : stats.maxDuration,
        cacheHitRate: stats.cacheHitRate.toFixed(2) + '%',
        cacheHits: stats.cacheHits,
        cacheMisses: stats.cacheMisses,
        errors: stats.errorCounts
      };
    }

    if (allTools.length > 0) {
      aggregated.overallSuccessRate = (aggregated.successfulExecutions / aggregated.totalExecutions) * 100;
      const totalCacheOps = aggregated.totalCacheHits + aggregated.totalCacheMisses;
      aggregated.overallCacheHitRate = totalCacheOps > 0 
        ? (aggregated.totalCacheHits / totalCacheOps) * 100 
        : 0;
      aggregated.averageToolLatency = aggregated.averageToolLatency / allTools.length;
    }

    return aggregated;
  }

  /**
   * Get health status based on metrics
   * 
   * @returns {object} - Health status
   */
  getHealthStatus() {
    const metrics = this.getMetrics();
    const status = {
      healthy: true,
      issues: []
    };

    // Check success rate
    if (metrics.totalExecutions > 0 && metrics.overallSuccessRate < 90) {
      status.healthy = false;
      status.issues.push(`Low success rate: ${metrics.overallSuccessRate.toFixed(2)}%`);
    }

    // Check cache hit rate
    if (metrics.totalCacheHits + metrics.totalCacheMisses > 0 && metrics.overallCacheHitRate < 30) {
      status.issues.push(`Low cache hit rate: ${metrics.overallCacheHitRate.toFixed(2)}%`);
    }

    // Check for tools with high failure rate
    for (const [toolName, toolMetrics] of Object.entries(metrics.tools)) {
      const failureRate = 100 - parseFloat(toolMetrics.successRate);
      if (failureRate > 10) {
        status.healthy = false;
        status.issues.push(`${toolName}: ${failureRate.toFixed(2)}% failure rate`);
      }
    }

    return status;
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metrics = {};
    this.startTime = Date.now();
  }

  /**
   * Export metrics to JSON
   */
  toJSON() {
    return {
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      metrics: this.getMetrics()
    };
  }
}

// Export singleton instance
export default new MetricsCollector();
