import Project from '../../models/Project.js';
import SymbolModel from '../../models/Symbol.js';
import Relation from '../../models/Relation.js';
import Requirement from '../../models/Requirement.js';
import { getProjectSummary } from './relations.tool.js';
import { createProjectRequirementsService } from '../../services/projectRequirements.service.js';
import { createProjectScenariosService } from '../../services/projectScenarios.service.js';
import { createProjectTasksService } from '../../services/projectTasks.service.js';
import { createProjectInspectionsService } from '../../services/projectInspections.service.js';

const requirementsService = createProjectRequirementsService({
  ProjectModel: Project,
  RequirementModel: Requirement
});
const scenariosService = createProjectScenariosService({
  ProjectModel: Project,
  ScenarioModel: (await import('../../models/Scenario.js')).default
});
const tasksService = createProjectTasksService({
  ProjectModel: Project,
  TaskModel: (await import('../../models/Task.js')).default
});
const inspectionsService = createProjectInspectionsService({
  ProjectModel: Project,
  InspectionModel: (await import('../../models/Inspection.js')).default
});

export async function getProjectSnapshot({ projectId }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para obtener el snapshot del proyecto.');
  }

  const project = await Project.findById(projectId).lean();
  if (!project) {
    throw new Error('Proyecto no encontrado.');
  }

  const summary = await getProjectSummary({ projectId });
  // Get ALL symbols for complete project analysis (not limited to 12)
  const symbols = await SymbolModel.find({ project: projectId }).sort({ createdAt: 1 }).lean();

  // Get ALL requirements for complete project analysis (not limited to 10)
  const allRequirements = await requirementsService.getProjectRequirements(projectId);
  const scenarios = await scenariosService.getProjectScenarios(projectId);
  const inspections = await inspectionsService.getProjectInspections(projectId);
  const tasks = await tasksService.getProjectTasks(projectId);

  // Get ALL relations for complete project analysis
  const relations = await Relation.find({ projectId }).lean();

  return {
    projectId: project._id.toString(),
    name: project.name,
    about: project.about || { intro: '', items: [] },
    counts: {
      symbols: summary.symbols.count,
      requirements: summary.requirements.count,
      scenarios: summary.scenarios.count,
      inspections: summary.inspections.count,
      tasks: summary.tasks.count,
      relations: summary.relations.count
    },
    // Include ALL symbols for comprehensive agent analysis
    symbols: symbols.map((symbol) => ({
      id: symbol._id.toString(),
      name: symbol.name,
      type: symbol.type,
      notion: symbol.notion || '',
      impact: symbol.impact || '',
      embedding: symbol.embedding || null
    })),
    // Include ALL requirements for comprehensive agent analysis
    requirements: allRequirements.map((requirement) => ({
      id: requirement._id?.toString(),
      name: requirement.name,
      description: requirement.description || '',
      basis: requirement.basis || '',
      text: requirement.text || requirement.description || '',
      embedding: requirement.embedding || null
    })),
    // Include scenarios if available
    scenarios: scenarios.map((scenario) => ({
      id: scenario.id,
      name: scenario.title || scenario.name || '',
      description: scenario.objective || scenario.description || '',
      stepsCount: Array.isArray(scenario.episodes) ? scenario.episodes.length : 0
    })),
    // Include ALL relations for architecture analysis
    relations: relations.map((rel) => ({
      id: rel._id?.toString(),
      from: {
        id: rel.fromId?.toString(),
        type: rel.fromType,
        label: rel.fromLabel || ''
      },
      to: {
        id: rel.toId?.toString(),
        type: rel.toType,
        label: rel.toLabel || ''
      },
      description: rel.description || '',
      score: rel.score || 0
    })),
    // Summary metrics for architectural awareness
    architectureMetrics: {
      avgSymbolsPerRequirement: allRequirements.length > 0 
        ? Math.round((relations.length / allRequirements.length) * 10) / 10
        : 0,
      avgRelationsPerSymbol: symbols.length > 0
        ? Math.round((relations.length / symbols.length) * 10) / 10
        : 0,
      uniqueRelationTypes: [...new Set(relations.map(r => `${r.fromType}→${r.toType}`))].length,
      highScoreRelations: relations.filter(r => r.score > 0.7).length
    },
    recentTasks: tasks.slice(-5).map((task) => ({
      id: task.id,
      description: task.description,
      targetType: task.targetType,
      targetLabel: task.targetLabel || ''
    }))
  };
}
