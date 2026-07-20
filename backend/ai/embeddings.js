import OpenAI from 'openai';
import crypto from 'crypto';

const apiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
const baseURL = process.env.OPENAI_API_KEY
  ? 'https://api.openai.com/v1'
  : process.env.OPENROUTER_API_BASE_URL || 'https://openrouter.ai/api/v1';

// Lazy-load Redis cache (optional, graceful fallback)
let redisCache = null;
let cacheInitialized = false;

async function getRedisCache() {
  if (cacheInitialized) return redisCache;
  
  try {
    const module = await import('../cache/redis.cache.js');
    redisCache = {
      getCachedEmbeddings: module.getCachedEmbeddings,
      cacheEmbeddings: module.cacheEmbeddings,
      invalidateEmbeddingCache: module.invalidateEmbeddingCache
    };
  } catch (error) {
    console.warn('⚠️ Redis cache not available for embeddings:', error.message);
    redisCache = null;
  }
  
  cacheInitialized = true;
  return redisCache;
}

function createOpenAIClient() {
  if (!apiKey) {
    throw new Error('OpenAI o OpenRouter API key es requerida para generar embeddings.');
  }
  return new OpenAI({ apiKey, baseURL });
}

/**
 * Genera un hash MD5 para usar como cache key
 */
function getEmbeddingCacheKey(text) {
  const trimmed = text.toString().trim();
  return crypto.createHash('md5').update(trimmed).digest('hex');
}

export async function generateEmbedding(text) {
  try {
    if (!text || !text.toString().trim()) {
      return [];
    }

    const trimmedText = text.toString().trim();
    const cacheKey = getEmbeddingCacheKey(trimmedText);
    
    // Intentar obtener del cache
    const cache = await getRedisCache();
    if (cache && cache.getCachedEmbeddings) {
      const cached = await cache.getCachedEmbeddings('embeddings', cacheKey);
      if (cached && cached.length > 0) {
        console.log(`✨ Cache hit for embedding: ${cacheKey.substring(0, 8)}...`);
        return cached;
      }
    }
    
    // Si no está en cache, generar
    const openai = createOpenAIClient();
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: trimmedText,
    });
    
    const embedding = response.data[0].embedding;
    
    // Guardar en cache (fire-and-forget, no bloquea)
    if (cache && cache.cacheEmbeddings) {
      cache.cacheEmbeddings('embeddings', cacheKey, embedding).catch(err => {
        console.warn('⚠️ Failed to cache embedding:', err.message);
      });
    }
    
    return embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Invalida el cache de embeddings para un texto específico
 * Usado cuando se actualiza o elimina un requisito/símbolo
 */
export async function invalidateEmbeddingCache(text) {
  try {
    const cacheKey = getEmbeddingCacheKey(text);
    const cache = await getRedisCache();
    
    if (cache && cache.invalidateEmbeddingCache) {
      await cache.invalidateEmbeddingCache('embeddings', cacheKey);
      console.log(`🗑️ Invalidated embedding cache for: ${cacheKey.substring(0, 8)}...`);
    }
  } catch (error) {
    console.warn('⚠️ Failed to invalidate embedding cache:', error.message);
  }
}

/**
 * Genera embedding para un símbolo basado en su nombre, notion e impact
 */
export async function generateSymbolEmbedding(symbol) {
  try {
    const textParts = [
      symbol.name || '',
      symbol.notion || '',
      symbol.impact || ''
    ].filter(part => part.toString().trim());
    
    if (textParts.length === 0) {
      return [];
    }
    
    const combinedText = textParts.join(' ');
    return await generateEmbedding(combinedText);
  } catch (error) {
    console.error('Error generating symbol embedding:', error);
    throw error;
  }
}

/**
 * Genera embedding para un requisito basado en su nombre y descripción
 */
export async function generateRequirementEmbedding(requirement) {
  try {
    const textParts = [
      requirement.name || '',
      requirement.description || '',
      requirement.basis || ''
    ].filter(part => part.toString().trim());
    
    if (textParts.length === 0) {
      return [];
    }
    
    const combinedText = textParts.join(' ');
    return await generateEmbedding(combinedText);
  } catch (error) {
    console.error('Error generating requirement embedding:', error);
    throw error;
  }
}

export function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length === 0 || vecB.length === 0) {
    return 0;
  }
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const normB = Math.sqrt(vecB.reduce((sum, a) => sum + a * a, 0));
  return normA === 0 || normB === 0 ? 0 : dotProduct / (normA * normB);
}