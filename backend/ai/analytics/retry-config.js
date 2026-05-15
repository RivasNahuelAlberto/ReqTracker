/**
 * ETAPA 1: Retry Configuration
 * Configuración de reintentos automáticos para llamadas a Python Analytics
 * 
 * Estrategia: Exponential backoff con jitter
 * Reintentos: 3 máximo
 * Base delay: 200ms
 */

import StructuredLogger from '../logger/structured.logger.js';

const logger = new StructuredLogger('analytics-retry');

/**
 * Configuración base de reintentos
 */
export const RETRY_CONFIG = {
  retries: 3,
  minDelay: 200,
  maxDelay: 5000,
  factor: 2,
  jitter: true,
  randomization: 0.1,
  
  // Predicados para decidir si reintentar
  onRetry: (error, attempt) => {
    logger.debug('Analytics retry attempt', {
      attempt,
      error: error.message,
      code: error.code
    });
  }
};

/**
 * Calcula delay exponencial con jitter para reintento
 * Fórmula: min(baseDelay * (factor ^ attempt) + random, maxDelay)
 * 
 * @param {number} attempt - Número de intento (0, 1, 2, ...)
 * @param {Object} config - Configuración de retry
 * @returns {number} Delay en milisegundos
 */
export function calculateRetryDelay(attempt, config = RETRY_CONFIG) {
  const exponentialDelay = config.minDelay * Math.pow(config.factor, attempt);
  const delay = Math.min(exponentialDelay, config.maxDelay);
  
  // Agregar jitter
  if (config.jitter) {
    const jitterAmount = delay * config.randomization;
    return delay + Math.random() * jitterAmount;
  }
  
  return delay;
}

/**
 * Determina si se debe reintentar un error
 * 
 * @param {Error} error - Error a evaluar
 * @param {number} attempt - Número de intento actual
 * @param {Object} config - Configuración
 * @returns {boolean} True si se debe reintentar
 */
export function shouldRetry(error, attempt, config = RETRY_CONFIG) {
  // No reintentar si ya excedimos máximo de intentos
  if (attempt >= config.retries) {
    return false;
  }
  
  // Casos donde SÍ reintentar:
  // 1. Errores de red (timeout, ECONNREFUSED, etc.)
  const networkErrors = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ENETUNREACH'];
  if (networkErrors.includes(error.code)) {
    return true;
  }
  
  // 2. Errores 5xx (server error - puede ser transitorio)
  if (error.statusCode >= 500 && error.statusCode < 600) {
    return true;
  }
  
  // 3. Error 408 (Request Timeout)
  if (error.statusCode === 408) {
    return true;
  }
  
  // 4. Error 429 (Too Many Requests - rate limit)
  if (error.statusCode === 429) {
    return true;
  }
  
  // Casos donde NO reintentar:
  // 1. Errores 4xx excepto 408 y 429
  if (error.statusCode >= 400 && error.statusCode < 500) {
    return false;
  }
  
  // 2. Errores sin código de estado (probablemente local)
  if (!error.statusCode) {
    return true;
  }
  
  return false;
}

/**
 * Valida que un error sea elegible para circuit breaker
 * vs simplemente reintentar
 * 
 * @param {Error} error - Error a evaluar
 * @returns {boolean} True si es error que debe abrir circuit breaker
 */
export function isCircuitBreakerError(error) {
  // Circuit breaker se abre si:
  // 1. Demasiados 5xx
  // 2. Conexión rechazada consistentemente
  // 3. Timeout consistente
  
  const criticalErrors = [
    'ECONNREFUSED',    // Analytics no está corriendo
    'ETIMEDOUT',       // Timeout = analytics muy lento
  ];
  
  if (criticalErrors.includes(error.code)) {
    return true;
  }
  
  // 5xx sostenidos también abren circuit
  if (error.statusCode >= 500) {
    return true;
  }
  
  return false;
}

export default {
  RETRY_CONFIG,
  calculateRetryDelay,
  shouldRetry,
  isCircuitBreakerError
};
