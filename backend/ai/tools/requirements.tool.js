import Project from '../../models/Project.js';
import Requirement from '../../models/Requirement.js';
import { createProjectRequirementsService } from '../../services/projectRequirements.service.js';
import { generateEmbedding } from '../embeddings.js';
import { emitProjectDataChanged } from '../../socket.js';
import { invalidateProjectCache } from '../cache/redis.cache.js';

const requirementsService = createProjectRequirementsService({
  ProjectModel: Project,
  RequirementModel: Requirement
});

export async function createRequirement({ projectId, name, description = '', type = 'General', status = 'Nuevo', basis = '', priority = 'Media', criticidad = 'Media', costoImplementacion = 'Medio', volatilidad = 'Media', factibilidad = 'Media', riesgo = 'Medio' }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para crear un requisito.');
  }
  if (!name || !name.toString().trim()) {
    throw new Error('El nombre del requisito es obligatorio.');
  }

  const project = await Project.findById(projectId);
  if (!project) {
    throw new Error('Proyecto no encontrado.');
  }

  const normalizedDescription = description?.toString().trim() || `Requisito generado automáticamente para prueba. Este elemento se creó con datos de ejemplo para validar la funcionalidad.`;
  const normalizedBasis = basis?.toString().trim() || 'Requisito de prueba generado por el asistente AI con datos de ejemplo.';

  const textToEmbed = `${name} ${normalizedDescription} ${normalizedBasis}`.trim();
  let embedding = [];
  try {
    embedding = await generateEmbedding(textToEmbed);
  } catch (error) {
    console.warn('No se pudo generar embedding:', error.message);
  }

  const created = await requirementsService.createRequirement(projectId, {
    identifier: '',
    name: name.toString().trim(),
    type: type?.toString().trim() || 'General',
    description: normalizedDescription,
    basis: normalizedBasis,
    priority: ['Alta', 'Media', 'Baja'].includes(priority) ? priority : 'Media',
    criticidad: ['Alta', 'Media', 'Baja'].includes(criticidad) ? criticidad : 'Media',
    costoImplementacion: ['Alto', 'Medio', 'Bajo'].includes(costoImplementacion) ? costoImplementacion : 'Medio',
    volatilidad: ['Alta', 'Media', 'Baja'].includes(volatilidad) ? volatilidad : 'Media',
    factibilidad: ['Alta', 'Media', 'Baja'].includes(factibilidad) ? factibilidad : 'Media',
    riesgo: ['Alto', 'Medio', 'Bajo'].includes(riesgo) ? riesgo : 'Medio',
    status: status?.toString().trim() || 'Nuevo',
    embedding
  });
  
  // Invalidate cache for this project
  await invalidateProjectCache(projectId);
  
  emitProjectDataChanged(projectId, 'El asistente agregó un requisito al proyecto. Haz clic para recargar.');

  return {
    id: created.id,
    name: created.name,
    type: created.type,
    description: created.description,
    status: created.status || 'Nuevo'
  };
}

export async function getRequirements({ projectId, limit = 10 }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para obtener requisitos.');
  }

  const project = await Project.findById(projectId).lean();
  if (!project) {
    throw new Error('Proyecto no encontrado.');
  }

  const requirements = (await requirementsService.getProjectRequirements(projectId)).slice(0, limit).map((item) => ({
    id: item.id,
    identifier: item.identifier,
    name: item.name,
    type: item.type,
    description: item.description,
    basis: item.basis,
    priority: item.priority,
    criticidad: item.criticidad,
    costoImplementacion: item.costoImplementacion,
    volatilidad: item.volatilidad,
    factibilidad: item.factibilidad,
    riesgo: item.riesgo,
    status: item.status || 'Nuevo'
  }));

  return {
    projectId,
    requirements
  };
}

export async function getRequirement({ projectId, requirementId }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para obtener un requisito.');
  }
  if (!requirementId) {
    throw new Error('requirementId es obligatorio para obtener un requisito.');
  }

  const project = await Project.findById(projectId).lean();
  if (!project) {
    throw new Error('Proyecto no encontrado.');
  }

  const requirement = (await requirementsService.getProjectRequirements(projectId)).find((item) => item.id === requirementId);
  if (!requirement) {
    throw new Error('Requisito no encontrado.');
  }

  return {
    id: requirement.id,
    identifier: requirement.identifier,
    name: requirement.name,
    type: requirement.type,
    description: requirement.description,
    basis: requirement.basis,
    priority: requirement.priority,
    criticidad: requirement.criticidad,
    costoImplementacion: requirement.costoImplementacion,
    volatilidad: requirement.volatilidad,
    factibilidad: requirement.factibilidad,
    riesgo: requirement.riesgo,
    status: requirement.status || 'Nuevo'
  };
}

export async function updateRequirement({ projectId, requirementId, identifier, name, type, description, basis, priority, criticidad, costoImplementacion, volatilidad, factibilidad, riesgo, status }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para actualizar un requisito.');
  }
  if (!requirementId) {
    throw new Error('requirementId es obligatorio para actualizar un requisito.');
  }

  const project = await Project.findById(projectId);
  if (!project) {
    throw new Error('Proyecto no encontrado.');
  }

  const requirement = await requirementsService.updateRequirement(projectId, requirementId, {
    identifier,
    name,
    type,
    description,
    basis,
    priority,
    criticidad,
    costoImplementacion,
    volatilidad,
    factibilidad,
    riesgo,
    status
  });
  
  // Invalidate cache for this project
  await invalidateProjectCache(projectId);
  
  emitProjectDataChanged(projectId, 'El asistente modificó un requisito del proyecto. Haz clic para recargar.');

  return {
    id: requirement.id,
    identifier: requirement.identifier,
    name: requirement.name,
    type: requirement.type,
    description: requirement.description,
    basis: requirement.basis,
    priority: requirement.priority,
    criticidad: requirement.criticidad,
    costoImplementacion: requirement.costoImplementacion,
    volatilidad: requirement.volatilidad,
    factibilidad: requirement.factibilidad,
    riesgo: requirement.riesgo,
    status: requirement.status
  };
}

export async function deleteRequirement({ projectId, requirementId }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para eliminar un requisito.');
  }
  if (!requirementId) {
    throw new Error('requirementId es obligatorio para eliminar un requisito.');
  }

  const project = await Project.findById(projectId);
  if (!project) {
    throw new Error('Proyecto no encontrado.');
  }

  const deleted = await requirementsService.deleteRequirement(projectId, requirementId);
  if (!deleted.deleted) {
    throw new Error('Requisito no encontrado.');
  }
  
  // Invalidate cache for this project
  await invalidateProjectCache(projectId);
  
  emitProjectDataChanged(projectId, 'El asistente eliminó un requisito del proyecto. Haz clic para recargar.');

  return { message: 'Requisito eliminado.' };
}
