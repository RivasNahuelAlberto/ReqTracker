/**
 * PATTERN CLUSTERING - Mejora 5 (F3.1)
 * Detecta patrones recurrentes en requisitos usando clustering semántico
 * Mejora sobre heurística simple que solo cuenta palabras
 * 
 * Caso de uso: Detectar patrones coherentes semánticamente
 * Ej: "Validación de usuario", "Validación de datos", "Validación de entrada"
 * → Cluster: VALIDACIÓN (concepto común)
 */

import StructuredLogger from '../logger/structured.logger.js';
import { generateEmbedding } from '../embeddings.js';

const logger = new StructuredLogger('pattern-clustering');

/**
 * Calcula similitud coseno entre dos vectores de embedding
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) {
    return 0;
  }

  if (vecA.length !== vecB.length) {
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
 * Agrupa requisitos por similitud semántica usando clustering
 * Usa algoritmo simple de clustering jerárquico (agglomerative)
 * 
 * @param {Array} requirements - Array de requisitos con embedding
 * @param {number} threshold - Umbral de similitud para agrupar (default: 0.75)
 * @returns {Promise<Array>} Array de clusters, cada uno con items y centroide
 */
export async function clusterRequirementsBySemantics(requirements, threshold = 0.75) {
  try {
    if (!Array.isArray(requirements) || requirements.length === 0) {
      return [];
    }

    if (requirements.length === 1) {
      return [{
        id: 0,
        items: requirements,
        size: 1,
        centroid: requirements[0].embedding || [],
        theme: requirements[0].name || 'singleton_cluster',
        coherence: 1.0
      }];
    }

    // Filtrar requisitos sin embedding
    const itemsWithEmbedding = requirements.filter(r => 
      r.embedding && Array.isArray(r.embedding) && r.embedding.length > 0
    );

    if (itemsWithEmbedding.length === 0) {
      logger.warn('No requirements with embeddings found for clustering');
      return [];
    }

    // Inicializar clusters - cada item es su propio cluster
    const clusters = itemsWithEmbedding.map((item, idx) => ({
      id: idx,
      items: [item],
      centroid: item.embedding,
      theme: extractTheme(item),
      lastMerged: null
    }));

    // Algoritmo de clustering jerárquico
    let clusterCount = clusters.length;

    while (clusterCount > 1) {
      // Encontrar los dos clusters más similares
      let maxSimilarity = -1;
      let mergeI = -1;
      let mergeJ = -1;

      for (let i = 0; i < clusters.length; i++) {
        if (clusters[i].merged) continue;
        
        for (let j = i + 1; j < clusters.length; j++) {
          if (clusters[j].merged) continue;
          
          const similarity = cosineSimilarity(clusters[i].centroid, clusters[j].centroid);
          
          if (similarity > maxSimilarity) {
            maxSimilarity = similarity;
            mergeI = i;
            mergeJ = j;
          }
        }
      }

      // Si no encontramos pareja similar, terminar
      if (maxSimilarity < threshold || mergeI === -1) {
        break;
      }

      // Fusionar clusters
      const clusterA = clusters[mergeI];
      const clusterB = clusters[mergeJ];

      // Calcular nuevo centroide (promedio de embeddings)
      const newCentroid = calculateCentroid([
        ...clusterA.items.map(i => i.embedding),
        ...clusterB.items.map(i => i.embedding)
      ]);

      // Crear nuevo cluster
      clusterA.items.push(...clusterB.items);
      clusterA.centroid = newCentroid;
      clusterA.theme = `${clusterA.theme} + ${clusterB.theme}`;
      clusterA.lastMerged = new Date();

      // Marcar cluster B como fusionado
      clusterB.merged = true;
      clusterCount--;
    }

    // Retornar clusters activos con metadata
    return clusters
      .filter(c => !c.merged)
      .map((c, idx) => ({
        id: idx,
        items: c.items,
        size: c.items.length,
        centroid: c.centroid,
        theme: c.theme,
        coherence: calculateClusterCoherence(c.items, c.centroid),
        tags: extractCommonTags(c.items)
      }));
  } catch (error) {
    logger.error('Error in clusterRequirementsBySemantics', {
      error: error.message,
      requirementsCount: requirements?.length || 0
    });
    return [];
  }
}

/**
 * Detecta patrones temáticos dentro de clusters
 * Identifica palabras/conceptos comunes
 * 
 * @param {Array} clusters - Array de clusters ya generados
 * @returns {Array} Patrones detectados con ocurrencias y relevancia
 */
export async function detectPatternsInClusters(clusters) {
  try {
    if (!Array.isArray(clusters) || clusters.length === 0) {
      return [];
    }

    const patterns = [];

    for (const cluster of clusters) {
      if (!cluster.items || cluster.items.length < 2) {
        continue; // Un patrón requiere al menos 2 items
      }

      // Analizar temas y conceptos comunes
      const pattern = {
        theme: cluster.theme,
        description: generateClusterDescription(cluster),
        size: cluster.size,
        coherence: cluster.coherence,
        confidence: cluster.coherence * 100, // Convertir a porcentaje
        items: cluster.items.length,
        tags: cluster.tags || [],
        clusterId: cluster.id,
        recurrence: `occurs_${cluster.size}_times`,
        pattern_type: classifyPattern(cluster)
      };

      // Solo incluir si coherencia es decente (>0.6)
      if (pattern.coherence >= 0.6) {
        patterns.push(pattern);
      }
    }

    // Ordenar por tamaño y coherencia
    patterns.sort((a, b) => {
      const sizeWeight = b.size - a.size;
      if (sizeWeight !== 0) return sizeWeight;
      return b.coherence - a.coherence;
    });

    logger.info('Patterns detected in clusters', {
      clustersAnalyzed: clusters.length,
      patternsFound: patterns.length,
      topPatterns: patterns.slice(0, 3).map(p => p.theme)
    });

    return patterns;
  } catch (error) {
    logger.error('Error in detectPatternsInClusters', {
      error: error.message,
      clustersCount: clusters?.length || 0
    });
    return [];
  }
}

