import Scenario from '../models/Scenario.js';
import Project from '../models/Project.js';

function toScenarioPayload(item) {
  const scenarioId = item?._id?.toString?.() || '';
  return {
    _id: scenarioId,
    id: scenarioId,
    type: item?.type?.toString?.().trim() || 'Escenario',
    title: item?.title?.toString?.().trim() || '',
    status: item?.status?.toString?.().trim() || 'incomplete',
    objective: item?.objective?.toString?.().trim() || '',
    locationTemporal: item?.locationTemporal?.toString?.().trim() || '',
    locationGeographic: item?.locationGeographic?.toString?.().trim() || '',
    preconditions: item?.preconditions?.toString?.().trim() || '',
    actors: item?.actors?.toString?.().trim() || '',
    resources: item?.resources?.toString?.().trim() || '',
    episodes: item?.episodes?.toString?.().trim() || '',
    exceptions: item?.exceptions?.toString?.().trim() || '',
    order: item?.order?.toString?.().trim() || '',
    createdAt: item?.createdAt || null
  };
}

function normalizeScenarioPayload(payload = {}) {
  return {
    type: payload.type?.toString?.().trim() || '',
    title: payload.title?.toString?.().trim() || '',
    status: payload.status?.toString?.().trim() || '',
    objective: payload.objective?.toString?.().trim() || '',
    locationTemporal: payload.locationTemporal?.toString?.().trim() || '',
    locationGeographic: payload.locationGeographic?.toString?.().trim() || '',
    preconditions: payload.preconditions?.toString?.().trim() || '',
    actors: payload.actors?.toString?.().trim() || '',
    resources: payload.resources?.toString?.().trim() || '',
    episodes: payload.episodes?.toString?.().trim() || '',
    exceptions: payload.exceptions?.toString?.().trim() || '',
    order: payload.order?.toString?.().trim() || ''
  };
}

export function createProjectScenariosService({ ProjectModel = Project, ScenarioModel = Scenario } = {}) {
  async function ensureProject(projectId) {
    const project = await ProjectModel.findById(projectId);
    if (!project) {
      throw new Error('Proyecto no encontrado.');
    }
    return project;
  }

  async function createScenario(projectId, payload) {
    const project = await ensureProject(projectId);
    const normalizedPayload = normalizeScenarioPayload(payload || {});
    const type = normalizedPayload.type;
    const title = normalizedPayload.title;

    if (!type || !title) {
      throw new Error('El tipo y el título del escenario son obligatorios.');
    }

    const created = await ScenarioModel.create({
      project: project._id,
      status: normalizedPayload.status || 'incomplete',
      ...normalizedPayload,
      createdAt: new Date()
    });

    return toScenarioPayload(created);
  }

  async function getProjectScenarios(projectId) {
    await ensureProject(projectId);
    const scenarios = await ScenarioModel.find({ project: projectId }).sort({ createdAt: 1 });
    return scenarios.map((item) => toScenarioPayload(item));
  }

  async function getScenario(projectId, scenarioId) {
    await ensureProject(projectId);
    const scenario = await ScenarioModel.findOne({ _id: scenarioId, project: projectId });
    if (!scenario) {
      throw new Error('Escenario no encontrado.');
    }
    return toScenarioPayload(scenario);
  }

  async function updateScenario(projectId, scenarioId, payload) {
    await ensureProject(projectId);
    const existing = await ScenarioModel.findOne({ _id: scenarioId, project: projectId });
    if (!existing) {
      throw new Error('Escenario no encontrado.');
    }

    const normalizedPayload = normalizeScenarioPayload(payload || {});
    const updatePayload = {};

    if (payload?.type !== undefined) {
      const nextType = normalizedPayload.type || existing.type;
      updatePayload.type = nextType;
    }
    if (payload?.title !== undefined) {
      updatePayload.title = normalizedPayload.title || existing.title;
    }
    if (payload?.objective !== undefined) updatePayload.objective = normalizedPayload.objective;
    if (payload?.locationTemporal !== undefined) updatePayload.locationTemporal = normalizedPayload.locationTemporal;
    if (payload?.locationGeographic !== undefined) updatePayload.locationGeographic = normalizedPayload.locationGeographic;
    if (payload?.preconditions !== undefined) updatePayload.preconditions = normalizedPayload.preconditions;
    if (payload?.actors !== undefined) updatePayload.actors = normalizedPayload.actors;
    if (payload?.resources !== undefined) updatePayload.resources = normalizedPayload.resources;
    if (payload?.episodes !== undefined) updatePayload.episodes = normalizedPayload.episodes;
    if (payload?.exceptions !== undefined) updatePayload.exceptions = normalizedPayload.exceptions;
    if (payload?.status !== undefined) updatePayload.status = normalizedPayload.status || existing.status;
    if (payload?.order !== undefined) updatePayload.order = normalizedPayload.order;

    const updated = await ScenarioModel.findByIdAndUpdate(scenarioId, updatePayload, { new: true });

    return toScenarioPayload(updated);
  }

  async function deleteScenario(projectId, scenarioId) {
    await ensureProject(projectId);
    const deleted = await ScenarioModel.deleteOne({ _id: scenarioId, project: projectId });
    return { deleted: deleted.deletedCount > 0 };
  }

  return {
    createScenario,
    getProjectScenarios,
    getScenario,
    updateScenario,
    deleteScenario
  };
}
