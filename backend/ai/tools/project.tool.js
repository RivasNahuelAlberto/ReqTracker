import Project from '../../models/Project.js';
import Requirement from '../../models/Requirement.js';
import SymbolModel from '../../models/Symbol.js';
import { createProjectRequirementsService } from '../../services/projectRequirements.service.js';
import { createProjectTasksService } from '../../services/projectTasks.service.js';
import { createProjectInspectionsService } from '../../services/projectInspections.service.js';

const requirementsService = createProjectRequirementsService({
  ProjectModel: Project,
  RequirementModel: Requirement
});
const tasksService = createProjectTasksService({
  ProjectModel: Project,
  TaskModel: (await import('../../models/Task.js')).default
});
const inspectionsService = createProjectInspectionsService({
  ProjectModel: Project,
  InspectionModel: (await import('../../models/Inspection.js')).default
});

export async function getProject({ projectId }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para obtener el proyecto.');
  }

  const project = await Project.findById(projectId).lean();
  if (!project) {
    throw new Error('Proyecto no encontrado.');
  }

  const [requirements, symbols, tasks, inspections] = await Promise.all([
    requirementsService.getProjectRequirements(projectId),
    SymbolModel.find({ project: projectId }).lean(),
    tasksService.getProjectTasks(projectId),
    inspectionsService.getProjectInspections(projectId)
  ]);

  return {
    id: project._id.toString(),
    name: project.name,
    securityCode: project.securityCode,
    requirementsCount: requirements.length,
    symbolsCount: symbols.length,
    tasksCount: tasks.length,
    inspectionsCount: inspections.length,
    createdAt: project.createdAt,
    about: project.about || { intro: '', items: [] }
  };
}
