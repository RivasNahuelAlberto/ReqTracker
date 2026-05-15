/**
 * SEMANTIC MATCHER - Mejora 1 (F3.1)
 * Proporciona funciones de matching semántico para detectar
 * requisitos similares basado en embeddings
 * 
 * Caso de uso: autoPromoteFromAnalysis → encuentra requisito matching
 * con similitud > 0.85 para evitar crear duplicados
 */

import StructuredLogger from '../logger/structured.logger.js';
import { generateEmbedding } from '../embeddings.js';

const logger = new StructuredLogger('semantic-matcher');

/**
 * Calcula similitud coseno entre dos vectores de embedding
 * Rango: -1 (opuesto) a 1 (idéntico), típicamente 0-1
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) {
    return 0;
  }

  if (vecA.length !== vecB.length) {
    logger.warn('Vector dimension mismatch in cosine similarity', {
      dimA: vecA.length,
      dimB: vecB.length
    });
    return 0;
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Encuentra requisitos que coinciden semánticamente con un texto de entrada
 * Basado en embeddings + umbral de similitud configurable
 * 
 * @param {string} inputText - Texto a buscar (ej: análisis de requisito)
 * @param {Array} requirements - Array de requisitos con campos name, description, embedding
 * @param {number} threshold - Umbral de similitud coseno (default: 0.85)
 * @returns {Promise<Array>} Array de {requirement, similarity} ordenado descendente
 */
export async function findMatchingRequirements(inputText, requirements, threshold = 0.85) {
  try {
    if (!inputText || !Array.isArray(requirements) || requirements.length === 0) {
      return [];
    }

    // Generar embedding del texto de entrada
    const inputEmbedding = await generateEmbedding(inputText);
    if (!inputEmbedding || inputEmbedding.length === 0) {
      logger.warn('Failed to generate embedding for input text', {
        textLength: inputText.length
      });
      return [];
    }

    const matches = [];

    // Comparar con embeddings de cada requisito
    for (const req of requirements) {
      // Validar que el requisito tenga embedding
      if (!req.embedding || !Array.isArray(req.embedding) || req.embedding.length === 0) {
        continue;
      }

      // Calcular similitud coseno
      const similarity = cosineSimilarity(inputEmbedding, req.embedding);

      // Guardar si supera umbral
      if (similarity >= threshold) {
        matches.push({
          requirement: req,
          similarity: Math.round(similarity * 1000) / 1000, // 3 decimales
          name: req.name || req.identifier || 'unknown',
          matchType: 'semantic'
        });
      }
    }

    // Ordenar por similitud descendente
    matches.sort((a, b) => b.similarity - a.similarity);

    logger.debug('Semantic matching completed', {
      inputLength: inputText.length,
      requirementsChecked: requirements.length,
      matchesFound: matches.length,
      threshold
    });

    return matches;
  } catch (error) {
    logger.error('Error in findMatchingRequirements', {
      error: error.message,
      inputLength: inputText?.length || 0,
      requirementsCount: requirements?.length || 0
    });
    return [];
  }
}

/**
 * Encuentra el mejor requisito matching para un texto de entrada
 * Útil cuando necesitas solo el top-1 match
 * 
 * @param {string} inputText - Texto a buscar
 * @param {Array} requirements - Array de requisitos
 * @param {number} threshold - Umbral de similitud (default: 0.85)
 * @returns {Promise<Object|null>} Mejor match o null si no hay
 */
export async function findBestMatchingRequirement(inputText, requirements, threshold = 0.85) {
  try {
    const matches = await findMatchingRequirements(inputText, requirements, threshold);
    return matches.length > 0 ? matches[0] : null;
  } catch (error) {
    logger.error('Error in findBestMatchingRequirement', {
      error: error.message
    });
    return null;
  }
}

/**
 * Encuentra requisitos similares a uno dado (por su embedding)
 * Útil para detectar duplicados dentro de un proyecto
 * 
 * @param {Object} referenceReq - Requisito de referencia (debe tener embedding)
 * @param {Array} candidates - Array de requisitos candidatos
 * @param {number} threshold - Umbral de similitud (default: 0.75)
 * @returns {Promise<Array>} Array de matches similares
 */
