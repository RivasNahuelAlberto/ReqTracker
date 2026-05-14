import { createRequirement, updateRequirement, deleteRequirement } from '../tools/requirements.tool.js';
import { createSymbol, updateSymbol, deleteSymbol } from '../tools/symbols.tool.js';
import { createScenario, updateScenario, deleteScenario } from '../tools/scenarios.tool.js';
import { generateProjectRelations } from '../graph-generation.service.js';
import { analyzeRequirementWithEmbeddings, findSimilarRequirements, clusterRequirements } from '../embeddings.utils.js';
import SymbolModel from '../../models/Symbol.js';
import Project from '../../models/Project.js';
import { generateEmbedding } from '../embeddings.js';
import { getCachedAgentContext, invalidateProjectCache, getCachedAnalysisResult, cacheAnalysisResult } from '../cache/redis.cache.js';
import StructuredLogger from '../logger/structured.logger.js';
import crypto from 'crypto';

const ANALYTICS_URL = process.env.ANALYTICS_URL || 'http://localhost:8000';
const logger = new StructuredLogger('agent-tools');

/**
 * Helper function to create cache keys from parameters
 */
function createCacheKey(type, projectId, params) {
  const paramStr = JSON.stringify(params);
  const hash = crypto.createHash('sha256').update(paramStr).digest('hex').substring(0, 12);
  return hash;
}

