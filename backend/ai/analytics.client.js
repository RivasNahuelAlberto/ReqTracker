/**
 * ETAPA 1: Analytics Client
 * 
 * Gateway robusto entre Node Backend y Python Analytics Service
 * 
 * Responsabilidades:
 * 1. Circuit breaker (detener cascading failures)
 * 2. Retry automático con exponential backoff
 * 3. Timeout dinámico
 * 4. Redis cache
 * 5. Métricas de latencia
 * 6. Fallbacks elegantes
 * 
 * CRÍTICO: Este cliente es lo que mantiene al agente vivo si analytics cae
 */

import fetch from 'node-fetch';
import crypto from 'crypto';
import StructuredLogger from '../logger/structured.logger.js';
import { getRedisCache } from '../cache/redis.cache.js';
import { getAnalyticsCircuitBreaker } from './analytics/circuit-breaker.js';
import { getMetricsCollector } from './analytics/metrics-collector.js';
import { 
  RETRY_CONFIG, 
  calculateRetryDelay, 
  shouldRetry,
  isCircuitBreakerError 
} from './analytics/retry-config.js';

const logger = new StructuredLogger('analytics-client');

/**
 * Analytics Client - Gateway robusto a Python Analytics Service
 */
export class AnalyticsClient {
  constructor(analyticsUrl = null, options = {}) {
    this.analyticsUrl = analyticsUrl || process.env.ANALYTICS_URL || 'http://localhost:8000';
    this.circuitBreaker = getAnalyticsCircuitBreaker(options.circuitBreakerConfig);
    this.metrics = getMetricsCollector();
    this.cacheEnabled = options.cacheEnabled !== false;
    this.cacheTTL = options.cacheTTL || 1800; // 30 minutos default
    
    logger.info('Analytics client initialized', {
      analyticsUrl: this.analyticsUrl,
      cacheEnabled: this.cacheEnabled,
      cacheTTL: this.cacheTTL
    });
  }
  
  /**
   * Calcula timeout dinámico basado en tamaño del proyecto
   * CRÍTICO: Evitar timeouts falsos en proyectos grandes
   * 
   * Fórmula: 5s base + (projectSize/200)*1s, máximo 15s
   */
  calculateTimeout(projectSize = 0) {
    const baseTimeout = 5000;           // 5 segundos
    const maxTimeout = 15000;           // Máximo 15 segundos
    const additionalPerReq = (projectSize / 200) * 1000;
    
    const timeout = Math.min(baseTimeout + additionalPerReq, maxTimeout);
    return Math.round(timeout);
  }
  
  /**
   * Genera cache key para una llamada a analytics
   * @param {string} endpoint - Endpoint (ej: /semantic/health)
   * @param {Object} payload - Payload de request
   * @returns {string} Cache key
   */
  generateCacheKey(endpoint, payload) {
    const hash = crypto
      .createHash('md5')
      .update(JSON.stringify(payload))
      .digest('hex');
    
    return `analytics:${endpoint}:${hash}`;
  }
  
  /**
   * Obtiene resultado del cache
   */
  async getFromCache(key) {
    if (!this.cacheEnabled) return null;
    
    try {
      const redis = getRedisCache();
      if (!redis) return null;
      
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      logger.warn('Cache get failed', { error: error.message });
    }
    
    return null;
  }
  
  /**
   * Guarda resultado en cache
   */
  async setCache(key, value) {
    if (!this.cacheEnabled) return;
    
    try {
      const redis = getRedisCache();
      if (!redis) return;
      
      await redis.setex(key, this.cacheTTL, JSON.stringify(value));
    } catch (error) {
      logger.warn('Cache set failed', { error: error.message });
    }
  }
  
  /**
   * Llamada a endpoint de Analytics CON reintentos, circuit breaker, cache
   */
  async callAnalytics(endpoint, payload, options = {}) {
    const startTime = Date.now();
    const projectSize = payload?.projectId ? 100 : options.projectSize || 0; // Estimate
    const timeout = this.calculateTimeout(projectSize);
    
    logger.debug('Analytics call starting', {
      endpoint,
      timeout,
      projectSize
    });
    
    // 1. CACHE CHECK
    const cacheKey = this.generateCacheKey(endpoint, payload);
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      const duration = Date.now() - startTime;
      this.metrics.recordSuccess(endpoint, duration, true);
      logger.debug('Analytics response (from cache)', { endpoint, duration });
      return cached;
    }
    
    // 2. CIRCUIT BREAKER + RETRY
    let lastError = null;
    let attempt = 0;
    
