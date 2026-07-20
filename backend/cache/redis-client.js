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
      // Opciones para evitar reconexiones automáticas infinitas
      redisClient = redis.createClient({ 
        url: REDIS_URL,
        socket: {
          reconnectStrategy: false, // No reconectar automáticamente
          connectTimeout: 3000,     // 3 segundo timeout para conexión
          retryStrategy: () => null, // No reintentar
          noDelay: true,
        }
      });

      redisClient.on('error', (err) => {
        // Solo loguear si no es un error de conexión inicial
        if (redisConnected) {
          console.warn('⚠️ Redis connection lost:', err.message);
          redisConnected = false;
        }
        // Silencio si aún no estaba conectado (no disponible en deployment)
      });

      redisClient.on('connect', () => {
        console.log('✅ Redis connected');
        redisConnected = true;
      });

      // Timeout para conexión con max 3 segundos
      const connectPromise = redisClient.connect();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Redis connection timeout')), 3000)
      );

      await Promise.race([connectPromise, timeoutPromise]);
      redisConnected = true;
      return true;
    } catch (error) {
      // Silencioso si Redis no está disponible (normal en desarrollo/staging sin Redis)
      if (!process.env.REDIS_URL || process.env.REDIS_URL === 'redis://localhost:6379') {
        // Es la URL por defecto, probablemente Redis no está disponible - OK
      } else {
        console.log('📝 Redis unavailable (optional):', error.message);
      }
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
