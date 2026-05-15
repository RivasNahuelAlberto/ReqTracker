/**
 * Redis Client Wrapper
 * 
 * Proporciona acceso al cliente de Redis con graceful degradation.
 * Si Redis no está disponible, retorna null y el sistema continúa sin caché.
 */

import redis from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let redisClient = null;
let redisConnected = false;
let initPromise = null;

/**
 * Inicializa conexión a Redis
 * No lanza errores, solo log de warnings si falla
 */
export async function initRedisClient() {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      redisClient = redis.createClient({ url: REDIS_URL });

      redisClient.on('error', (err) => {
        console.warn('⚠️ Redis client error:', err.message);
        redisConnected = false;
      });

      redisClient.on('connect', () => {
        console.log('✅ Redis client connected');
        redisConnected = true;
      });

      await redisClient.connect();
      redisConnected = true;
      return true;
    } catch (error) {
      console.warn('⚠️ Redis client init failed:', error.message);
      console.log('📝 Continuing without Redis (performance degraded)');
      redisConnected = false;
      redisClient = null;
      return false;
    }
  })();

  return initPromise;
}

/**
 * Obtiene el cliente de Redis
 * Retorna null si no está disponible
 */
export function getRedisClient() {
  if (!redisConnected || !redisClient) {
    return null;
  }
  return redisClient;
}

/**
 * Verifica si Redis está conectado
 */
export function isRedisConnected() {
  return redisConnected && redisClient !== null;
}

/**
 * Cierra la conexión a Redis
 */
export async function closeRedisClient() {
  if (redisClient) {
    try {
      await redisClient.quit();
      redisConnected = false;
      redisClient = null;
    } catch (error) {
      console.warn('Error closing Redis client:', error.message);
    }
  }
}
