import { createRequirement, updateRequirement, deleteRequirement } from '../tools/requirements.tool.js';
import { createSymbol, updateSymbol, deleteSymbol } from '../tools/symbols.tool.js';
import { createScenario, updateScenario, deleteScenario } from '../tools/scenarios.tool.js';
import { generateProjectRelations } from '../graph-generation.service.js';
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
  }
};
