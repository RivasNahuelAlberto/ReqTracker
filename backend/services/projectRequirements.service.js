export function createProjectRequirementsService({ ProjectModel, RequirementModel }) {
  async function ensureProject(projectId) {
    const project = await ProjectModel.findById(projectId);
    if (!project) {
      throw new Error('Proyecto no encontrado.');
    }
    return project;
  }

  async function createRequirement(projectId, payload) {
    const project = await ensureProject(projectId);
    const created = await RequirementModel.create({
      project: project._id,
      identifier: payload.identifier || '',
      name: payload.name,
      type: payload.type || '',
      description: payload.description || '',
      basis: payload.basis || '',
      priority: payload.priority || 'Media',
      criticidad: payload.criticidad || 'Media',
      costoImplementacion: payload.costoImplementacion || 'Medio',
      volatilidad: payload.volatilidad || 'Media',
      factibilidad: payload.factibilidad || 'Media',
      riesgo: payload.riesgo || 'Medio',
      status: payload.status || 'Nuevo',
      embedding: payload.embedding || [],
      createdAt: new Date()
    });

    return {
      id: created._id.toString(),
      identifier: created.identifier,
      name: created.name,
      type: created.type,
      description: created.description,
      basis: created.basis,
      priority: created.priority,
      criticidad: created.criticidad,
      costoImplementacion: created.costoImplementacion,
      volatilidad: created.volatilidad,
      factibilidad: created.factibilidad,
      riesgo: created.riesgo,
      status: created.status || 'Nuevo'
    };
  }

  async function getProjectRequirements(projectId) {
    await ensureProject(projectId);
    const requirements = await RequirementModel.find({ project: projectId }).sort({ createdAt: 1 });
    return requirements.map((item) => ({
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
  }

  async function updateRequirement(projectId, requirementId, payload) {
    await ensureProject(projectId);
    const existing = await RequirementModel.findOne({ _id: requirementId, project: projectId });
    if (!existing) {
      throw new Error('Requisito no encontrado.');
    }

    const updated = await RequirementModel.findByIdAndUpdate(requirementId, {
      ...(payload.identifier !== undefined ? { identifier: payload.identifier?.toString().trim() || '' } : {}),
      ...(payload.name !== undefined && payload.name.toString().trim() ? { name: payload.name.toString().trim() } : {}),
      ...(payload.type !== undefined ? { type: payload.type?.toString().trim() || '' } : {}),
      ...(payload.description !== undefined ? { description: payload.description?.toString().trim() || '' } : {}),
      ...(payload.basis !== undefined ? { basis: payload.basis?.toString().trim() || '' } : {}),
      ...(payload.priority !== undefined ? { priority: ['Alta', 'Media', 'Baja'].includes(payload.priority) ? payload.priority : existing.priority } : {}),
      ...(payload.criticidad !== undefined ? { criticidad: ['Alta', 'Media', 'Baja'].includes(payload.criticidad) ? payload.criticidad : existing.criticidad } : {}),
      ...(payload.costoImplementacion !== undefined ? { costoImplementacion: ['Alto', 'Medio', 'Bajo'].includes(payload.costoImplementacion) ? payload.costoImplementacion : existing.costoImplementacion } : {}),
      ...(payload.volatilidad !== undefined ? { volatilidad: ['Alta', 'Media', 'Baja'].includes(payload.volatilidad) ? payload.volatilidad : existing.volatilidad } : {}),
      ...(payload.factibilidad !== undefined ? { factibilidad: ['Alta', 'Media', 'Baja'].includes(payload.factibilidad) ? payload.factibilidad : existing.factibilidad } : {}),
      ...(payload.riesgo !== undefined ? { riesgo: ['Alto', 'Medio', 'Bajo'].includes(payload.riesgo) ? payload.riesgo : existing.riesgo } : {}),
      ...(payload.status !== undefined ? { status: payload.status?.toString().trim() || existing.status } : {})
    }, { new: true });

    return {
      id: updated._id.toString(),
      identifier: updated.identifier,
      name: updated.name,
      type: updated.type,
      description: updated.description,
      basis: updated.basis,
      priority: updated.priority,
      criticidad: updated.criticidad,
      costoImplementacion: updated.costoImplementacion,
      volatilidad: updated.volatilidad,
      factibilidad: updated.factibilidad,
      riesgo: updated.riesgo,
      status: updated.status || 'Nuevo'
    };
  }

  async function deleteRequirement(projectId, requirementId) {
    await ensureProject(projectId);
    const deleted = await RequirementModel.deleteOne({ _id: requirementId, project: projectId });
    return { deleted: deleted.deletedCount > 0 };
  }

  return {
    createRequirement,
    getProjectRequirements,
    updateRequirement,
    deleteRequirement
  };
}
