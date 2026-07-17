function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function findBestEntityNameFromContext(context = {}) {
  const candidates = [];

  if (context.resolvedEntity?.name) candidates.push(context.resolvedEntity.name);
  if (context.entityContext?.name) candidates.push(context.entityContext.name);

  const fromPrevious = context.previousStepResults || [];
  for (const result of fromPrevious) {
    const values = [
      result?.sourceSymbol,
      result?.symbol?.name,
      result?.entity?.name,
      result?.analysis?.sourceSymbol,
      result?.result?.sourceSymbol,
      result?.result?.symbol?.name,
      result?.result?.entity?.name
    ];

    for (const value of values) {
      const normalized = normalizeText(value);
      if (normalized) candidates.push(normalized);
    }
  }

  return candidates[0] || '';
}

function searchSnapshotEntities(snapshot = {}, rawName) {
  const normalizedName = normalizeText(rawName).toLowerCase();
  if (!normalizedName) return null;

  const symbolMatches = (snapshot.symbols || []).filter((symbol) => {
    const name = normalizeText(symbol?.name || symbol?.title || symbol?.entityName);
    return name.toLowerCase().includes(normalizedName);
  }).map((symbol) => ({
    type: 'symbol',
    id: symbol?.id || symbol?._id?.toString?.() || null,
    name: normalizeText(symbol?.name || symbol?.title || symbol?.entityName)
  }));

  if (symbolMatches.length > 0) {
    return symbolMatches[0];
  }

  const requirementMatches = (snapshot.requirements || []).filter((requirement) => {
    const haystack = `${requirement?.name || ''} ${requirement?.description || ''}`.toLowerCase();
    return haystack.includes(normalizedName);
  }).map((requirement) => ({
    type: 'requirement',
    id: requirement?.id || requirement?._id?.toString?.() || null,
    name: normalizeText(requirement?.name)
  }));

  if (requirementMatches.length > 0) {
    return requirementMatches[0];
  }

  const scenarioMatches = (snapshot.scenarios || []).filter((scenario) => {
    const haystack = `${scenario?.title || ''} ${scenario?.objective || ''}`.toLowerCase();
    return haystack.includes(normalizedName);
  }).map((scenario) => ({
    type: 'scenario',
    id: scenario?.id || scenario?._id?.toString?.() || null,
    name: normalizeText(scenario?.title)
  }));

  return scenarioMatches[0] || null;
}

async function resolveEntityName(projectId, rawName, context = {}) {
  const normalizedName = normalizeText(rawName);
  if (!normalizedName) {
    return context.resolvedEntity || context.entityContext || null;
  }

  const explicitEntity = context.resolvedEntity || context.entityContext;
  if (explicitEntity && explicitEntity.name && explicitEntity.name.toLowerCase().includes(normalizedName.toLowerCase())) {
    return explicitEntity;
  }

  const snapshotMatch = searchSnapshotEntities(context.projectSnapshot || {}, normalizedName);
  if (snapshotMatch) return snapshotMatch;

  const fallbackName = findBestEntityNameFromContext(context);
  if (fallbackName && fallbackName.toLowerCase().includes(normalizedName.toLowerCase())) {
    return { type: 'unknown', id: null, name: fallbackName };
  }

  try {
    const [{ default: Project }, { default: SymbolModel }] = await Promise.all([
      import('../../models/Project.js'),
      import('../../models/Symbol.js')
    ]);

    if (!projectId) return null;

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
      return haystack.includes(normalizedName.toLowerCase());
    }).map((req) => ({ type: 'requirement', id: req._id?.toString(), name: req.name }));

    const scenarioMatches = (project.scenarios || []).filter((scenario) => {
      const haystack = `${scenario.title || ''} ${scenario.objective || ''}`.toLowerCase();
      return haystack.includes(normalizedName.toLowerCase());
    }).map((scenario) => ({ type: 'scenario', id: scenario._id?.toString(), name: scenario.title }));

    candidates.push(...requirementMatches, ...scenarioMatches);

    const exactMatch = candidates.find((candidate) => candidate.name?.toLowerCase() === normalizedName.toLowerCase());
    if (exactMatch) return exactMatch;

    return candidates.find((candidate) => candidate.name?.toLowerCase().includes(normalizedName.toLowerCase())) || null;
  } catch (error) {
    return null;
  }
}

export async function normalizeToolArgs(toolName, args = {}, context = {}) {
  const projectId = args.projectId || context.projectId;
  const normalized = { ...(args || {}) };

  if (projectId) normalized.projectId = projectId;

  switch (toolName) {
    case 'findTransitiveDependencies': {
      const rawNode = normalizeText(args.node || args.symbolName || args.entityName || args.name || args.requirement || args.element);
      const resolved = rawNode ? await resolveEntityName(projectId, rawNode, context) : (context.resolvedEntity || context.entityContext || null);

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
      const resolved = rawName ? await resolveEntityName(projectId, rawName, context) : (context.resolvedEntity || context.entityContext || null);

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

      if (resolvedSymbols.length > 0) {
        normalized.affectedSymbols = resolvedSymbols;
      } else if (context.resolvedEntity) {
        normalized.affectedSymbols = [{
          id: context.resolvedEntity.id || context.resolvedEntity.name,
          name: context.resolvedEntity.name,
          type: context.resolvedEntity.type || 'unknown',
          description: ''
        }];
      }
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
