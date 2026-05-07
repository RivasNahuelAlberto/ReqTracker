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
