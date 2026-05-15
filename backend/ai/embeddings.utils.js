/**
 * Utilidades para análisis avanzados con embeddings
 * El agente autónomo usa estas funciones para retroalimentarse
 * y obtener análisis semánticos reales de los requisitos
 * 
 * ETAPA 1: Integrado con Analytics Client (circuit breaker, retry, cache)
 * Antes: fetch directo a Python Analytics
 * Ahora: a través de analytics.client.js con robustness layer
 */

import { getCachedAgentContext, cacheAgentContext, getCachedClusteringResults, cacheClusteringResults } from './cache/redis.cache.js';
import { getAnalyticsClient } from './analytics.client.js';
import StructuredLogger from './logger/structured.logger.js';

const logger = new StructuredLogger('embeddings-utils');

/**
 * Análisis completo de un requisito usando embeddings
 * Usado por el agente para entender calidad, riesgos y duplicados
 * 
 * ETAPA 1: Ahora usa analytics.client con retry + circuit breaker + cache
 */
export async function analyzeRequirementWithEmbeddings(requirementText, context = {}) {
  try {
    const client = getAnalyticsClient();
    
    // Fallback elegante si analytics no está disponible
    const result = await client.callAnalyticsWithFallback(
      '/agent/analyze',
      {
        text: requirementText,
        context: context.similarRequirements || []
      },
      null  // Si analytics cae, retorna null y generateAgentContext continúa
    );
    
    return result;
  } catch (error) {
    logger.warn('Error analyzing requirement with embeddings', {
      error: error.message,
      text: requirementText?.substring(0, 50)
    });
    return null;
  }
}

/**
 * Encuentra requisitos similares usando búsqueda semántica
 * Util para el agente para detectar duplicados y conocer lo que ya existe
 * 
 * ETAPA 1: Ahora usa analytics.client con retry + circuit breaker + cache
 */
export async function findSimilarRequirements(query, existingRequirements = [], options = {}) {
  try {
    const limit = options.limit || 5;
    const threshold = options.threshold || 0.6;
    
    const client = getAnalyticsClient();
    
    const result = await client.callAnalyticsWithFallback(
      '/embeddings/similar-requirements',
      {
        query,
        requirements: existingRequirements,
        limit,
        threshold
      },
      { matches: [] }  // Default: empty list si analytics cae
    );
    
    return result;
  } catch (error) {
    logger.warn('Error finding similar requirements', {
      error: error.message,
      query: query?.substring(0, 50)
    });
    return { matches: [] };
  }
}

/**
 * Agrupa requisitos similares usando clustering
 * Util para el agente para entender estructuras y patrones
 * 
 * ETAPA 1: Ahora usa analytics.client con retry + circuit breaker + cache
 */
export async function clusterRequirements(requirements = [], options = {}) {
  try {
    const distanceThreshold = options.distanceThreshold || 0.3;
    
    // Create a cache key based on requirements count and threshold
    const reqSummary = requirements.length > 0 ? 
      `${requirements.length}_${distanceThreshold}` : 
      'empty';
    const cacheKey = `clustering_${reqSummary}`;
    
    // Try cache first
    const cached = await getCachedClusteringResults(cacheKey, {});
    if (cached) {
      logger.debug(`✨ Clustering cache hit for ${requirements.length} requirements`);
      return cached;
    }

    const client = getAnalyticsClient();
    
    const result = await client.callAnalyticsWithFallback(
      '/embeddings/cluster-requirements',
      {
        requirements,
        distance_threshold: distanceThreshold
      },
      {
        total_requirements: requirements.length,
        clusters_found: 1,
        message: 'Clustering unavailable'
      }
    );

    // Cache the result
    if (result && !result.message) {
      await cacheClusteringResults(cacheKey, result, {}, 7200); // 2 hour TTL
    }
    
    return result;
  } catch (error) {
    logger.warn('Error clustering requirements', {
      error: error.message,
      count: requirements.length
    });
    return {
      total_requirements: requirements.length,
      clusters_found: 1,
      message: 'Clustering unavailable due to error'
    };
  }
}

/**
 * Genera contexto inteligente para el agente basado en análisis
 * Combina múltiples análisis para dar al agente información rica
 * 
 * ETAPA 1: Ahora resiliente a analytics downtime
 * Si analytics cae, el agente continúa con análisis de cobertura básico
 */
