import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectInspectionsService } from '../services/projectInspections.service.js';

test('create and list inspections through the decoupled service', async () => {
  const projects = new Map();
  const inspections = [];

  const ProjectModel = {
    async findById(id) {
      return projects.get(id) || null;
    }
  };

  const InspectionModel = {
    async create(doc) {
      const created = { _id: `inspection-${inspections.length + 1}`, ...doc };
      inspections.push(created);
      return created;
    },
    find(query) {
      const items = inspections.filter((item) => item.project === query.project);
      return {
        sort() {
          return items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        }
      };
    },
    async findOne(query) {
      return inspections.find((item) => item._id === query._id && item.project === query.project) || null;
    },
    async findByIdAndUpdate(id, update) {
      const index = inspections.findIndex((item) => item._id === id);
      if (index === -1) return null;
      inspections[index] = { ...inspections[index], ...update };
      return inspections[index];
    },
    async deleteOne(query) {
      const index = inspections.findIndex((item) => item._id === query._id && item.project === query.project);
      if (index === -1) return { deletedCount: 0 };
      inspections.splice(index, 1);
      return { deletedCount: 1 };
    }
  };

  projects.set('project-1', {
    _id: 'project-1',
    inspections: []
  });

  const service = createProjectInspectionsService({ ProjectModel, InspectionModel });

  const created = await service.createInspection('project-1', {
    targetType: 'scenario',
    targetId: 'scenario-1',
    targetLabel: 'Escenario A',
    aspect: 'Flujo',
    description: 'Validar el flujo principal'
  });

  assert.equal(created.aspect, 'Flujo');

  const listed = await service.getProjectInspections('project-1');
  assert.equal(listed.length, 1);
  assert.equal(listed[0].aspect, 'Flujo');

  const updated = await service.updateInspection('project-1', created.id, { description: 'Flujo ajustado' });
  assert.equal(updated.description, 'Flujo ajustado');

  const deleted = await service.deleteInspection('project-1', created.id);
  assert.equal(deleted.deleted, true);
});