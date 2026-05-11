import Project from '../../models/Project.js';
import { emitProjectDataChanged } from '../../socket.js';

export async function createInspection({ projectId, targetType, targetId, targetLabel = '', aspect = '', description = '' }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para crear una inspección.');
  }
  if (!targetType || !targetType.toString().trim()) {
    throw new Error('El tipo de destino es obligatorio para crear una inspección.');
  }
  if (!targetId || !targetId.toString().trim()) {
    throw new Error('El ID del destino es obligatorio para crear una inspección.');
  }
  if (!aspect || !aspect.toString().trim()) {
    throw new Error('El aspecto de la inspección es obligatorio.');
  }
  if (!description || !description.toString().trim()) {
    throw new Error('La descripción de la inspección es obligatoria.');
  }

  const project = await Project.findById(projectId);
  if (!project) {
    throw new Error('Proyecto no encontrado.');
  }

  project.inspections = project.inspections || [];
  project.inspections.push({
    targetType: targetType.toString().trim(),
    targetId: targetId.toString().trim(),
    targetLabel: targetLabel?.toString().trim() || '',
    aspect: aspect.toString().trim(),
    description: description.toString().trim(),
    createdAt: new Date()
  });

  await project.save();
  emitProjectDataChanged(projectId, 'El asistente agregó una inspección al proyecto. Haz clic para recargar.');

  const created = project.inspections.at(-1);
  return {
    id: created._id.toString(),
    targetType: created.targetType,
    targetId: created.targetId,
    targetLabel: created.targetLabel,
    aspect: created.aspect,
    description: created.description
  };
}

export async function getInspection({ projectId, inspectionId }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para obtener una inspección.');
  }
  if (!inspectionId) {
    throw new Error('inspectionId es obligatorio para obtener una inspección.');
  }

  const project = await Project.findById(projectId).lean();
  if (!project) {
    throw new Error('Proyecto no encontrado.');
  }

  const inspection = (project.inspections || []).find((item) => item._id?.toString() === inspectionId);
  if (!inspection) {
    throw new Error('Inspección no encontrada.');
  }

  return {
    id: inspection._id.toString(),
    targetType: inspection.targetType,
    targetId: inspection.targetId,
    targetLabel: inspection.targetLabel,
    aspect: inspection.aspect,
    description: inspection.description
  };
}

export async function listInspections({ projectId }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para listar inspecciones.');
  }

  const project = await Project.findById(projectId).lean();
  if (!project) {
    throw new Error('Proyecto no encontrado.');
  }

  return (project.inspections || []).map((inspection) => ({
    id: inspection._id.toString(),
    targetType: inspection.targetType,
    targetId: inspection.targetId,
    targetLabel: inspection.targetLabel,
    aspect: inspection.aspect,
    description: inspection.description
  }));
}

export async function updateInspection({ projectId, inspectionId, targetType, targetId, targetLabel, aspect, description }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para actualizar una inspección.');
  }
  if (!inspectionId) {
    throw new Error('inspectionId es obligatorio para actualizar una inspección.');
  }

  const project = await Project.findById(projectId);
  if (!project) {
    throw new Error('Proyecto no encontrado.');
  }

  const inspection = project.inspections.id(inspectionId);
  if (!inspection) {
    throw new Error('Inspección no encontrada.');
  }

  if (targetType !== undefined) inspection.targetType = targetType?.toString().trim() || inspection.targetType;
  if (targetId !== undefined) inspection.targetId = targetId?.toString().trim() || inspection.targetId;
  if (targetLabel !== undefined) inspection.targetLabel = targetLabel?.toString().trim() || inspection.targetLabel;
  if (aspect !== undefined) inspection.aspect = aspect?.toString().trim() || inspection.aspect;
  if (description !== undefined) inspection.description = description?.toString().trim() || inspection.description;

  await project.save();
  emitProjectDataChanged(projectId, 'El asistente modificó una inspección del proyecto. Haz clic para recargar.');

  return {
    id: inspection._id.toString(),
    targetType: inspection.targetType,
    targetId: inspection.targetId,
    targetLabel: inspection.targetLabel,
    aspect: inspection.aspect,
    description: inspection.description
  };
}

export async function deleteInspection({ projectId, inspectionId }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para eliminar una inspección.');
  }
  if (!inspectionId) {
    throw new Error('inspectionId es obligatorio para eliminar una inspección.');
  }

  const project = await Project.findById(projectId);
  if (!project) {
    throw new Error('Proyecto no encontrado.');
  }

  const index = project.inspections.findIndex((item) => item._id?.toString() === inspectionId);
  if (index === -1) {
    throw new Error('Inspección no encontrada.');
  }

  project.inspections.splice(index, 1);
  await project.save();
  emitProjectDataChanged(projectId, 'El asistente eliminó una inspección del proyecto. Haz clic para recargar.');

  return { message: 'Inspección eliminada.' };
}
