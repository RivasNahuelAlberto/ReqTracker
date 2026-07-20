export function canTransitionScenarioEdit({ scenarioId = '', editMode = false }) {
  return Boolean(scenarioId) && !editMode;
}

export function mergeScenarioDraft({ baseScenario = {}, updates = {} }) {
  return {
    ...baseScenario,
    ...updates
  };
}
