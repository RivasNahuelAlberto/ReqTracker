function toRequirementPayload(item) {
  const id = item?._id?.toString?.() || item?.id?.toString?.() || '';
  return {
    _id: id,
    id,
    identifier: item?.identifier || '',
    name: item?.name || 'Sin nombre',
    type: item?.type || '',
    description: item?.description || '',
    basis: item?.basis || '',
    priority: item?.priority || 'Media',
    criticidad: item?.criticidad || 'Media',
    costoImplementacion: item?.costoImplementacion || 'Medio',
    volatilidad: item?.volatilidad || 'Media',
    factibilidad: item?.factibilidad || 'Media',
    riesgo: item?.riesgo || 'Medio',
    status: item?.status || 'Nuevo',
    embedding: Array.isArray(item?.embedding) ? item.embedding : []
  };
}

export function createProjectRequirementsService({ ProjectModel, RequirementModel }) {
  async function ensureProject(projectId) {
    const project = await ProjectModel.findById(projectId);
    if (!project) {
      throw new Error('Proyecto no encontrado.');
    }
    return project;
  }

  async function createRequirement(projectId, payload = {}) {
    const project = await ensureProject(projectId);
    const normalizedPayload = payload || {};
    const created = await RequirementModel.create({
      project: project._id,
      identifier: normalizedPayload.identifier?.toString().trim() || '',
      name: normalizedPayload.name?.toString().trim() || 'Sin nombre',
      type: normalizedPayload.type?.toString().trim() || '',
      description: normalizedPayload.description?.toString().trim() || '',
      basis: normalizedPayload.basis?.toString().trim() || '',
      priority: normalizedPayload.priority?.toString().trim() || 'Media',
      criticidad: normalizedPayload.criticidad?.toString().trim() || 'Media',
      costoImplementacion: normalizedPayload.costoImplementacion?.toString().trim() || 'Medio',
      volatilidad: normalizedPayload.volatilidad?.toString().trim() || 'Media',
      factibilidad: normalizedPayload.factibilidad?.toString().trim() || 'Media',
      riesgo: normalizedPayload.riesgo?.toString().trim() || 'Medio',
      status: normalizedPayload.status?.toString().trim() || 'Nuevo',
      embedding: Array.isArray(normalizedPayload.embedding) ? normalizedPayload.embedding : [],
      createdAt: new Date()
    });

    return toRequirementPayload(created);
  }

  async function getProjectRequirements(projectId) {
    await ensureProject(projectId);
    const requirements = await RequirementModel.find({ project: projectId }).sort({ createdAt: 1 });
    return requirements.map((item) => toRequirementPayload(item));
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
      ...(payload.type !== undefined ? { type: payload.type?.toString().trim() || existing.type } : {}),
      ...(payload.description !== undefined ? { description: payload.description?.toString().trim() || existing.description } : {}),
      ...(payload.basis !== undefined ? { basis: payload.basis?.toString().trim() || '' } : {}),
      ...(payload.priority !== undefined ? { priority: ['Alta', 'Media', 'Baja'].includes(payload.priority) ? payload.priority : existing.priority } : {}),
      ...(payload.criticidad !== undefined ? { criticidad: ['Alta', 'Media', 'Baja'].includes(payload.criticidad) ? payload.criticidad : existing.criticidad } : {}),
      ...(payload.costoImplementacion !== undefined ? { costoImplementacion: ['Alto', 'Medio', 'Bajo'].includes(payload.costoImplementacion) ? payload.costoImplementacion : existing.costoImplementacion } : {}),
      ...(payload.volatilidad !== undefined ? { volatilidad: ['Alta', 'Media', 'Baja'].includes(payload.volatilidad) ? payload.volatilidad : existing.volatilidad } : {}),
      ...(payload.factibilidad !== undefined ? { factibilidad: ['Alta', 'Media', 'Baja'].includes(payload.factibilidad) ? payload.factibilidad : existing.factibilidad } : {}),
      ...(payload.riesgo !== undefined ? { riesgo: ['Alto', 'Medio', 'Bajo'].includes(payload.riesgo) ? payload.riesgo : existing.riesgo } : {}),
      ...(payload.status !== undefined ? { status: payload.status?.toString().trim() || existing.status } : {})
    }, { new: true });

    return toRequirementPayload(updated);
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