export async function findSimilarRequirements(referenceReq, candidates, threshold = 0.75) {
  try {
    if (!referenceReq || !referenceReq.embedding || !Array.isArray(candidates)) {
      return [];
    }

    const matches = [];

    for (const candidate of candidates) {
      // Saltar el requisito de referencia
      if (candidate._id && referenceReq._id && candidate._id.toString() === referenceReq._id.toString()) {
        continue;
      }

      // Validar embedding del candidato
      if (!candidate.embedding || !Array.isArray(candidate.embedding)) {
        continue;
      }

      // Calcular similitud
      const similarity = cosineSimilarity(referenceReq.embedding, candidate.embedding);

      if (similarity >= threshold) {
        matches.push({
          requirement: candidate,
          similarity: Math.round(similarity * 1000) / 1000,
          name: candidate.name || candidate.identifier || 'unknown',
          matchType: 'duplicate_detection'
        });
      }
    }

    // Ordenar por similitud
    matches.sort((a, b) => b.similarity - a.similarity);

    logger.debug('Similar requirements detection completed', {
      referenceReqId: referenceReq._id || 'unknown',
      candidatesChecked: candidates.length,
      similarFound: matches.length,
      threshold
    });

    return matches;
  } catch (error) {
    logger.error('Error in findSimilarRequirements', {
      error: error.message,
      referenceReqId: referenceReq?._id || 'unknown'
    });
    return [];
  }
}

/**
 * Calcula score promedio de similitud entre un texto y múltiples requisitos
 * Útil para evaluar si un texto es coherente con la base de requisitos
 * 
 * @param {string} inputText - Texto a evaluar
 * @param {Array} requirements - Array de requisitos
 * @returns {Promise<Object>} {avgSimilarity, maxSimilarity, matchCount, score}
 */
export async function evaluateTextCoherence(inputText, requirements) {
  try {
    if (!inputText || !Array.isArray(requirements) || requirements.length === 0) {
      return {
        avgSimilarity: 0,
        maxSimilarity: 0,
        matchCount: 0,
        score: 0,
        status: 'insufficient_data'
      };
    }

    const inputEmbedding = await generateEmbedding(inputText);
    if (!inputEmbedding || inputEmbedding.length === 0) {
      return {
        avgSimilarity: 0,
        maxSimilarity: 0,
        matchCount: 0,
        score: 0,
        status: 'embedding_failed'
      };
    }

    let totalSimilarity = 0;
    let maxSimilarity = 0;
    let validComparisons = 0;

    for (const req of requirements) {
      if (!req.embedding || !Array.isArray(req.embedding)) {
        continue;
      }

      const similarity = cosineSimilarity(inputEmbedding, req.embedding);
      totalSimilarity += similarity;
      maxSimilarity = Math.max(maxSimilarity, similarity);
      validComparisons++;
    }

    const avgSimilarity = validComparisons > 0 ? totalSimilarity / validComparisons : 0;

    // Score: 0-1, donde 1 es perfectamente coherente
    const score = Math.round(avgSimilarity * 100) / 100;

    logger.debug('Text coherence evaluation completed', {
      inputLength: inputText.length,
      requirementsChecked: requirements.length,
      validComparisons,
      avgSimilarity: Math.round(avgSimilarity * 1000) / 1000,
      maxSimilarity: Math.round(maxSimilarity * 1000) / 1000
    });

    return {
      avgSimilarity: Math.round(avgSimilarity * 1000) / 1000,
      maxSimilarity: Math.round(maxSimilarity * 1000) / 1000,
      matchCount: validComparisons,
      score,
      status: 'success'
    };
  } catch (error) {
    logger.error('Error in evaluateTextCoherence', {
      error: error.message,
      inputLength: inputText?.length || 0
    });
    return {
      avgSimilarity: 0,
      maxSimilarity: 0,
      matchCount: 0,
      score: 0,
      status: 'error',
      error: error.message
    };
  }
}

export default {
  findMatchingRequirements,
  findBestMatchingRequirement,
  findSimilarRequirements,
  evaluateTextCoherence,
  cosineSimilarity
};
