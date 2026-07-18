import Project from '../../models/Project.js';
import SymbolModel from '../../models/Symbol.js';
import DocumentModel from '../../models/Document.js';
import Requirement from '../../models/Requirement.js';
import { createProjectRequirementsService } from '../../services/projectRequirements.service.js';
import { generateEmbedding, cosineSimilarity } from '../embeddings.js';

const requirementsService = createProjectRequirementsService({
  ProjectModel: Project,
  RequirementModel: Requirement
});

function normalizeText(value) {
  return value?.toString().toLowerCase() || '';
}

export async function semanticSearch({ projectId, query }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para buscar semanticamente.');
  }
  if (!query || !query.toString().trim()) {
    throw new Error('La consulta de búsqueda es obligatoria.');
  }

  const normalizedQuery = query.toString().trim().toLowerCase();
  const project = await Project.findById(projectId).lean();
  if (!project) {
    throw new Error('Proyecto no encontrado.');
  }
  const requirements = await requirementsService.getProjectRequirements(projectId);

  // Generar embedding para la query
  let queryEmbedding = [];
  try {
    queryEmbedding = await generateEmbedding(query.toString().trim());
  } catch (error) {
    console.warn('No se pudo generar embedding para la query, usando búsqueda básica:', error.message);
    // Fallback a búsqueda básica
    const requirementMatches = requirements
      .filter((item) => {
        const content = [item.name, item.description, item.basis, item.type].map(normalizeText).join(' ');
        return content.includes(normalizedQuery);
      })
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        description: item.description,
        similarity: 0 // No hay similitud sin embedding
      }));

    const symbols = await SymbolModel.find({ project: projectId }).lean();
    const symbolMatches = symbols
      .filter((item) => {
        const content = [item.name, item.type, item.notion, item.impact].map(normalizeText).join(' ');
        return content.includes(normalizedQuery);
      })
      .slice(0, 5)
      .map((item) => ({
        id: item._id.toString(),
        name: item.name,
        type: item.type,
        notion: item.notion,
        impact: item.impact,
        similarity: 0
      }));

    const documentMatches = (await DocumentModel.find({ project: projectId }).lean())
      .filter((item) => {
        const content = [item.name, item.description, item.content].map(normalizeText).join(' ');
        return content.includes(normalizedQuery);
      })
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        description: item.description,
        content: item.content,
        similarity: 0
      }));

    return {
      query: query.toString().trim(),
      requirementMatches,
      symbolMatches,
      documentMatches
    };
  }

  // Búsqueda semántica con embeddings para requisitos
  const requirementMatches = requirements
    .filter((item) => item.embedding && item.embedding.length > 0)
    .map((item) => ({
      ...item,
      similarity: cosineSimilarity(queryEmbedding, item.embedding)
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      description: item.description,
      similarity: item.similarity
    }));

  // Búsqueda semántica para símbolos
  const symbols = await SymbolModel.find({ project: projectId }).lean();
  const symbolMatches = symbols
    .filter((item) => item.embedding && item.embedding.length > 0)
    .map((item) => ({
      ...item,
      similarity: cosineSimilarity(queryEmbedding, item.embedding)
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5)
    .map((item) => ({
      id: item._id.toString(),
      name: item.name,
      type: item.type,
      notion: item.notion,
      impact: item.impact,
      similarity: item.similarity
    }));

  // Búsqueda semántica con embeddings para documentos
  const documentMatches = (await DocumentModel.find({ project: projectId }).lean())
    .filter((item) => item.embedding && item.embedding.length > 0)
    .map((item) => ({
      ...item,
      similarity: cosineSimilarity(queryEmbedding, item.embedding)
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      description: item.description,
      content: item.content,
      similarity: item.similarity
    }));

  return {
    query: query.toString().trim(),
    requirementMatches,
    symbolMatches,
    documentMatches
  };
}
