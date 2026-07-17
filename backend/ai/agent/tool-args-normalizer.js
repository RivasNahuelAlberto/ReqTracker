import SymbolModel from '../../models/Symbol.js';
import Project from '../../models/Project.js';

const ENTITY_LOOKUP_PRIORITY = ['symbol', 'requirement', 'scenario'];

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function resolveEntityName(projectId, rawName, context = {}) {
  if (!projectId || !rawName) return null;

  const project = await Project.findById(projectId).lean();
  if (!project) return null;

  const candidates = [];

  for (const symbol of project.symbols || []) {
    const resolved = await SymbolModel.findById(symbol).lean();
    if (!resolved) continue;
    candidates.push({ type: 'symbol', id: resolved._id?.toString(), name: resolved.name });
  }

  const requirementMatches = (project.requirements || []).filter((req) => {
    const haystack = `${req.name || ''} ${req.description || ''}`.toLowerCase();
    return haystack.includes(rawName.toLowerCase());
  }).map((req) => ({ type: 'requirement', id: req._id?.toString(), name: req.name }));

  const scenarioMatches = (project.scenarios || []).filter((scenario) => {
    const haystack = `${scenario.title || ''} ${scenario.objective || ''}`.toLowerCase();
    return haystack.includes(rawName.toLowerCase());
  }).map((scenario) => ({ type: 'scenario', id: scenario._id?.toString(), name: scenario.title }));

  candidates.push(...requirementMatches, ...scenarioMatches);

  const exactMatch = candidates.find((candidate) => candidate.name?.toLowerCase() === rawName.toLowerCase());
  if (exactMatch) return exactMatch;

  return candidates.find((candidate) => candidate.name?.toLowerCase().includes(rawName.toLowerCase())) || null;
}

export async function normalizeToolArgs(toolName, args = {}, context = {}) {
  const projectId = args.projectId || context.projectId;
  const normalized = { ...(args || {}) };

  if (projectId) normalized.projectId = projectId;

  switch (toolName) {
    case 'findTransitiveDependencies': {
      const rawNode = normalizeText(args.node || args.symbolName || args.entityName || args.name);
      const resolved = rawNode ? await resolveEntityName(projectId, rawNode, context) : null;

      if (rawNode && !normalized.symbolName) {
        normalized.symbolName = resolved?.name || rawNode;
      }

      if (!normalized.maxDepth && (args.depth || args.maxDepth)) {
        normalized.maxDepth = Number(args.depth || args.maxDepth || 3);
      }

      if (normalized.node) delete normalized.node;
      if (normalized.depth) delete normalized.depth;
      break;
    }

    case 'analyzeSytemicImpact': {
      const rawName = normalizeText(args.symbolName || args.entityName || args.name || args.requirement || args.element);
      const resolved = rawName ? await resolveEntityName(projectId, rawName, context) : null;

      if (rawName && !normalized.symbolName) {
        normalized.symbolName = resolved?.name || rawName;
      }

      if (!normalized.changeDescription && args.changeDescription) {
        normalized.changeDescription = args.changeDescription;
      }
      break;
    }

    case 'analyzeInconsistencyRisk': {
      const rawSymbols = args.affectedSymbols || args.symbols || args.requirement || args.requirements || [];
      const sourceList = Array.isArray(rawSymbols) ? rawSymbols : [rawSymbols];
      const resolvedSymbols = [];

      for (const item of sourceList) {
        const name = normalizeText(typeof item === 'string' ? item : item?.name || item?.symbolName || item?.requirement || item?.entityName);
        if (!name) continue;
        const resolved = await resolveEntityName(projectId, name, context);
        resolvedSymbols.push({
          id: resolved?.id || item?.id || name,
          name: resolved?.name || name,
          type: resolved?.type || item?.type || 'unknown',
          description: item?.description || item?.notion || ''
        });
      }

      normalized.affectedSymbols = resolvedSymbols;
      break;
    }

    case 'generateRecommendations': {
      if (!normalized.projectId && projectId) normalized.projectId = projectId;
      break;
    }

    case 'analyzeRequirement': {
      const rawRequirement = normalizeText(args.requirementText || args.requirement || args.text || args.requirementName || args.name);
      if (rawRequirement && !normalized.requirementText) {
        normalized.requirementText = rawRequirement;
      }

      const fromProject = context.projectSnapshot?.requirements?.find((item) => {
        const haystack = `${item.name || ''} ${item.description || ''}`.toLowerCase();
        return haystack.includes(rawRequirement.toLowerCase());
      });

      if (fromProject && !normalized.requirementText) {
        normalized.requirementText = fromProject.description || fromProject.name;
      }

      break;
    }

    default:
      break;
  }

  return normalized;
}