/**
 * Calcula centroide de un conjunto de embeddings
 * El centroide es el promedio de todos los vectores
 */
function calculateCentroid(embeddings) {
  if (embeddings.length === 0) return [];

  const dimension = embeddings[0].length;
  const centroid = new Array(dimension).fill(0);

  for (const embedding of embeddings) {
    if (!embedding || embedding.length !== dimension) continue;
    
    for (let i = 0; i < dimension; i++) {
      centroid[i] += embedding[i];
    }
  }

  // Normalizar dividiendo por cantidad de embeddings
  for (let i = 0; i < dimension; i++) {
    centroid[i] /= embeddings.length;
  }

  return centroid;
}

/**
 * Calcula coherencia de un cluster
 * Es el promedio de similitudes entre items y el centroide
 */
function calculateClusterCoherence(items, centroid) {
  if (!items || items.length === 0) return 0;

  let totalSimilarity = 0;
  let validItems = 0;

  for (const item of items) {
    if (item.embedding && Array.isArray(item.embedding)) {
      const sim = cosineSimilarity(item.embedding, centroid);
      totalSimilarity += sim;
      validItems++;
    }
  }

  return validItems > 0 ? Math.round((totalSimilarity / validItems) * 100) / 100 : 0;
}

/**
 * Extrae tema principal de un requisito
 * Simple heurística - toma las primeras palabras
 */
function extractTheme(item) {
  const text = item.name || item.description || item.text || '';
  const words = text.split(/\s+/).slice(0, 2).join(' ');
  return words.substring(0, 50) || 'unknown';
}

/**
 * Extrae tags comunes de items en un cluster
 */
function extractCommonTags(items) {
  const tagCounts = {};

  for (const item of items) {
    const tags = item.tags || [];
    for (const tag of tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  // Retornar tags que aparecen en al menos 50% de los items
  const threshold = items.length / 2;
  return Object.entries(tagCounts)
    .filter(([_, count]) => count >= threshold)
    .map(([tag, _]) => tag);
}

/**
 * Genera descripción textual del cluster
 */
function generateClusterDescription(cluster) {
  const size = cluster.size;
  const theme = cluster.theme;
  const coherence = Math.round(cluster.coherence * 100);
  
  return `${size} requirement(s) related to "${theme}" with ${coherence}% coherence`;
}

/**
 * Clasifica tipo de patrón detectado
 */
function classifyPattern(cluster) {
  const size = cluster.size;
  const coherence = cluster.coherence;

  if (coherence >= 0.85) return 'strong_semantic_pattern';
  if (coherence >= 0.75) return 'moderate_semantic_pattern';
  if (coherence >= 0.65) return 'weak_semantic_pattern';
  return 'loose_grouping';
}

/**
 * Analiza requisitos y retorna top patrones detectados
 * Función completa: clustering + pattern detection
 * 
 * @param {Array} requirements - Array de requisitos
 * @param {number} clusterThreshold - Umbral para clustering (default: 0.75)
 * @returns {Promise<Object>} {clusters, patterns, stats}
 */
export async function analyzeRequirementPatterns(requirements, clusterThreshold = 0.75) {
  try {
    if (!Array.isArray(requirements) || requirements.length < 2) {
      return {
        clusters: [],
        patterns: [],
        stats: {
          total_items: requirements?.length || 0,
          clusters_found: 0,
          patterns_found: 0,
          avg_cluster_size: 0,
          message: 'Insufficient items for pattern analysis'
        }
      };
    }

    // Paso 1: Clustering semántico
    const clusters = await clusterRequirementsBySemantics(requirements, clusterThreshold);

    // Paso 2: Detectar patrones
    const patterns = await detectPatternsInClusters(clusters);

    // Paso 3: Calcular estadísticas
    const stats = {
      total_items: requirements.length,
      clusters_found: clusters.length,
      patterns_found: patterns.length,
      avg_cluster_size: clusters.length > 0 
        ? Math.round(requirements.length / clusters.length * 10) / 10 
        : 0,
      avg_coherence: clusters.length > 0
        ? Math.round(clusters.reduce((sum, c) => sum + c.coherence, 0) / clusters.length * 100) / 100
        : 0,
      top_patterns: patterns.slice(0, 3).map(p => p.theme)
    };

    logger.info('Pattern analysis completed', {
      totalItems: stats.total_items,
      clustersFound: stats.clusters_found,
      patternsFound: stats.patterns_found,
      avgCoherence: stats.avg_coherence
    });

    return { clusters, patterns, stats };
  } catch (error) {
    logger.error('Error in analyzeRequirementPatterns', {
      error: error.message,
      requirementsCount: requirements?.length || 0
    });
    return {
      clusters: [],
      patterns: [],
      stats: {
        error: error.message,
        total_items: requirements?.length || 0
      }
    };
  }
}

export default {
  clusterRequirementsBySemantics,
  detectPatternsInClusters,
  analyzeRequirementPatterns
};
