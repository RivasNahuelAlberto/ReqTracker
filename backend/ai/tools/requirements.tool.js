import Project from '../../models/Project.js';
import { generateEmbedding } from '../embeddings.js';

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

  project.requirements = project.requirements || [];
  project.requirements.push({
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
    embedding,
    createdAt: new Date()
  });

  await project.save();
  const created = project.requirements.at(-1);

  return {
    id: created._id.toString(),
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

  const requirements = (project.requirements || []).slice(0, limit).map((item) => ({
    id: item._id.toString(),
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

  const requirement = (project.requirements || []).find((item) => item._id?.toString() === requirementId);
  if (!requirement) {
    throw new Error('Requisito no encontrado.');
  }

  return {
    id: requirement._id.toString(),
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

  const requirement = project.requirements.id(requirementId);
  if (!requirement) {
    throw new Error('Requisito no encontrado.');
  }

  if (identifier !== undefined) requirement.identifier = identifier?.toString().trim() || '';
  if (name !== undefined && name.toString().trim()) requirement.name = name.toString().trim();
  if (type !== undefined) requirement.type = type?.toString().trim() || requirement.type;
  if (description !== undefined) requirement.description = description?.toString().trim() || requirement.description;
  if (basis !== undefined) requirement.basis = basis?.toString().trim() || requirement.basis;
  if (priority !== undefined) requirement.priority = ['Alta', 'Media', 'Baja'].includes(priority) ? priority : requirement.priority;
  if (criticidad !== undefined) requirement.criticidad = ['Alta', 'Media', 'Baja'].includes(criticidad) ? criticidad : requirement.criticidad;
  if (costoImplementacion !== undefined) requirement.costoImplementacion = ['Alto', 'Medio', 'Bajo'].includes(costoImplementacion) ? costoImplementacion : requirement.costoImplementacion;
  if (volatilidad !== undefined) requirement.volatilidad = ['Alta', 'Media', 'Baja'].includes(volatilidad) ? volatilidad : requirement.volatilidad;
  if (factibilidad !== undefined) requirement.factibilidad = ['Alta', 'Media', 'Baja'].includes(factibilidad) ? factibilidad : requirement.factibilidad;
  if (riesgo !== undefined) requirement.riesgo = ['Alto', 'Medio', 'Bajo'].includes(riesgo) ? riesgo : requirement.riesgo;
  if (status !== undefined) requirement.status = status?.toString().trim() || requirement.status;

  await project.save();

  return {
    id: requirement._id.toString(),
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

  const requirementIndex = project.requirements.findIndex((item) => item._id?.toString() === requirementId);
  if (requirementIndex === -1) {
    throw new Error('Requisito no encontrado.');
  }

  project.requirements.splice(requirementIndex, 1);
  await project.save();

  return { message: 'Requisito eliminado.' };
}
