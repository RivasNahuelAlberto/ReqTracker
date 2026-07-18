export function buildProjectExportPayload({
  project,
  symbols = [],
  requirements = [],
  scenarios = [],
  tasks = [],
  inspections = [],
  resolveNotes = [],
  relations = [],
  documents = []
}) {
  const normalizedSymbols = Array.isArray(symbols) ? symbols : [];
  const normalizedRequirements = Array.isArray(requirements) ? requirements : [];
  const normalizedScenarios = Array.isArray(scenarios) ? scenarios : [];
  const normalizedTasks = Array.isArray(tasks) ? tasks : [];
  const normalizedInspections = Array.isArray(inspections) ? inspections : [];
  const normalizedResolveNotes = Array.isArray(resolveNotes) ? resolveNotes : [];
  const normalizedRelations = Array.isArray(relations) ? relations : [];
  const normalizedDocuments = Array.isArray(documents) ? documents : [];

  const symbolNameMap = {};
  normalizedSymbols.forEach((symbol) => {
    if (symbol?._id) {
      symbolNameMap[symbol._id.toString()] = symbol.name || '';
    }
  });

  const exportSymbols = normalizedSymbols.map((symbol) => ({
    ...symbol,
    parentSymbol: symbol?.parentSymbol
      ? symbolNameMap[symbol.parentSymbol.toString()] || null
      : null
  }));

  const exportTasks = normalizedTasks.map((task) => ({
    ...task,
    targetId: task?.targetLabel || task?.targetId || ''
  }));

  const exportInspections = normalizedInspections.map((inspection) => ({
    ...inspection,
    targetId: inspection?.targetLabel || inspection?.targetId || ''
  }));

  return {
    ...project,
    about: {
      intro: project?.about?.intro || '',
      items: Array.isArray(project?.about?.items) ? project.about.items : []
    },
    assistantConfig: project?.assistantConfig || {},
    symbols: exportSymbols,
    requirements: normalizedRequirements,
    scenarios: normalizedScenarios,
    tasks: exportTasks,
    inspections: exportInspections,
    resolveNotes: normalizedResolveNotes,
    relations: normalizedRelations,
    documents: normalizedDocuments
  };
}
