import Inspection from '../models/Inspection.js';
import Project from '../models/Project.js';

function toInspectionPayload(item) {
  return {
    id: item._id?.toString(),
    targetType: item.targetType,
    targetId: item.targetId?.toString ? item.targetId.toString() : item.targetId,
    targetLabel: item.targetLabel,
    aspect: item.aspect,
    description: item.description
  };
}

export function createProjectInspectionsService({ ProjectModel = Project, InspectionModel = Inspection } = {}) {
  async function ensureProject(projectId) {
    const project = await ProjectModel.findById(projectId);
    if (!project) {
      throw new Error('Proyecto no encontrado.');
    }
    return project;
  }

  async function syncInspectionToProject(project, inspectionDoc) {
    const payload = toInspectionPayload({ _id: inspectionDoc._id, ...(inspectionDoc.toObject ? inspectionDoc.toObject() : inspectionDoc) });
    const inspections = Array.isArray(project.inspections) ? project.inspections : [];
    const index = inspections.findIndex((item) => item._id?.toString() === payload.id);

    if (index >= 0) {
      inspections[index] = { ...inspections[index], ...payload };
    } else {
      inspections.push({ ...payload, createdAt: inspectionDoc.createdAt || new Date() });
    }

    project.inspections = inspections;
    if (typeof project.save === 'function') {
      await project.save();
    }
  }

  async function removeInspectionFromProject(project, inspectionId) {
    const inspections = Array.isArray(project.inspections) ? project.inspections : [];
    project.inspections = inspections.filter((item) => item._id?.toString() !== inspectionId);
    if (typeof project.save === 'function') {
      await project.save();
    }
  }

  async function createInspection(projectId, payload) {
    const project = await ensureProject(projectId);
    const targetType = payload.targetType?.toString().trim() || '';
    const targetId = payload.targetId?.toString().trim() || '';
    const aspect = payload.aspect?.toString().trim() || '';
    const description = payload.description?.toString().trim() || '';

    if (!targetType || !targetId || !aspect || !description) {
      throw new Error('Los datos de la inspección son obligatorios.');
    }

    const created = await InspectionModel.create({
      project: project._id,
      targetType,
      targetId,
      targetLabel: payload.targetLabel?.toString().trim() || '',
      aspect,
      description,
      createdAt: new Date()
    });

    await syncInspectionToProject(project, created);

    return toInspectionPayload(created);
  }

  async function getProjectInspections(projectId) {
    await ensureProject(projectId);
    const inspections = await InspectionModel.find({ project: projectId }).sort({ createdAt: 1 });
    return inspections.map((item) => toInspectionPayload(item));
  }

  async function getInspection(projectId, inspectionId) {
    await ensureProject(projectId);
    const inspection = await InspectionModel.findOne({ _id: inspectionId, project: projectId });
    if (!inspection) {
      throw new Error('Inspección no encontrada.');
    }
    return toInspectionPayload(inspection);
  }

  async function updateInspection(projectId, inspectionId, payload) {
    const project = await ensureProject(projectId);
    const existing = await InspectionModel.findOne({ _id: inspectionId, project: projectId });
    if (!existing) {
      throw new Error('Inspección no encontrada.');
    }

    const updated = await InspectionModel.findByIdAndUpdate(inspectionId, {
      ...(payload.targetType !== undefined ? { targetType: payload.targetType?.toString().trim() || existing.targetType } : {}),
      ...(payload.targetId !== undefined ? { targetId: payload.targetId?.toString().trim() || existing.targetId } : {}),
      ...(payload.targetLabel !== undefined ? { targetLabel: payload.targetLabel?.toString().trim() || existing.targetLabel } : {}),
      ...(payload.aspect !== undefined ? { aspect: payload.aspect?.toString().trim() || existing.aspect } : {}),
      ...(payload.description !== undefined ? { description: payload.description?.toString().trim() || existing.description } : {})
    }, { new: true });

    await syncInspectionToProject(project, updated);

    return toInspectionPayload(updated);
  }

  async function deleteInspection(projectId, inspectionId) {
    const project = await ensureProject(projectId);
    const deleted = await InspectionModel.deleteOne({ _id: inspectionId, project: projectId });
    if (deleted.deletedCount > 0) {
      await removeInspectionFromProject(project, inspectionId);
    }
    return { deleted: deleted.deletedCount > 0 };
  }

  return {
    createInspection,
    getProjectInspections,
    getInspection,
    updateInspection,
    deleteInspection
  };
}
