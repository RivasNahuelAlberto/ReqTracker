export async function buildProjectViewResponse({
  project,
  user,
  projectRole,
  symbols = [],
  requirements = [],
  scenarios = [],
  tasks = [],
  inspections = [],
  resolveNotes = []
}) {
  const effectiveSymbols = Array.isArray(symbols) ? symbols : [];
  const effectiveRequirements = Array.isArray(requirements) ? requirements : [];
  const effectiveScenarios = Array.isArray(scenarios) ? scenarios : [];
  const effectiveTasks = Array.isArray(tasks) ? tasks : [];
  const effectiveInspections = Array.isArray(inspections) ? inspections : [];
  const effectiveResolveNotes = Array.isArray(resolveNotes) ? resolveNotes : [];

  const isProjectAdmin = user?.role === 'super_admin' || projectRole?.role === 'admin';
  const responseProject = {
    _id: project._id,
    name: project.name,
    createdAt: project.createdAt,
    hasSecurity: Boolean(project.securityCode),
    isProjectAdmin,
    resolveNotes: effectiveResolveNotes,
    scenarios: effectiveScenarios,
    about: project.about || { intro: '', items: [] },
    documents: Array.isArray(project.documents) ? project.documents : [],
    tasks: effectiveTasks,
    inspections: effectiveInspections,
    requirements: effectiveRequirements,
    locks: Array.isArray(project.locks) ? project.locks : [],
    assistantConfig: project.assistantConfig || {},
    symbols: effectiveSymbols,
    embeddingStats: {
      missingSymbols: effectiveSymbols.filter((symbol) => !Array.isArray(symbol.embedding) || symbol.embedding.length === 0).length,
      missingRequirements: effectiveRequirements.filter((requirement) => !Array.isArray(requirement.embedding) || requirement.embedding.length === 0).length,
      totalSymbols: effectiveSymbols.length,
      totalRequirements: effectiveRequirements.length
    }
  };

  if (isProjectAdmin) {
    responseProject.projectHash = project.projectHash || '';
  }

  return responseProject;
}
