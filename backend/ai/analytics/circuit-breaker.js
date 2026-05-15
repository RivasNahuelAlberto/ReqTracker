/**
 * ETAPA 1: Circuit Breaker
 * Implementación simple de circuit breaker para Analytics Service
 * 
 * Estados:
 * - CLOSED: Llamadas pasan normalmente (default)
 * - OPEN: Llamadas fallan rápidamente sin intentar (Analytics probablemente down)
 * - HALF_OPEN: Permitir test requests para ver si Analytics se recuperó
 * 
 * Transiciones:
 * CLOSED → OPEN: Cuando failureThreshold se excede
 * OPEN → HALF_OPEN: Después de timeout
 * HALF_OPEN → CLOSED: Si request exitoso
 * HALF_OPEN → OPEN: Si request falla
 */

import StructuredLogger from '../logger/structured.logger.js';

const logger = new StructuredLogger('analytics-circuit-breaker');

export class CircuitBreaker {
  constructor(options = {}) {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.lastStateChange = Date.now();
    
    // Configuración
    this.failureThreshold = options.failureThreshold || 5;        // Abrir después de 5 fallos
    this.successThreshold = options.successThreshold || 2;        // Cerrar después de 2 éxitos
    this.timeout = options.timeout || 60000;                      // 60 segundos OPEN → HALF_OPEN
    this.resetTimeout = options.resetTimeout || 30000;            // 30s entre resets
    
    this.name = options.name || 'analytics';
  }
  
  /**
   * Intenta pasar una llamada a través del circuit breaker
   * 
   * @param {Function} fn - Función a ejecutar
   * @returns {Promise} Resultado de fn() o error si circuit abierto
   */
  async execute(fn) {
    // Si está OPEN, verificar si debemos pasar a HALF_OPEN
    if (this.state === 'OPEN') {
      const timeSinceOpen = Date.now() - this.lastFailureTime;
      if (timeSinceOpen >= this.timeout) {
        this.transitionTo('HALF_OPEN');
        logger.info(`${this.name}: Circuit breaker transitioned to HALF_OPEN`, {
          timeSinceOpen
        });
      } else {
        const err = new Error(`${this.name}: Circuit breaker is OPEN (not ready for recovery)`);
        err.code = 'CIRCUIT_BREAKER_OPEN';
        throw err;
      }
    }
    
    // Ejecutar la función
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }
  
  /**
   * Manejador de éxito
   */
  onSuccess() {
    this.failureCount = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      
      if (this.successCount >= this.successThreshold) {
        this.transitionTo('CLOSED');
        logger.info(`${this.name}: Circuit breaker transitioned to CLOSED`, {
          successCount: this.successCount
        });
      }
    }
  }
  
  /**
   * Manejador de fallo
   * @param {Error} error
   */
  onFailure(error) {
    this.lastFailureTime = Date.now();
    this.failureCount++;
    this.successCount = 0;
    
    logger.warn(`${this.name}: Failure recorded`, {
      failureCount: this.failureCount,
      threshold: this.failureThreshold,
      error: error.message,
      code: error.code
    });
    
    if (this.state === 'HALF_OPEN') {
      // Si fallamos en HALF_OPEN, volver a OPEN
      this.transitionTo('OPEN');
      logger.warn(`${this.name}: Circuit breaker transitioned to OPEN (HALF_OPEN test failed)`);
    } else if (this.state === 'CLOSED' && this.failureCount >= this.failureThreshold) {
      // Si alcanzamos threshold en CLOSED, abrir
      this.transitionTo('OPEN');
      logger.error(`${this.name}: Circuit breaker transitioned to OPEN (failure threshold exceeded)`, {
        failureCount: this.failureCount,
        threshold: this.failureThreshold
      });
    }
  }
  
  /**
   * Transiciona a un nuevo estado
   */
  transitionTo(newState) {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = Date.now();
    
    if (newState === 'CLOSED') {
      this.failureCount = 0;
      this.successCount = 0;
    } else if (newState === 'HALF_OPEN') {
      this.successCount = 0;
    }
    
    logger.info(`${this.name}: Circuit breaker state change`, {
      oldState,
      newState,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Retorna el estado actual del circuit breaker
   */
  getStatus() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      timeSinceLastFailure: this.lastFailureTime ? Date.now() - this.lastFailureTime : null,
      lastStateChange: this.lastStateChange,
      isOpen: this.state === 'OPEN',
      isClosed: this.state === 'CLOSED',
      isHalfOpen: this.state === 'HALF_OPEN',
      canAttempt: this.state !== 'OPEN'
    };
  }
  
  /**
   * Reset manual del circuit breaker
   */
  reset() {
    this.transitionTo('CLOSED');
    logger.info(`${this.name}: Circuit breaker manually reset`);
  }
}

/**
 * Factory para crear circuit breaker singleton
 */
let analyticsBreaker = null;

export function getAnalyticsCircuitBreaker(options = {}) {
  if (!analyticsBreaker) {
    analyticsBreaker = new CircuitBreaker({
      name: 'analytics',
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000,
      ...options
    });
  }
  return analyticsBreaker;
}

export default {
  CircuitBreaker,
  getAnalyticsCircuitBreaker
};
