import Project from '../../models/Project.js';

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

  const project = await Project.findById(projectId);
  if (!project) {
    throw new Error('Proyecto no encontrado.');
  }

  project.scenarios = project.scenarios || [];
  project.scenarios.push({
    type: type.toString().trim(),
    title: title.toString().trim(),
    objective: objective?.toString().trim() || '',
    locationTemporal: locationTemporal?.toString().trim() || '',
    locationGeographic: locationGeographic?.toString().trim() || '',
    preconditions: preconditions?.toString().trim() || '',
    actors: actors?.toString().trim() || '',
    resources: resources?.toString().trim() || '',
    episodes: episodes?.toString().trim() || '',
    exceptions: exceptions?.toString().trim() || '',
    order: order?.toString().trim() || '',
    createdAt: new Date()
  });

  await project.save();
  const created = project.scenarios.at(-1);

  return {
    id: created._id.toString(),
    type: created.type,
    title: created.title,
    objective: created.objective,
    locationTemporal: created.locationTemporal,
    locationGeographic: created.locationGeographic,
    preconditions: created.preconditions,
    actors: created.actors,
    resources: created.resources,
    episodes: created.episodes,
    exceptions: created.exceptions,
    order: created.order
  };
}

export async function updateScenario({ projectId, scenarioId, type, title, objective, locationTemporal, locationGeographic, preconditions, actors, resources, episodes, exceptions, order }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para actualizar un escenario.');
  }
  if (!scenarioId) {
    throw new Error('scenarioId es obligatorio para actualizar un escenario.');
  }

  const project = await Project.findById(projectId);
  if (!project) {
    throw new Error('Proyecto no encontrado.');
  }

  const scenario = project.scenarios.id(scenarioId);
  if (!scenario) {
    throw new Error('Escenario no encontrado.');
  }

  if (type !== undefined) scenario.type = type?.toString().trim() || scenario.type;
  if (title !== undefined && title.toString().trim()) scenario.title = title.toString().trim();
  if (objective !== undefined) scenario.objective = objective?.toString().trim() || '';
  if (locationTemporal !== undefined) scenario.locationTemporal = locationTemporal?.toString().trim() || '';
  if (locationGeographic !== undefined) scenario.locationGeographic = locationGeographic?.toString().trim() || '';
  if (preconditions !== undefined) scenario.preconditions = preconditions?.toString().trim() || '';
  if (actors !== undefined) scenario.actors = actors?.toString().trim() || '';
  if (resources !== undefined) scenario.resources = resources?.toString().trim() || '';
  if (episodes !== undefined) scenario.episodes = episodes?.toString().trim() || '';
  if (exceptions !== undefined) scenario.exceptions = exceptions?.toString().trim() || '';
  if (order !== undefined) scenario.order = order?.toString().trim() || '';

  await project.save();

  return {
    id: scenario._id.toString(),
    type: scenario.type,
    title: scenario.title,
    objective: scenario.objective,
    locationTemporal: scenario.locationTemporal,
    locationGeographic: scenario.locationGeographic,
    preconditions: scenario.preconditions,
    actors: scenario.actors,
    resources: scenario.resources,
    episodes: scenario.episodes,
    exceptions: scenario.exceptions,
    order: scenario.order
  };
}

export async function deleteScenario({ projectId, scenarioId }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para eliminar un escenario.');
  }
  if (!scenarioId) {
    throw new Error('scenarioId es obligatorio para eliminar un escenario.');
  }

  const project = await Project.findById(projectId);
  if (!project) {
    throw new Error('Proyecto no encontrado.');
  }

  const scenarioIndex = project.scenarios.findIndex((item) => item._id?.toString() === scenarioId);
  if (scenarioIndex === -1) {
    throw new Error('Escenario no encontrado.');
  }

  project.scenarios.splice(scenarioIndex, 1);
  await project.save();

  return { message: 'Escenario eliminado.' };
}

export async function listScenarios({ projectId }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para listar escenarios.');
  }

  const project = await Project.findById(projectId).lean();
  if (!project) {
    throw new Error('Proyecto no encontrado.');
  }

  return (project.scenarios || []).map((item) => ({
    id: item._id.toString(),
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
  }));
}
