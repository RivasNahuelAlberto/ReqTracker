import Scenario from '../models/Scenario.js';
import Project from '../models/Project.js';

function toScenarioPayload(item) {
  return {
    id: item._id?.toString(),
    type: item.type,
    title: item.title,
    objective: item.objective,
    locationTemporal: item.locationTemporal,
    locationGeographic: item.locationGeographic,
    preconditions: item.preconditions,
    actors: item.actors,
    resources: item.resources,
    episodes: item.episodes,
    exceptions: item.exceptions,
    order: item.order
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

  async function syncScenarioToProject(project, scenarioDoc) {
    const payload = toScenarioPayload({ _id: scenarioDoc._id, ...(scenarioDoc.toObject ? scenarioDoc.toObject() : scenarioDoc) });
    const scenarios = Array.isArray(project.scenarios) ? project.scenarios : [];
    const index = scenarios.findIndex((item) => item._id?.toString() === payload.id);

    if (index >= 0) {
      scenarios[index] = { ...scenarios[index], ...payload };
    } else {
      scenarios.push({ ...payload, createdAt: scenarioDoc.createdAt || new Date() });
    }

    project.scenarios = scenarios;
    if (typeof project.save === 'function') {
      await project.save();
    }
  }

  async function removeScenarioFromProject(project, scenarioId) {
    const scenarios = Array.isArray(project.scenarios) ? project.scenarios : [];
    project.scenarios = scenarios.filter((item) => item._id?.toString() !== scenarioId);
    if (typeof project.save === 'function') {
      await project.save();
    }
  }

  async function createScenario(projectId, payload) {
    const project = await ensureProject(projectId);
    const type = payload.type?.toString().trim() || '';
    const title = payload.title?.toString().trim() || '';

    if (!type || !title) {
      throw new Error('El tipo y el título del escenario son obligatorios.');
    }

    const created = await ScenarioModel.create({
      project: project._id,
      type,
      title,
      objective: payload.objective?.toString().trim() || '',
      locationTemporal: payload.locationTemporal?.toString().trim() || '',
      locationGeographic: payload.locationGeographic?.toString().trim() || '',
      preconditions: payload.preconditions?.toString().trim() || '',
      actors: payload.actors?.toString().trim() || '',
      resources: payload.resources?.toString().trim() || '',
      episodes: payload.episodes?.toString().trim() || '',
      exceptions: payload.exceptions?.toString().trim() || '',
      order: payload.order?.toString().trim() || '',
      createdAt: new Date()
    });

    await syncScenarioToProject(project, created);

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
    const project = await ensureProject(projectId);
    const existing = await ScenarioModel.findOne({ _id: scenarioId, project: projectId });
    if (!existing) {
      throw new Error('Escenario no encontrado.');
    }

    const updated = await ScenarioModel.findByIdAndUpdate(scenarioId, {
      ...(payload.type !== undefined ? { type: payload.type?.toString().trim() || existing.type } : {}),
      ...(payload.title !== undefined && payload.title.toString().trim() ? { title: payload.title.toString().trim() } : {}),
      ...(payload.objective !== undefined ? { objective: payload.objective?.toString().trim() || '' } : {}),
      ...(payload.locationTemporal !== undefined ? { locationTemporal: payload.locationTemporal?.toString().trim() || '' } : {}),
      ...(payload.locationGeographic !== undefined ? { locationGeographic: payload.locationGeographic?.toString().trim() || '' } : {}),
      ...(payload.preconditions !== undefined ? { preconditions: payload.preconditions?.toString().trim() || '' } : {}),
      ...(payload.actors !== undefined ? { actors: payload.actors?.toString().trim() || '' } : {}),
      ...(payload.resources !== undefined ? { resources: payload.resources?.toString().trim() || '' } : {}),
      ...(payload.episodes !== undefined ? { episodes: payload.episodes?.toString().trim() || '' } : {}),
      ...(payload.exceptions !== undefined ? { exceptions: payload.exceptions?.toString().trim() || '' } : {}),
      ...(payload.order !== undefined ? { order: payload.order?.toString().trim() || '' } : {})
    }, { new: true });

    await syncScenarioToProject(project, updated);

    return toScenarioPayload(updated);
  }

  async function deleteScenario(projectId, scenarioId) {
    const project = await ensureProject(projectId);
    const deleted = await ScenarioModel.deleteOne({ _id: scenarioId, project: projectId });
    if (deleted.deletedCount > 0) {
      await removeScenarioFromProject(project, scenarioId);
    }
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
