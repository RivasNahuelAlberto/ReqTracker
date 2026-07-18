import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectScenariosService } from '../services/projectScenarios.service.js';

test('create and list scenarios through the decoupled service', async () => {
  const projects = new Map();
  const scenarios = [];

  const ProjectModel = {
    async findById(id) {
      return projects.get(id) || null;
    }
  };

  const ScenarioModel = {
    async create(doc) {
      const created = { _id: `scenario-${scenarios.length + 1}`, ...doc };
      scenarios.push(created);
      return created;
    },
    find(query) {
      const items = scenarios.filter((item) => item.project === query.project);
      return {
        sort() {
          return items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        }
      };
    },
    async findOne(query) {
      return scenarios.find((item) => item._id === query._id && item.project === query.project) || null;
    },
    async findByIdAndUpdate(id, update) {
      const index = scenarios.findIndex((item) => item._id === id);
      if (index === -1) return null;
      scenarios[index] = { ...scenarios[index], ...update };
      return scenarios[index];
    },
    async deleteOne(query) {
      const index = scenarios.findIndex((item) => item._id === query._id && item.project === query.project);
      if (index === -1) return { deletedCount: 0 };
      scenarios.splice(index, 1);
      return { deletedCount: 1 };
    }
  };

  projects.set('project-1', {
    _id: 'project-1'
  });

  const service = createProjectScenariosService({ ProjectModel, ScenarioModel });

  const created = await service.createScenario('project-1', {
    type: 'Flujo principal',
    title: 'Inicio del proceso',
    objective: 'Validar que el usuario pueda iniciar',
    actors: 'Usuario'
  });

  assert.equal(created.title, 'Inicio del proceso');
  assert.equal(created._id, 'scenario-1');
  assert.equal(created.id, 'scenario-1');

  const listed = await service.getProjectScenarios('project-1');
  assert.equal(listed.length, 1);
  assert.equal(listed[0].title, 'Inicio del proceso');

  const updated = await service.updateScenario('project-1', created.id, { objective: 'Validar el flujo' });
  assert.equal(updated.objective, 'Validar el flujo');

  const deleted = await service.deleteScenario('project-1', created.id);
  assert.equal(deleted.deleted, true);
});
