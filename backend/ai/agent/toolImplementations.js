import { createRequirement, updateRequirement, deleteRequirement } from '../tools/requirements.tool.js';
import { createSymbol, updateSymbol, deleteSymbol } from '../tools/symbols.tool.js';
import { createScenario, updateScenario, deleteScenario } from '../tools/scenarios.tool.js';
import { generateProjectRelations } from '../graph-generation.service.js';
import { analyzeRequirementWithEmbeddings, findSimilarRequirements, clusterRequirements } from '../embeddings.utils.js';
import SymbolModel from '../../models/Symbol.js';
import Project from '../../models/Project.js';
import { generateEmbedding } from '../embeddings.js';
const ANALYTICS_URL = process.env.ANALYTICS_URL || 'http://localhost:8000';

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
        console.warn('Could not fetch existing requirements:', error.message);
      }
    }

    const analysis = await analyzeRequirementWithEmbeddings(requirementText, {
      similarRequirements: existingRequirements,
      ...context
    });

    if (!analysis) {
      return {
        error: 'Could not analyze requirement with analytics service',
        fallback: true
      };
    }

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
        console.warn('Could not fetch project requirements:', error.message);
      }
    }

    const results = await findSimilarRequirements(requirementText, existingRequirements, {
      threshold,
      limit
    });

    if (!results) {
      return {
        error: 'Could not search for similar requirements',
        fallback: true,
        similar: []
      };
    }

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
    if (!Array.isArray(requirements) || requirements.length === 0) {
      throw new Error('requirements array is required for consistency check.');
    }

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
        console.error(`Consistency check error: ${response.status}`);
        return {
          error: `Analytics service returned ${response.status}`,
          fallback: true,
          issues: []
        };
      }

      const result = await response.json();
      return {
        success: true,
        ...result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error checking consistency:', error.message);
      return {
        error: error.message,
        fallback: true,
        issues: []
      };
    }
  },
  /**
   * Analyzes impact of changes on the project
   * Returns affected elements and propagation chains
   */
  checkImpact: async ({ element, elementType, projectId, changeDescription = '' }) => {
    if (!element || !elementType) {
      throw new Error('element and elementType are required.');
    }

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
        console.error(`Impact analysis error: ${response.status}`);
        return { error: 'Could not analyze impact', fallback: true, affected: [] };
      }

      const result = await response.json();
      return {
        success: true,
        element: element.name,
        ...result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error checking impact:', error.message);
      return { error: error.message, fallback: true, affected: [] };
    }
  },
  /**
   * Analyzes quality of a specific symbol
   * Returns quality score and improvement suggestions
   */
  analyzeSymbolQuality: async ({ symbolId, projectId }) => {
    if (!symbolId || !projectId) {
      throw new Error('symbolId and projectId are required.');
    }

    try {
      const symbol = await SymbolModel.findById(symbolId).lean();
      if (!symbol) {
        return { error: 'Symbol not found', fallback: true };
      }

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
        console.error(`Symbol quality analysis error: ${response.status}`);
        return { error: 'Could not analyze symbol quality', fallback: true };
      }

      const result = await response.json();
      return {
        success: true,
        symbol: symbol.name,
        symbolId: symbolId,
        ...result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error analyzing symbol quality:', error.message);
      return { error: error.message, fallback: true };
    }
  },
  /**
   * Find similar requirements using semantic search
   * Returns matches with similarity scores
   */
  findSimilarRequirements: async ({ query, projectId, threshold = 0.65, limit = 5 }) => {
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
        console.warn('Could not fetch project requirements:', error.message);
      }
    }

    const results = await findSimilarRequirements(query, existingRequirements, {
      threshold,
      limit
    });

    if (!results) {
      return {
        error: 'Could not search for similar requirements',
        fallback: true,
        similar: []
      };
    }

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
    if (!projectId) {
      throw new Error('projectId is required.');
    }

    try {
      const project = await Project.findById(projectId);
      if (!project) {
        return { error: 'Project not found', fallback: true };
      }

      const requirements = (project.requirements || []).map(r => ({
        id: r._id?.toString(),
        text: r.text || r.name || r.description
      }));

      if (requirements.length === 0) {
        return { 
          success: true, 
          clusters: [], 
          message: 'No requirements to cluster',
          timestamp: new Date().toISOString()
        };
      }

      const result = await clusterRequirements(requirements, {
        distanceThreshold
      });

      if (!result) {
        return {
          error: 'Could not cluster requirements',
          fallback: true,
          clusters: []
        };
      }

      return {
        success: true,
        projectId,
        ...result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error clustering requirements:', error.message);
      return { error: error.message, fallback: true, clusters: [] };
    }
  },
  /**
   * Get recommendations for project improvements
   */
  generateRecommendations: async ({ projectId, focusArea = 'general' }) => {
    if (!projectId) {
      throw new Error('projectId is required.');
    }

    try {
      const project = await Project.findById(projectId).lean();
      if (!project) {
        return { error: 'Project not found', fallback: true };
      }

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
        console.error(`Recommendations error: ${response.status}`);
        return { error: 'Could not generate recommendations', fallback: true, recommendations: [] };
      }

      const result = await response.json();
      return {
        success: true,
        focusArea,
        ...result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error generating recommendations:', error.message);
      return { error: error.message, fallback: true, recommendations: [] };
    }
  },
  /**
   * Semantic search across all project elements
   */
  semanticSearch: async ({ query, projectId, searchType = 'all', limit = 10 }) => {
    if (!query) {
      throw new Error('query is required.');
    }

    try {
      const project = await Project.findById(projectId);
      if (!project) {
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

      if (!results) {
        return { error: 'Search failed', fallback: true, results: [] };
      }

      return {
        success: true,
        query,
        searchType,
        results: results || [],
        count: results.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error in semantic search:', error.message);
      return { error: error.message, fallback: true, results: [] };
    }
  }
};
