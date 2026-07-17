import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectRequirementsService } from '../services/projectRequirements.service.js';

test('create and list requirements through the decoupled service', async () => {
  const projects = new Map();
  const requirements = [];

  const ProjectModel = {
    async findById(id) {
      return projects.get(id) || null;
    },
    async findByIdAndUpdate(id, update) {
      const project = projects.get(id);
      if (!project) return null;
      Object.assign(project, update);
      return project;
    }
  };

  const RequirementModel = {
    async create(doc) {
      const created = { _id: `req-${requirements.length + 1}`, ...doc };
      requirements.push(created);
      return created;
    },
    find(query) {
      const items = requirements.filter((item) => item.project === query.project);
      return {
        sort() {
          return items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        }
      };
    },
    async findOne(query) {
      return requirements.find((item) => item._id === query._id && item.project === query.project) || null;
    },
    async findByIdAndUpdate(id, update) {
      const index = requirements.findIndex((item) => item._id === id);
      if (index === -1) return null;
      requirements[index] = { ...requirements[index], ...update };
      return requirements[index];
    },
    async deleteOne(query) {
      const index = requirements.findIndex((item) => item._id === query._id && item.project === query.project);
      if (index === -1) return { deletedCount: 0 };
      requirements.splice(index, 1);
      return { deletedCount: 1 };
    }
  };

  projects.set('project-1', {
    _id: 'project-1',
    requirements: []
  });

  const service = createProjectRequirementsService({ ProjectModel, RequirementModel });

  const created = await service.createRequirement('project-1', {
    identifier: 'REQ-001',
    name: 'Autenticación',
    description: 'El sistema debe autenticar usuarios',
    basis: 'Basado en el análisis de negocio',
    embedding: [0.1, 0.2, 0.3]
  });

  assert.equal(created.name, 'Autenticación');

  const listed = await service.getProjectRequirements('project-1');
  assert.equal(listed.length, 1);
  assert.equal(listed[0].name, 'Autenticación');
  assert.deepEqual(listed[0].embedding, [0.1, 0.2, 0.3]);

  const updated = await service.updateRequirement('project-1', created.id, { description: 'Nuevo detalle' });
  assert.equal(updated.description, 'Nuevo detalle');

  const deleted = await service.deleteRequirement('project-1', created.id);
  assert.equal(deleted.deleted, true);
});
