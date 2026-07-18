export function normalizeScenario(scenario = {}) {
  const scenarioId = scenario?._id?.toString?.() || scenario?.id?.toString?.() || '';

  return {
    ...scenario,
    _id: scenarioId || scenario?._id || scenario?.id || '',
    id: scenarioId || scenario?.id || scenario?._id || '',
    title: scenario?.title || '',
    type: scenario?.type || 'Escenario',
    objective: scenario?.objective || '',
    locationTemporal: scenario?.locationTemporal || '',
    locationGeographic: scenario?.locationGeographic || '',
    preconditions: scenario?.preconditions || '',
    actors: scenario?.actors || '',
    resources: scenario?.resources || '',
    episodes: scenario?.episodes || '',
    exceptions: scenario?.exceptions || '',
    order: scenario?.order || '',
    createdAt: scenario?.createdAt || null
  };
}

export function normalizeScenarios(scenarios = []) {
  return Array.isArray(scenarios) ? scenarios.map((scenario) => normalizeScenario(scenario)) : [];
}

export function mergeScenarioSelection({ currentSelection = null, nextSelection = null } = {}) {
  const normalizedCurrent = currentSelection ? normalizeScenario(currentSelection) : null;
  const normalizedNext = nextSelection ? normalizeScenario(nextSelection) : null;

  if (!normalizedCurrent || !normalizedNext) {
    return normalizedNext || normalizedCurrent || null;
  }

  const currentId = normalizedCurrent._id || normalizedCurrent.id || '';
  const nextId = normalizedNext._id || normalizedNext.id || '';

  if (!currentId || !nextId || currentId !== nextId) {
    return normalizedNext;
  }

  const merged = { ...normalizedCurrent, ...normalizedNext };
  const preserveFields = ['episodes', 'objective', 'locationTemporal', 'locationGeographic', 'preconditions', 'actors', 'resources', 'exceptions', 'order', 'title', 'type'];

  preserveFields.forEach((field) => {
    const currentValue = normalizedCurrent[field];
    const nextValue = normalizedNext[field];
    const isCurrentDraft = typeof currentValue === 'string' && currentValue.trim().length > 0;
    const isNextBlank = typeof nextValue !== 'string' || nextValue.trim().length === 0;

    if (isCurrentDraft && isNextBlank) {
      merged[field] = currentValue;
    }
  });

  return normalizeScenario(merged);
}

export function resolveScenarioSelection({ scenarios = [], selectedScenario = null, selectedScenarioId = '' }) {
  const normalizedScenarios = normalizeScenarios(scenarios);
  const normalizedSelected = selectedScenario ? normalizeScenario(selectedScenario) : null;
  const targetId = selectedScenarioId || normalizedSelected?._id || '';

  const currentSelection = normalizedScenarios.find((scenario) => scenario._id === targetId);
  if (currentSelection) {
    return {
      selectedScenario: currentSelection,
      selectedScenarioId: currentSelection._id
    };
  }

  return {
    selectedScenario: normalizedScenarios[0] || null,
    selectedScenarioId: normalizedScenarios[0]?._id || ''
  };
}
