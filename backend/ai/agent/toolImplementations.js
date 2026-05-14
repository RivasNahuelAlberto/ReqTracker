import { createRequirement, updateRequirement, deleteRequirement } from '../tools/requirements.tool.js';
import { createSymbol, updateSymbol, deleteSymbol } from '../tools/symbols.tool.js';
import { createScenario, updateScenario, deleteScenario } from '../tools/scenarios.tool.js';
import { generateProjectRelations } from '../graph-generation.service.js';
import { analyzeRequirementWithEmbeddings, findSimilarRequirements } from '../embeddings.utils.js';
import SymbolModel from '../../models/Symbol.js';
import Project from '../../models/Project.js';
import { generateEmbedding } from '../embeddings.js';

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

    const ANALYTICS_URL = process.env.ANALYTICS_URL || 'http://localhost:8000';

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
  }
};
