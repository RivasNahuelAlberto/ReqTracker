/**
 * ETAPA 1: Metrics Collector
 * Recolecta métricas de latencia, uso y performance del servicio Analytics
 */

import StructuredLogger from '../logger/structured.logger.js';

const logger = new StructuredLogger('analytics-metrics');

export class MetricsCollector {
  constructor(windowSize = 100) {
    this.metrics = {
      requests: [],
      cacheHits: 0,
      cacheMisses: 0,
      circuitBreakerOpens: 0,
      failures: 0,
      totalDuration: 0
    };
    
    this.windowSize = windowSize; // Mantener últimas N requests
  }
  
  /**
   * Registra una llamada a analytics exitosa
   * @param {string} endpoint - Endpoint llamado
   * @param {number} duration - Duración en ms
   * @param {boolean} cached - Si fue cached
   */
  recordSuccess(endpoint, duration, cached = false) {
    this.recordMetric({
      endpoint,
      duration,
      cached,
      success: true,
      timestamp: Date.now()
    });
    
    if (cached) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }
  }
  
  /**
   * Registra una llamada fallida
   * @param {string} endpoint - Endpoint que falló
   * @param {Error} error - Error ocurrido
   * @param {number} duration - Duración antes del error
   */
  recordFailure(endpoint, error, duration) {
    this.recordMetric({
      endpoint,
      duration,
      error: error.message,
      code: error.code,
      success: false,
      timestamp: Date.now()
    });
    
    this.metrics.failures++;
  }
  
  /**
   * Registra apertura del circuit breaker
   */
  recordCircuitBreakerOpen() {
    this.metrics.circuitBreakerOpens++;
    logger.warn('Circuit breaker opened', {
      totalOpens: this.metrics.circuitBreakerOpens
    });
  }
  
  /**
   * Registra una métrica individual
   */
  recordMetric(metric) {
    this.metrics.requests.push(metric);
    this.metrics.totalDuration += metric.duration || 0;
    
    // Mantener ventana deslizante
    if (this.metrics.requests.length > this.windowSize) {
      const removed = this.metrics.requests.shift();
      this.metrics.totalDuration -= removed.duration || 0;
    }
  }
  
  /**
   * Obtiene estadísticas de performance
   */
  getStats() {
    const requests = this.metrics.requests;
    
    if (requests.length === 0) {
      return {
        totalRequests: 0,
        successRate: null,
        avgLatency: null,
        p95Latency: null,
        p99Latency: null,
        cacheHitRate: null,
        uptime: null
      };
    }
    
    // Éxito rate
    const successCount = requests.filter(r => r.success).length;
    const successRate = (successCount / requests.length) * 100;
    
    // Latencias
    const durations = requests.map(r => r.duration || 0).sort((a, b) => a - b);
    const avgLatency = durations.reduce((a, b) => a + b, 0) / durations.length;
    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);
    const p95Latency = durations[p95Index];
    const p99Latency = durations[p99Index];
    
    // Cache hit rate
    const totalCalls = this.metrics.cacheHits + this.metrics.cacheMisses;
    const cacheHitRate = totalCalls > 0 ? (this.metrics.cacheHits / totalCalls) * 100 : 0;
    
    // Uptime (si no hay failures recientes)
    const recentFailures = requests
      .filter(r => !r.success)
      .filter(r => Date.now() - r.timestamp < 60000); // Últimos 60s
    const uptime = recentFailures.length === 0 ? 100 : ((requests.length - recentFailures.length) / requests.length) * 100;
    
    return {
      totalRequests: requests.length,
      successRate: successRate.toFixed(2),
      avgLatency: avgLatency.toFixed(2),
      p95Latency: p95Latency.toFixed(2),
      p99Latency: p99Latency.toFixed(2),
      cacheHitRate: cacheHitRate.toFixed(2),
      uptime: uptime.toFixed(2),
      totalCacheHits: this.metrics.cacheHits,
      totalCacheMisses: this.metrics.cacheMisses,
      totalFailures: this.metrics.failures,
      circuitBreakerOpens: this.metrics.circuitBreakerOpens
    };
  }
  
  /**
   * Obtiene estadísticas por endpoint
   */
  getStatsByEndpoint() {
    const byEndpoint = {};
    
    for (const metric of this.metrics.requests) {
      if (!byEndpoint[metric.endpoint]) {
        byEndpoint[metric.endpoint] = [];
      }
      byEndpoint[metric.endpoint].push(metric);
    }
    
    const stats = {};
    for (const [endpoint, metrics] of Object.entries(byEndpoint)) {
      const successes = metrics.filter(m => m.success).length;
      const durations = metrics.map(m => m.duration || 0).sort((a, b) => a - b);
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      
      stats[endpoint] = {
        calls: metrics.length,
        successes,
        failures: metrics.length - successes,
        successRate: ((successes / metrics.length) * 100).toFixed(2),
        avgLatency: avgDuration.toFixed(2),
        minLatency: durations[0].toFixed(2),
        maxLatency: durations[durations.length - 1].toFixed(2)
      };
    }
    
    return stats;
  }
  
  /**
   * Reset de métricas
   */
  reset() {
    this.metrics = {
      requests: [],
      cacheHits: 0,
      cacheMisses: 0,
      circuitBreakerOpens: 0,
      failures: 0,
      totalDuration: 0
    };
  }
}

/**
 * Singleton global de metrics
 */
let globalMetrics = null;

export function getMetricsCollector() {
  if (!globalMetrics) {
    globalMetrics = new MetricsCollector(100);
  }
  return globalMetrics;
}

export default {
  MetricsCollector,
  getMetricsCollector
};
