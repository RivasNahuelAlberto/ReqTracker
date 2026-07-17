import Project from '../../models/Project.js';
import Requirement from '../../models/Requirement.js';
import { createProjectRequirementsService } from '../../services/projectRequirements.service.js';

const requirementsService = createProjectRequirementsService({
  ProjectModel: Project,
  RequirementModel: Requirement
});

export async function getProject({ projectId }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para obtener el proyecto.');
  }

  const project = await Project.findById(projectId).lean();
  if (!project) {
    throw new Error('Proyecto no encontrado.');
  }

  const requirements = await requirementsService.getProjectRequirements(projectId);

  return {
    id: project._id.toString(),
    name: project.name,
    securityCode: project.securityCode,
    requirementsCount: requirements.length,
    symbolsCount: project.symbols?.length || 0,
    tasksCount: project.tasks?.length || 0,
    inspectionsCount: project.inspections?.length || 0,
    createdAt: project.createdAt,
    about: project.about
  };
}