export async function generateAgentContext(projectData) {
  try {
    const analysis = {
      timestamp: new Date().toISOString(),
      qualityInsights: [],
      riskInsights: [],
      duplicateWarnings: [],
      recommendedActions: [],
      coverageInfo: {}
    };

    if (!projectData.requirements || projectData.requirements.length === 0) {
      return analysis;
    }

    // Análisis adaptativo: primeros 10 + últimos 10 requisitos (hasta 20)
    const totalRequirements = projectData.requirements.length;
    let samplesToAnalyze = [];
    
    if (totalRequirements <= 10) {
      // Si hay 10 o menos, analizar todos
      samplesToAnalyze = projectData.requirements;
    } else if (totalRequirements <= 20) {
      // Si hay 11-20, analizar todos
      samplesToAnalyze = projectData.requirements;
    } else {
      // Si hay más de 20, tomar primeros 10 + últimos 10
      const first10 = projectData.requirements.slice(0, 10);
      const last10 = projectData.requirements.slice(-10);
      samplesToAnalyze = first10.concat(last10);
    }
    
    // Información de cobertura
    analysis.coverageInfo = {
      analyzed: samplesToAnalyze.length,
      total: totalRequirements,
      percentage: Math.round((samplesToAnalyze.length / totalRequirements) * 100),
      strategy: totalRequirements > 20 ? 'stratified_sampling' : 'full_analysis'
    };

    // Análisis de cada requisito (con tolerancia a fallos)
    for (const req of samplesToAnalyze) {
      try {
        const analyzed = await analyzeRequirementWithEmbeddings(
          req.text || req.name,
          { similarRequirements: projectData.requirements.slice(0, 10) }
        );

        if (analyzed) {
          // Agregar insights de calidad
          if (analyzed.quality && analyzed.quality.verdict === 'low_quality') {
            analysis.qualityInsights.push({
              requirement: req.name || req.text?.substring(0, 50),
              quality: analyzed.quality.score,
              problems: analyzed.quality.problems
            });
          }

          // Agregar riesgos
          if (analyzed.risk && analyzed.risk.level === 'critical') {
            analysis.riskInsights.push({
              requirement: req.name || req.text?.substring(0, 50),
              risk: analyzed.risk.score,
              factors: analyzed.risk.factors
            });
          }

          // Advertencias de duplicados
          if (analyzed.duplicates && analyzed.duplicates.has_duplicates) {
            analysis.duplicateWarnings.push({
              requirement: req.name || req.text?.substring(0, 50),
              duplicates: analyzed.duplicates.matches
            });
          }

          // Acciones recomendadas
          if (analyzed.recommendations && analyzed.recommendations.length > 0) {
            analysis.recommendedActions.push({
              requirement: req.name || req.text?.substring(0, 50),
              actions: analyzed.recommendations.slice(0, 3)
            });
          }
        }
      } catch (error) {
        logger.debug('Individual requirement analysis failed, continuing', {
          requirement: req.name,
          error: error.message
        });
        // Continuar con siguiente requisito
      }
    }

    // Clustering general para entender estructura (tolerante a fallos)
    try {
      const clusterAnalysis = await clusterRequirements(
        projectData.requirements.map(r => ({ text: r.text || r.name })),
        { distanceThreshold: 0.35 }
      );

      if (clusterAnalysis && !clusterAnalysis.message) {
        analysis.clusterSummary = {
          totalRequirements: clusterAnalysis.total_requirements,
          clustersFound: clusterAnalysis.clusters_found,
          avgClusterSize: Math.round(
            clusterAnalysis.total_requirements / clusterAnalysis.clusters_found
          )
        };
      }
    } catch (error) {
      logger.debug('Clustering analysis failed, continuing without clustering', {
        error: error.message
      });
    }

    return analysis;
  } catch (error) {
    logger.error('Error generating agent context', { error: error.message });
    return {
      timestamp: new Date().toISOString(),
      qualityInsights: [],
      riskInsights: [],
      duplicateWarnings: [],
      recommendedActions: [],
      coverageInfo: { message: 'Context generation failed, continuing with minimal analysis' }
    };
  }
}

/**
 * Formatea análisis de embeddings para que el agente pueda usarlo en prompts
 */
export function formatAnalysisForPrompt(analysis) {
  if (!analysis) return '';

  let prompt = '';

  if (analysis.quality) {
    prompt += `\n**Quality Assessment:** ${analysis.quality.verdict} (${(analysis.quality.score * 100).toFixed(0)}%)\n`;
    if (analysis.quality.problems.length > 0) {
      prompt += `Issues: ${analysis.quality.problems.join(', ')}\n`;
    }
  }

  if (analysis.duplicates && analysis.duplicates.has_duplicates) {
    prompt += `\n**Duplicate Warning:** Found ${analysis.duplicates.matches.length} potential duplicates\n`;
  }

  if (analysis.risk) {
    prompt += `\n**Risk Level:** ${analysis.risk.level} (${(analysis.risk.score * 100).toFixed(0)}%)\n`;
    if (analysis.risk.factors.length > 0) {
      prompt += `Risk factors: ${analysis.risk.factors.join(', ')}\n`;
    }
  }

  if (analysis.recommendations && analysis.recommendations.length > 0) {
    prompt += `\n**Recommendations:** ${analysis.recommendations.slice(0, 3).join(', ')}\n`;
  }

  return prompt;
}

export default {
  analyzeRequirementWithEmbeddings,
  findSimilarRequirements,
  clusterRequirements,
  generateAgentContext,
  formatAnalysisForPrompt
};
