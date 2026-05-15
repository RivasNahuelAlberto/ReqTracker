/**
 * Redis cache layer for agent analytics
 * Caches embeddings, contexts, clusters, and analysis results
 */

import redis from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let redisClient = null;
let redisConnected = false;

const CACHE_TTL = {
  embeddings: 3600 * 24,        // 24 hours
  agentContext: 3600,            // 1 hour
  similarity: 3600,              // 1 hour
  clustering: 3600 * 2,          // 2 hours
  quality: 3600 * 12,            // 12 hours
  consistency: 3600,             // 1 hour
  impact: 1800,                  // 30 minutes
  recommendations: 3600,         // 1 hour
  knowledge: 3600 * 24           // 24 hours
};

export async function initRedis() {
  try {
    redisClient = redis.createClient({ url: REDIS_URL });
    
    redisClient.on('error', (err) => {
      console.error('❌ Redis error:', err.message);
      redisConnected = false;
    });
    
    redisClient.on('connect', () => {
      console.log('✅ Redis connected');
      redisConnected = true;
    });
    
    await redisClient.connect();
    return true;
  } catch (error) {
    console.warn('⚠️  Redis connection failed:', error.message);
    console.log('📝 Continuing without Redis caching (performance degraded)');
    redisConnected = false;
    return false;
  }
}

export function isRedisConnected() {
  return redisConnected;
}

export async function healthCheck() {
  if (!redisClient) return { status: 'disconnected', message: 'Redis client not initialized' };
  
  try {
    const pong = await redisClient.ping();
    return { status: 'connected', message: 'Redis is healthy', ping: pong };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}

/**
 * Generate cache key with namespace
 */
function getCacheKey(type, projectId, identifier = '') {
  const key = `agent:${type}:${projectId}`;
  return identifier ? `${key}:${identifier}` : key;
}

/**
 * Cache embeddings
 */
export async function cacheEmbeddings(projectId, text, embeddings, model = 'openai') {
  if (!redisConnected || !redisClient) return false;
  
  try {
    const key = getCacheKey('embeddings', projectId, text.substring(0, 32));
    const value = JSON.stringify({ embeddings, model, timestamp: Date.now() });
    await redisClient.setEx(key, CACHE_TTL.embeddings, value);
    return true;
  } catch (error) {
    console.warn('⚠️  Error caching embeddings:', error.message);
    return false;
  }
}

/**
 * Get cached embeddings
 */
export async function getCachedEmbeddings(projectId, text, model = 'openai') {
  if (!redisConnected || !redisClient) return null;
  
  try {
    const key = getCacheKey('embeddings', projectId, text.substring(0, 32));
    const cached = await redisClient.get(key);
    
    if (!cached) return null;
    
    const data = JSON.parse(cached);
    if (data.model === model) {
      return data.embeddings;
    }
    return null;
  } catch (error) {
    console.warn('⚠️  Error retrieving cached embeddings:', error.message);
    return null;
  }
}

/**
 * Cache agent context
 */
export async function cacheAgentContext(projectId, context) {
  if (!redisConnected || !redisClient) return false;
  
  try {
    const key = getCacheKey('agentContext', projectId);
    const value = JSON.stringify(context);
    await redisClient.setEx(key, CACHE_TTL.agentContext, value);
    console.log(`📦 Cached agent context for project ${projectId}`);
    return true;
  } catch (error) {
    console.warn('⚠️  Error caching agent context:', error.message);
    return false;
  }
}

/**
 * Get cached agent context
 */
export async function getCachedAgentContext(projectId) {
  if (!redisConnected || !redisClient) return null;
  
  try {
    const key = getCacheKey('agentContext', projectId);
    const cached = await redisClient.get(key);
    
    if (cached) {
      console.log(`✨ Cache hit: agent context for project ${projectId}`);
      return JSON.parse(cached);
    }
    return null;
  } catch (error) {
    console.warn('⚠️  Error retrieving cached agent context:', error.message);
    return null;
  }
}

/**
 * Cache similarity search results
 */
export async function cacheSimilarityResults(projectId, query, results) {
  if (!redisConnected || !redisClient) return false;
  
  try {
    const key = getCacheKey('similarity', projectId, query.substring(0, 32));
    const value = JSON.stringify(results);
    await redisClient.setEx(key, CACHE_TTL.similarity, value);
    return true;
  } catch (error) {
    console.warn('⚠️  Error caching similarity results:', error.message);
    return false;
  }
}

/**
 * Get cached similarity results
 */
export async function getCachedSimilarityResults(projectId, query) {
  if (!redisConnected || !redisClient) return null;
  
  try {
    const key = getCacheKey('similarity', projectId, query.substring(0, 32));
    const cached = await redisClient.get(key);
    
    if (cached) {
      console.log(`✨ Cache hit: similarity search for "${query.substring(0, 30)}..."`);
      return JSON.parse(cached);
    }
    return null;
  } catch (error) {
    console.warn('⚠️  Error retrieving cached similarity results:', error.message);
    return null;
  }
}

/**
 * Cache clustering results
 */
export async function cacheClusteringResults(projectId, threshold, results) {
  if (!redisConnected || !redisClient) return false;
  
  try {
    const key = getCacheKey('clustering', projectId, `threshold_${threshold}`);
    const value = JSON.stringify(results);
    await redisClient.setEx(key, CACHE_TTL.clustering, value);
    console.log(`📦 Cached clustering results for project ${projectId}`);
    return true;
  } catch (error) {
    console.warn('⚠️  Error caching clustering results:', error.message);
    return false;
  }
}

/**
 * Get cached clustering results
 */
export async function getCachedClusteringResults(projectId, threshold) {
  if (!redisConnected || !redisClient) return null;
  
  try {
    const key = getCacheKey('clustering', projectId, `threshold_${threshold}`);
    const cached = await redisClient.get(key);
    
    if (cached) {
      console.log(`✨ Cache hit: clustering for project ${projectId}`);
      return JSON.parse(cached);
    }
    return null;
  } catch (error) {
    console.warn('⚠️  Error retrieving cached clustering results:', error.message);
    return null;
  }
}

/**
 * Invalidate all project caches
 */
export async function invalidateProjectCache(projectId) {
  if (!redisConnected || !redisClient) return false;
  
  try {
    const pattern = `agent:*:${projectId}*`;
    const keys = await redisClient.keys(pattern);
    
    if (keys.length > 0) {
      await redisClient.del(keys);
      console.log(`🗑️  Invalidated ${keys.length} cache entries for project ${projectId}`);
    }
    return true;
  } catch (error) {
    console.warn('⚠️  Error invalidating project cache:', error.message);
    return false;
  }
}

/**
 * Invalidate specific cache type for project
 */
export async function invalidateCacheType(projectId, type) {
  if (!redisConnected || !redisClient) return false;
  
  try {
    const pattern = `agent:${type}:${projectId}*`;
    const keys = await redisClient.keys(pattern);
    
    if (keys.length > 0) {
      await redisClient.del(keys);
      console.log(`🗝️  Invalidated ${keys.length} ${type} cache entries for project ${projectId}`);
    }
    return true;
  } catch (error) {
    console.warn('⚠️  Error invalidating cache:', error.message);
    return false;
  }
}

/**
 * Get cache metrics
 */
export async function getCacheMetrics() {
  if (!redisConnected || !redisClient) {
    return { connected: false, metrics: null };
  }
  
  try {
    const info = await redisClient.info('stats');
    const dbSize = await redisClient.dbSize();
    
    return {
      connected: true,
      metrics: {
        dbSize,
        info: info.split('\r\n').filter(line => line.includes('hits') || line.includes('misses'))
      }
    };
  } catch (error) {
    console.warn('⚠️  Error getting cache metrics:', error.message);
    return { connected: true, metrics: null };
  }
}

/**
 * Close Redis connection
 */
export async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisConnected = false;
    console.log('Redis connection closed');
  }
}