export const toolImplementations = {
  createRequirement,
  updateRequirement,
  deleteRequirement,
  createSymbol,
  updateSymbol,
  deleteSymbol,
  createScenario,
  updateScenario,
  deleteScenario,
  generateProjectGraph: async ({ projectId, threshold = 0.65 }) => {
    if (!projectId) {
      throw new Error('projectId es requerido para generar el grafo.');
    }
    return await generateProjectRelations({ projectId, threshold });
  },
  regenerateEmbeddings: async ({ projectId, force = false }) => {
    if (!projectId) {
      throw new Error('projectId es requerido para regenerar embeddings.');
    }

    const project = await Project.findById(projectId);
    if (!project) {
      throw new Error('Proyecto no encontrado.');
    }

    const symbols = await SymbolModel.find({ project: projectId }).lean();
    let regenerated = 0;

    for (const symbol of symbols) {
      const needsEmbedding = force || !Array.isArray(symbol.embedding) || symbol.embedding.length === 0;
      if (!needsEmbedding) continue;

      const textToEmbed = `${symbol.name} ${symbol.type} ${symbol.notion || ''} ${symbol.impact || ''}`.trim();
      try {
        const embedding = await generateEmbedding(textToEmbed);
        await SymbolModel.findByIdAndUpdate(symbol._id, { embedding });
        regenerated += 1;
      } catch (error) {
        console.warn(`No se pudo regenerar embedding para símbolo ${symbol._id}:`, error.message);
      }
    }

    // Regenerate requirements embeddings if needed
    let regeneratedRequirements = 0;
    for (const requirement of project.requirements || []) {
      const needsEmbedding = force || !Array.isArray(requirement.embedding) || requirement.embedding.length === 0;
      if (!needsEmbedding) continue;
      const text = `${requirement.name} ${requirement.description || ''} ${requirement.basis || ''}`.trim();
      try {
        requirement.embedding = await generateEmbedding(text);
        regeneratedRequirements += 1;
      } catch (error) {
        console.warn(`No se pudo regenerar embedding para requisito ${requirement._id}:`, error.message);
      }
    }

    await project.save();

    return {
      regeneratedSymbols: regenerated,
      regeneratedRequirements,
      totalSymbols: symbols.length,
      totalRequirements: (project.requirements || []).length
    };
  },
  /**
   * Analyzes a requirement using semantic embeddings from analytics
   * Returns quality score, risks, duplicates, and recommendations
   */
  analyzeRequirement: async ({ requirementText, projectId, context = {} }) => {
    const startTime = Date.now();
    if (!requirementText) {
      throw new Error('requirementText is required for analysis.');
    }

    let existingRequirements = [];
    if (projectId) {
      try {
        const project = await Project.findById(projectId);
        existingRequirements = (project?.requirements || []).map(r => ({
          id: r._id?.toString(),
          name: r.name,
          text: r.text || r.description
        }));
      } catch (error) {
        logger.warn('Could not fetch existing requirements', { 
          projectId, 
          error: error.message 
        });
      }
    }

    // Create cache key from requirement text hash
    const cacheKey = createCacheKey('analyze_req', projectId || 'global', { 
      text: requirementText.substring(0, 100) 
    });

    // Try cache first
    let analysis = await getCachedAnalysisResult('analyze_req', projectId || 'global', cacheKey);
    let cacheHit = !!analysis;
    
    if (!analysis) {
      analysis = await analyzeRequirementWithEmbeddings(requirementText, {
        similarRequirements: existingRequirements,
        ...context
      });
      
      // Cache the result (1 hour TTL)
      if (analysis) {
        await cacheAnalysisResult('analyze_req', projectId || 'global', cacheKey, analysis, 3600);
      }
    }

    const duration = Date.now() - startTime;
    if (!analysis) {
      logger.logToolExecution('analyzeRequirement', projectId, duration, false, cacheHit);
      return {
        error: 'Could not analyze requirement with analytics service',
        fallback: true
      };
    }

    logger.logToolExecution('analyzeRequirement', projectId, duration, true, cacheHit);
    return {
      success: true,
      analysis,
      timestamp: new Date().toISOString()
    };
  },
  /**
   * Finds similar requirements using semantic similarity
   * Useful for detecting duplicates and understanding existing content
   */
  findDuplicates: async ({ requirementText, projectId, threshold = 0.65, limit = 5 }) => {
    const startTime = Date.now();
    if (!requirementText) {
      throw new Error('requirementText is required.');
    }

    let existingRequirements = [];
    if (projectId) {
      try {
        const project = await Project.findById(projectId);
        existingRequirements = (project?.requirements || []).map(r => ({
          id: r._id?.toString(),
          name: r.name,
          text: r.text || r.description,
          similarity_score: null
        }));
      } catch (error) {
        logger.warn('Could not fetch project requirements', { 
          projectId, 
          error: error.message 
        });
      }
    }

    // Create cache key
    const cacheKey = createCacheKey('duplicate', projectId || 'global', { 
      text: requirementText.substring(0, 100),
      threshold,
      limit
    });

    // Try cache first
    let results = await getCachedAnalysisResult('duplicate', projectId || 'global', cacheKey);
    let cacheHit = !!results;
    
    if (!results) {
      results = await findSimilarRequirements(requirementText, existingRequirements, {
        threshold,
        limit
      });
      
      // Cache the result (1 hour TTL)
      if (results) {
        await cacheAnalysisResult('duplicate', projectId || 'global', cacheKey, results, 3600);
      }
    }

    const duration = Date.now() - startTime;
    if (!results) {
      logger.logToolExecution('findDuplicates', projectId, duration, false, cacheHit);
      return {
        error: 'Could not search for similar requirements',
        fallback: true,
        similar: []
      };
    }

    logger.logToolExecution('findDuplicates', projectId, duration, true, cacheHit);
    return {
      success: true,
      query: requirementText,
      threshold,
      duplicatesFound: results.length > 0,
      similar: results || [],
      timestamp: new Date().toISOString()
    };
  },
  /**
   * Checks consistency between requirements using analytics service
   * Detects conflicts and logical issues
   */
  checkConsistency: async ({ requirements, projectId }) => {
    const startTime = Date.now();
    if (!Array.isArray(requirements) || requirements.length === 0) {
      throw new Error('requirements array is required for consistency check.');
    }

    // Create cache key from requirements hash
    const reqIds = requirements.map(r => r._id?.toString() || r.id).sort().join(',');
    const cacheKey = createCacheKey('consistency', projectId || 'global', { 
      reqIds,
      count: requirements.length
    });

    // Try cache first
    let result = await getCachedAnalysisResult('consistency', projectId || 'global', cacheKey);
    let cacheHit = !!result;

    if (!result) {
      try {
        const response = await fetch(`${ANALYTICS_URL}/consistency`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requirements: requirements.map(r => ({
              id: r._id?.toString() || r.id,
              name: r.name,
              text: r.text || r.description
            })),
            projectId
          })
        });

        if (!response.ok) {
          const duration = Date.now() - startTime;
          logger.logToolExecution('checkConsistency', projectId, duration, false, false, 
            new Error(`Analytics service returned ${response.status}`));
          return {
            error: `Analytics service returned ${response.status}`,
            fallback: true,
            issues: []
          };
        }

        result = await response.json();
        
        // Cache the result (1 hour TTL)
        await cacheAnalysisResult('consistency', projectId || 'global', cacheKey, result, 3600);
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.logToolExecution('checkConsistency', projectId, duration, false, false, error);
        return {
          error: error.message,
          fallback: true,
          issues: []
        };
      }
    }

    const duration = Date.now() - startTime;
    logger.logToolExecution('checkConsistency', projectId, duration, true, cacheHit);
    return {
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    };
  },
  /**
   * Analyzes impact of changes on the project
   * Returns affected elements and propagation chains
   */
  checkImpact: async ({ element, elementType, projectId, changeDescription = '' }) => {
    const startTime = Date.now();
    if (!element || !elementType) {
      throw new Error('element and elementType are required.');
    }

    // Create cache key
    const cacheKey = createCacheKey('impact', projectId || 'global', { 
      elementId: element._id?.toString() || element.id,
      elementType,
      changeDescription: changeDescription.substring(0, 50)
    });

    // Try cache first
    let result = await getCachedAnalysisResult('impact', projectId || 'global', cacheKey);
    let cacheHit = !!result;

    if (!result) {
      try {
        const response = await fetch(`${ANALYTICS_URL}/impact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            element: {
              id: element._id?.toString() || element.id,
              name: element.name,
              type: elementType,
              description: element.description || element.text || ''
            },
            change_description: changeDescription,
            projectId
          })
        });

        if (!response.ok) {
          const duration = Date.now() - startTime;
          logger.logToolExecution('checkImpact', projectId, duration, false, false, 
            new Error(`Analytics service returned ${response.status}`));
          return { error: 'Could not analyze impact', fallback: true, affected: [] };
        }

        result = await response.json();
        
        // Cache the result (30 min TTL - impact analysis can change frequently)
        await cacheAnalysisResult('impact', projectId || 'global', cacheKey, result, 1800);
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.logToolExecution('checkImpact', projectId, duration, false, false, error);
        return { error: error.message, fallback: true, affected: [] };
      }
    }

    const duration = Date.now() - startTime;
    logger.logToolExecution('checkImpact', projectId, duration, true, cacheHit);
    return {
      success: true,
      element: element.name,
      ...result,
      timestamp: new Date().toISOString()
    };
  },
  /**
   * Analyzes quality of a specific symbol
   * Returns quality score and improvement suggestions
   */
  analyzeSymbolQuality: async ({ symbolId, projectId }) => {
    const startTime = Date.now();
    if (!symbolId || !projectId) {
      throw new Error('symbolId and projectId are required.');
    }

    try {
      const symbol = await SymbolModel.findById(symbolId).lean();
      if (!symbol) {
        const duration = Date.now() - startTime;
        logger.logToolExecution('analyzeSymbolQuality', projectId, duration, false, false, 
          new Error('Symbol not found'));
        return { error: 'Symbol not found', fallback: true };
      }

      // Create cache key
      const cacheKey = createCacheKey('symbol_quality', projectId, { 
        symbolId,
        symbolName: symbol.name
      });

      // Try cache first
      let result = await getCachedAnalysisResult('symbol_quality', projectId, cacheKey);
      let cacheHit = !!result;

      if (!result) {
        const project = await Project.findById(projectId).lean();
        const relatedSymbols = (project?.symbols || [])
          .filter(s => s._id?.toString() !== symbolId)
          .slice(0, 10);

        const response = await fetch(`${ANALYTICS_URL}/quality`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `${symbol.name} ${symbol.type} ${symbol.notion || ''} ${symbol.impact || ''}`.trim(),
            context: {
              type: 'symbol',
              projectId,
              relatedElements: relatedSymbols.map(s => ({
                name: s.name,
                type: s.type,
                notion: s.notion
              }))
            }
          })
        });

        if (!response.ok) {
          const duration = Date.now() - startTime;
          logger.logToolExecution('analyzeSymbolQuality', projectId, duration, false, false, 
            new Error(`Analytics service returned ${response.status}`));
          return { error: 'Could not analyze symbol quality', fallback: true };
        }

        result = await response.json();
        
        // Cache the result (12 hour TTL)
        await cacheAnalysisResult('symbol_quality', projectId, cacheKey, result, 43200);
      }

      const duration = Date.now() - startTime;
      logger.logToolExecution('analyzeSymbolQuality', projectId, duration, true, cacheHit);
      return {
        success: true,
        symbol: symbol.name,
        symbolId: symbolId,
        ...result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logToolExecution('analyzeSymbolQuality', projectId, duration, false, false, error);
      return { error: error.message, fallback: true };
    }
  },
  /**
   * Find similar requirements using semantic search
   * Returns matches with similarity scores
   */
  findSimilarRequirements: async ({ query, projectId, threshold = 0.65, limit = 5 }) => {
    const startTime = Date.now();
    if (!query) {
      throw new Error('query text is required.');
    }

    let existingRequirements = [];
    if (projectId) {
      try {
        const project = await Project.findById(projectId);
        existingRequirements = (project?.requirements || []).map(r => ({
          id: r._id?.toString(),
          name: r.name,
          text: r.text || r.description
        }));
      } catch (error) {
        logger.warn('Could not fetch project requirements', { 
          projectId, 
          error: error.message 
        });
      }
    }

    // Create cache key
    const cacheKey = createCacheKey('similar_req', projectId || 'global', { 
      query: query.substring(0, 100),
      threshold,
      limit
    });

    // Try cache first
    let results = await getCachedAnalysisResult('similar_req', projectId || 'global', cacheKey);
    let cacheHit = !!results;

    if (!results) {
      results = await findSimilarRequirements(query, existingRequirements, {
        threshold,
        limit
      });
      
      // Cache the result (1 hour TTL)
      if (results) {
        await cacheAnalysisResult('similar_req', projectId || 'global', cacheKey, results, 3600);
      }
    }

    const duration = Date.now() - startTime;
    if (!results) {
      logger.logToolExecution('findSimilarRequirements', projectId, duration, false, cacheHit);
      return {
        error: 'Could not search for similar requirements',
        fallback: true,
        similar: []
      };
    }

    logger.logToolExecution('findSimilarRequirements', projectId, duration, true, cacheHit);
    return {
      success: true,
      query,
      threshold,
      similar: results || [],
      count: results.length,
      timestamp: new Date().toISOString()
    };
  },
  /**
   * Cluster requirements to identify groups and patterns
   */
  clusterRequirementsAnalysis: async ({ projectId, distanceThreshold = 0.35 }) => {
    const startTime = Date.now();
    if (!projectId) {
      throw new Error('projectId is required.');
    }

    // Create cache key
    const cacheKey = createCacheKey('cluster', projectId, { 
      distanceThreshold
    });

    // Try cache first
    let result = await getCachedAnalysisResult('cluster', projectId, cacheKey);
    let cacheHit = !!result;

    if (!result) {
      try {
        const project = await Project.findById(projectId);
        if (!project) {
          const duration = Date.now() - startTime;
          logger.logToolExecution('clusterRequirementsAnalysis', projectId, duration, false, false, 
            new Error('Project not found'));
          return { error: 'Project not found', fallback: true };
        }

        const requirements = (project.requirements || []).map(r => ({
          id: r._id?.toString(),
          text: r.text || r.name || r.description
        }));

        if (requirements.length === 0) {
          const duration = Date.now() - startTime;
          logger.info('No requirements to cluster', { projectId, duration });
          return { 
            success: true, 
            clusters: [], 
            message: 'No requirements to cluster',
            timestamp: new Date().toISOString()
          };
        }

        result = await clusterRequirements(requirements, {
          distanceThreshold
        });

        if (result) {
          // Cache the result (2 hour TTL)
          await cacheAnalysisResult('cluster', projectId, cacheKey, result, 7200);
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.logToolExecution('clusterRequirementsAnalysis', projectId, duration, false, false, error);
        return { error: error.message, fallback: true, clusters: [] };
      }
    }

    const duration = Date.now() - startTime;
    if (!result) {
      logger.logToolExecution('clusterRequirementsAnalysis', projectId, duration, false, cacheHit);
      return {
        error: 'Could not cluster requirements',
        fallback: true,
        clusters: []
      };
    }

    logger.logToolExecution('clusterRequirementsAnalysis', projectId, duration, true, cacheHit);
    return {
      success: true,
      projectId,
      ...result,
      timestamp: new Date().toISOString()
    };
  },
  /**
   * Get recommendations for project improvements
   */
  generateRecommendations: async ({ projectId, focusArea = 'general' }) => {
    const startTime = Date.now();
    if (!projectId) {
      throw new Error('projectId is required.');
    }

    try {
      const project = await Project.findById(projectId).lean();
      if (!project) {
        const duration = Date.now() - startTime;
        logger.logToolExecution('generateRecommendations', projectId, duration, false, false, 
          new Error('Project not found'));
        return { error: 'Project not found', fallback: true };
      }

      // Create cache key
      const cacheKey = createCacheKey('recommendations', projectId, { 
        focusArea,
        reqCount: (project.requirements || []).length,
        symCount: (project.symbols || []).length
      });

      // Try cache first
      let result = await getCachedAnalysisResult('recommendations', projectId, cacheKey);
      let cacheHit = !!result;

      if (!result) {
        const response = await fetch(`${ANALYTICS_URL}/recommendation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            requirements: (project.requirements || []).map(r => ({
              id: r._id?.toString(),
              name: r.name,
              text: r.text || r.description,
              quality: r.quality_score
            })),
            symbols: (project.symbols || []).map(s => ({
              id: s._id?.toString(),
              name: s.name,
              type: s.type
            })),
            focusArea
          })
        });

        if (!response.ok) {
          const duration = Date.now() - startTime;
          logger.logToolExecution('generateRecommendations', projectId, duration, false, false, 
            new Error(`Analytics service returned ${response.status}`));
          return { error: 'Could not generate recommendations', fallback: true, recommendations: [] };
        }

        result = await response.json();
        
        // Cache the result (1 hour TTL)
        await cacheAnalysisResult('recommendations', projectId, cacheKey, result, 3600);
      }

      const duration = Date.now() - startTime;
      logger.logToolExecution('generateRecommendations', projectId, duration, true, cacheHit);
      return {
        success: true,
        focusArea,
        ...result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logToolExecution('generateRecommendations', projectId, duration, false, false, error);
      return { error: error.message, fallback: true, recommendations: [] };
    }
  },
  /**
   * Semantic search across all project elements
   */
  semanticSearch: async ({ query, projectId, searchType = 'all', limit = 10 }) => {
    const startTime = Date.now();
    if (!query) {
      throw new Error('query is required.');
    }

    // Create cache key
    const cacheKey = createCacheKey('semantic_search', projectId || 'global', { 
      query: query.substring(0, 100),
      searchType,
      limit
    });

    // Try cache first
    let result = await getCachedAnalysisResult('semantic_search', projectId || 'global', cacheKey);
    let cacheHit = !!result;

    if (!result) {
      try {
        const project = await Project.findById(projectId);
        if (!project) {
          const duration = Date.now() - startTime;
          logger.logToolExecution('semanticSearch', projectId, duration, false, false, 
            new Error('Project not found'));
          return { error: 'Project not found', fallback: true, results: [] };
        }

        let searchElements = [];

        if (searchType === 'all' || searchType === 'requirements') {
          searchElements.push(...(project.requirements || []).map(r => ({
            id: r._id?.toString(),
            type: 'requirement',
            name: r.name,
            text: r.text || r.description,
            metadata: { basis: r.basis }
          })));
        }

        if (searchType === 'all' || searchType === 'symbols') {
          const symbols = await SymbolModel.find({ project: projectId }).lean();
          searchElements.push(...symbols.map(s => ({
            id: s._id?.toString(),
            type: 'symbol',
            name: s.name,
            text: `${s.name} ${s.type} ${s.notion || ''}`,
            metadata: { type: s.type, notion: s.notion }
          })));
        }

        // Use similarity search from analytics
        const results = await findSimilarRequirements(
          query,
          searchElements.map(e => ({ 
            id: e.id, 
            name: e.name, 
            text: e.text 
          })),
          { limit, threshold: 0.5 }
        );

        if (results) {
          result = {
            success: true,
            query,
            searchType,
            results: results || [],
            count: results.length,
            timestamp: new Date().toISOString()
          };
          
          // Cache the result (1 hour TTL)
          await cacheAnalysisResult('semantic_search', projectId || 'global', cacheKey, result, 3600);
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.logToolExecution('semanticSearch', projectId, duration, false, false, error);
        return { error: error.message, fallback: true, results: [] };
      }
    }

    const duration = Date.now() - startTime;
    if (!result) {
      logger.logToolExecution('semanticSearch', projectId, duration, false, cacheHit);
      return { error: 'Search failed', fallback: true, results: [] };
    }

    logger.logToolExecution('semanticSearch', projectId, duration, true, cacheHit);
    return result;
  }
};
