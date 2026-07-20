import Project from '../../models/Project.js';
import Scenario from '../../models/Scenario.js';
import { emitProjectDataChanged } from '../../socket.js';
import { invalidateProjectCache } from '../cache/redis.cache.js';
import { createProjectScenariosService } from '../../services/projectScenarios.service.js';

const scenariosService = createProjectScenariosService({
  ProjectModel: Project,
  ScenarioModel: Scenario
});

export async function createScenario({ projectId, type, title, objective = '', locationTemporal = '', locationGeographic = '', preconditions = '', actors = '', resources = '', episodes = '', exceptions = '', order = '' }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para crear un escenario.');
  }
  if (!type || !type.toString().trim()) {
    throw new Error('El tipo de escenario es obligatorio.');
  }
  if (!title || !title.toString().trim()) {
    throw new Error('El título del escenario es obligatorio.');
  }

  const created = await scenariosService.createScenario(projectId, {
    type,
    title,
    objective,
    locationTemporal,
    locationGeographic,
    preconditions,
    actors,
    resources,
    episodes,
    exceptions,
    order
  });

  await invalidateProjectCache(projectId);
  emitProjectDataChanged(projectId, 'El asistente agregó un escenario al proyecto. Haz clic para recargar.');

  return created;
}

export async function updateScenario({ projectId, scenarioId, type, title, objective, locationTemporal, locationGeographic, preconditions, actors, resources, episodes, exceptions, order }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para actualizar un escenario.');
  }
  if (!scenarioId) {
    throw new Error('scenarioId es obligatorio para actualizar un escenario.');
  }

  const updated = await scenariosService.updateScenario(projectId, scenarioId, {
    type,
    title,
    objective,
    locationTemporal,
    locationGeographic,
    preconditions,
    actors,
    resources,
    episodes,
    exceptions,
    order
  });

  await invalidateProjectCache(projectId);
  emitProjectDataChanged(projectId, 'El asistente modificó un escenario del proyecto. Haz clic para recargar.');

  return updated;
}

export async function getScenario({ projectId, scenarioId }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para obtener un escenario.');
  }
  if (!scenarioId) {
    throw new Error('scenarioId es obligatorio para obtener un escenario.');
  }

  return scenariosService.getScenario(projectId, scenarioId);
}

export async function deleteScenario({ projectId, scenarioId }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para eliminar un escenario.');
  }
  if (!scenarioId) {
    throw new Error('scenarioId es obligatorio para eliminar un escenario.');
  }

  const deleted = await scenariosService.deleteScenario(projectId, scenarioId);
  await invalidateProjectCache(projectId);
  emitProjectDataChanged(projectId, 'El asistente eliminó un escenario del proyecto. Haz clic para recargar.');

  return deleted.deleted ? { message: 'Escenario eliminado.' } : { message: 'Escenario no encontrado.' };
}

export async function listScenarios({ projectId }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para listar escenarios.');
  }

  return scenariosService.getProjectScenarios(projectId);
}
