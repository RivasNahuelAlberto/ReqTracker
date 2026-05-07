import Project from '../../models/Project.js';
import SymbolModel from '../../models/Symbol.js';

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

  const requirementMatches = (project.requirements || [])
    .filter((item) => {
      const content = [item.name, item.description, item.basis, item.type].map(normalizeText).join(' ');
      return content.includes(normalizedQuery);
    })
    .slice(0, 5)
    .map((item) => ({
      id: item._id.toString(),
      name: item.name,
      type: item.type,
      description: item.description
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
      impact: item.impact
    }));

  return {
    query: query.toString().trim(),
    requirementMatches,
    symbolMatches
  };
}