/**
 * Generic cache for analysis results
 * Used by tools: analyzeRequirement, findDuplicates, checkConsistency, checkImpact, etc.
 */
export async function getCachedAnalysisResult(type, projectId, key) {
  if (!redisConnected || !redisClient) return null;
  
  try {
    const cacheKey = `agent:${type}:${projectId}:${key}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      console.log(`✨ Cache hit: ${type} for project ${projectId}`);
      return JSON.parse(cached);
    }
    return null;
  } catch (error) {
    console.warn(`⚠️  Error getting cached analysis result (${type}):`, error.message);
    return null;
  }
}

/**
 * Cache analysis result for future use
 */
export async function cacheAnalysisResult(type, projectId, key, result, ttl = 3600) {
  if (!redisConnected || !redisClient) return false;
  
  try {
    const cacheKey = `agent:${type}:${projectId}:${key}`;
    await redisClient.setEx(cacheKey, ttl, JSON.stringify(result));
    console.log(`💾 Cached ${type} result for project ${projectId} (TTL: ${ttl}s)`);
    return true;
  } catch (error) {
    console.warn(`⚠️  Error caching analysis result (${type}):`, error.message);
    return false;
  }
}

/**
 * Invalidate embedding cache by hash key
 * Used when embedding text is modified or deleted
 */
export async function invalidateEmbeddingCache(type, hashKey) {
  if (!redisConnected || !redisClient) return false;
  
  try {
    const pattern = `agent:${type}:*:${hashKey}`;
    const keys = await redisClient.keys(pattern);
    
    if (keys.length > 0) {
      await redisClient.del(keys);
      console.log(`🗑️  Invalidated embedding cache for: ${hashKey.substring(0, 8)}...`);
      return true;
    }
    return false;
  } catch (error) {
    console.warn('⚠️  Error invalidating embedding cache:', error.message);
    return false;
  }
}

export default {
  initRedis,
  isRedisConnected,
  healthCheck,
  cacheEmbeddings,
  getCachedEmbeddings,
  cacheAgentContext,
  getCachedAgentContext,
  cacheSimilarityResults,
  getCachedSimilarityResults,
  cacheClusteringResults,
  getCachedClusteringResults,
  getCachedAnalysisResult,
  cacheAnalysisResult,
  invalidateProjectCache,
  invalidateCacheType,
  getCacheMetrics,
  closeRedis
};
