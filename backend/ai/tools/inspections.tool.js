import Project from '../../models/Project.js';
import Inspection from '../../models/Inspection.js';
import { emitProjectDataChanged } from '../../socket.js';
import { createProjectInspectionsService } from '../../services/projectInspections.service.js';

const inspectionsService = createProjectInspectionsService({
  ProjectModel: Project,
  InspectionModel: Inspection
});

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

  const created = await inspectionsService.createInspection(projectId, {
    targetType: targetType.toString().trim(),
    targetId: targetId.toString().trim(),
    targetLabel: targetLabel?.toString().trim() || '',
    aspect: aspect.toString().trim(),
    description: description.toString().trim()
  });

  emitProjectDataChanged(projectId, 'El asistente agregó una inspección al proyecto. Haz clic para recargar.');

  return {
    id: created.id,
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

  const inspection = await inspectionsService.getInspection(projectId, inspectionId);

  return {
    id: inspection.id,
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

  const inspections = await inspectionsService.getProjectInspections(projectId);

  return inspections.map((inspection) => ({
    id: inspection.id,
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

  const inspection = await inspectionsService.updateInspection(projectId, inspectionId, {
    targetType,
    targetId,
    targetLabel,
    aspect,
    description
  });

  emitProjectDataChanged(projectId, 'El asistente modificó una inspección del proyecto. Haz clic para recargar.');

  return {
    id: inspection.id,
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

  const deleted = await inspectionsService.deleteInspection(projectId, inspectionId);
  if (!deleted.deleted) {
    throw new Error('Inspección no encontrada.');
  }

  emitProjectDataChanged(projectId, 'El asistente eliminó una inspección del proyecto. Haz clic para recargar.');

  return { message: 'Inspección eliminada.' };
}
