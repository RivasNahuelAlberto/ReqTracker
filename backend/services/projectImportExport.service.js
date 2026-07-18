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
  const normalizedTasks = Array.isArray(tasks) ? tasks : [];
  const normalizedInspections = Array.isArray(inspections) ? inspections : [];

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
    symbols: exportSymbols,
    requirements: Array.isArray(requirements) ? requirements : [],
    scenarios: Array.isArray(scenarios) ? scenarios : [],
    tasks: exportTasks,
    inspections: exportInspections,
    resolveNotes: Array.isArray(resolveNotes) ? resolveNotes : [],
    relations: Array.isArray(relations) ? relations : [],
    documents: Array.isArray(documents) ? documents : []
  };
}