    while (attempt <= RETRY_CONFIG.retries) {
      try {
        const result = await this.circuitBreaker.execute(async () => {
          return await this._makeRequest(endpoint, payload, timeout);
        });
        
        // Éxito: guardar en cache y retornar
        const duration = Date.now() - startTime;
        this.metrics.recordSuccess(endpoint, duration, false);
        await this.setCache(cacheKey, result);
        
        logger.debug('Analytics response (success)', {
          endpoint,
          duration,
          attempt
        });
        
        return result;
      } catch (error) {
        lastError = error;
        
        // Si es error de circuit breaker, no reintentar
        if (error.code === 'CIRCUIT_BREAKER_OPEN') {
          this.metrics.recordCircuitBreakerOpen();
          throw error; // Fallar rápido
        }
        
        // Decidir si reintentar
        if (!shouldRetry(error, attempt, RETRY_CONFIG)) {
          throw error;
        }
        
        // Reintentar
        attempt++;
        if (attempt <= RETRY_CONFIG.retries) {
          const delay = calculateRetryDelay(attempt - 1, RETRY_CONFIG);
          logger.warn('Analytics retry', {
            endpoint,
            attempt,
            delay,
            error: error.message
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // Todos los reintentos fallaron
    const duration = Date.now() - startTime;
    this.metrics.recordFailure(endpoint, lastError, duration);
    throw lastError;
  }
  
  /**
   * Realiza la llamada HTTP actual
   */
  async _makeRequest(endpoint, payload, timeout) {
    const url = `${this.analyticsUrl}${endpoint}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
        timeout
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const error = new Error(`Analytics error: ${response.status} ${response.statusText}`);
        error.statusCode = response.status;
        
        // Intentar leer body de error
        try {
          error.detail = await response.text();
        } catch {}
        
        throw error;
      }
      
      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      
      // Convertir AbortError a nuestro formato
      if (error.name === 'AbortError') {
        const timeoutError = new Error(`Analytics timeout (${timeout}ms)`);
        timeoutError.code = 'ETIMEDOUT';
        throw timeoutError;
      }
      
      // Convertir fetch errors
      if (error.cause) {
        error.code = error.cause.code || 'FETCH_ERROR';
      }
      
      throw error;
    }
  }
  
  /**
   * FALLBACK API: Llamar a analytics CON fallback elegante
   * Si analytics cae, retorna resultado empty pero no crashea
   */
  async callAnalyticsWithFallback(endpoint, payload, fallbackValue = null, options = {}) {
    try {
      return await this.callAnalytics(endpoint, payload, options);
    } catch (error) {
      logger.warn('Analytics call failed, using fallback', {
        endpoint,
        error: error.message,
        code: error.code
      });
      
      // Retornar fallback (puede ser null, empty array, etc.)
      if (fallbackValue !== null) {
        return fallbackValue;
      }
      
      // Default fallbacks
      if (endpoint.includes('health')) {
        return { status: 'unknown', message: 'Analytics unavailable' };
      }
      
      return { error: 'Analytics service unavailable', fallback: true };
    }
  }
  
  /**
   * Convenience methods para análisis común
   */
  
  /**
   * Analizar requisito
   */
  async analyzeRequirement(projectId, text, options = {}) {
    return this.callAnalytics('/analyze/requirement', {
      projectId,
      text,
      ...options
    });
  }
  
  /**
   * Similitud semántica
   */
  async findSimilar(projectId, text, threshold = 0.75, limit = 5) {
    return this.callAnalytics('/analyze/similarity', {
      projectId,
      text,
      threshold,
      limit
    });
  }
  
  /**
   * Analizar grafo
   */
  async analyzeGraph(projectId, symbols = [], requirements = []) {
    return this.callAnalyticsWithFallback('/graph/analyze', {
      projectId,
      symbols,
      requirements
    }, {
      message: 'Graph analysis unavailable',
      centrality: {},
      communities: []
    });
  }
  
  /**
   * Predecir riesgo
   */
  async predictRisk(projectId, symbols = [], requirements = []) {
    return this.callAnalyticsWithFallback('/predict/risk', {
      projectId,
      symbols,
      requirements
    }, {
      message: 'Risk prediction unavailable',
      riskScores: {}
    });
  }
  
  /**
   * Health check
   */
  async health() {
    try {
      const result = await this._makeRequest('/health', {}, 5000);
      return result;
    } catch (error) {
      logger.error('Analytics health check failed', {
        error: error.message,
        url: this.analyticsUrl
      });
      
      return {
        status: 'unreachable',
        error: error.message,
        url: this.analyticsUrl
      };
    }
  }
  
  /**
   * Obtener estado del circuit breaker
   */
  getCircuitBreakerStatus() {
    return this.circuitBreaker.getStatus();
  }
  
  /**
   * Obtener métricas
   */
  getMetrics() {
    return this.metrics.getStats();
  }
  
  /**
   * Obtener métricas por endpoint
   */
  getMetricsByEndpoint() {
    return this.metrics.getStatsByEndpoint();
  }
}

/**
 * Singleton global
 */
let globalClient = null;

export function getAnalyticsClient(options = {}) {
  if (!globalClient) {
    globalClient = new AnalyticsClient(options.analyticsUrl, options);
  }
  return globalClient;
}

/**
 * Reset del cliente (para testing)
 */
export function resetAnalyticsClient() {
  globalClient = null;
}

export default {
  AnalyticsClient,
  getAnalyticsClient,
  resetAnalyticsClient
};
