import Project from '../../models/Project.js';

export async function getProject({ projectId }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para obtener el proyecto.');
  }

  const project = await Project.findById(projectId).lean();
  if (!project) {
    throw new Error('Proyecto no encontrado.');
  }

  return {
    id: project._id.toString(),
    name: project.name,
    securityCode: project.securityCode,
    requirementsCount: project.requirements?.length || 0,
    symbolsCount: project.symbols?.length || 0,
    tasksCount: project.tasks?.length || 0,
    inspectionsCount: project.inspections?.length || 0,
    createdAt: project.createdAt,
    about: project.about
  };
}
