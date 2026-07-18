import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectRequirementsService } from '../services/projectRequirements.service.js';
import { createProjectTasksService } from '../services/projectTasks.service.js';
import { createProjectInspectionsService } from '../services/projectInspections.service.js';

test('requirements service returns a normalized payload even when payload is missing', async () => {
  const RequirementModel = {
    create: async (payload) => ({
      _id: 'req-1',
      identifier: payload.identifier || '',
      name: payload.name || 'Sin nombre',
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
      embedding: Array.isArray(payload.embedding) ? payload.embedding : []
    })
  };
  const ProjectModel = {
    findById: async () => ({ _id: 'project-1' })
  };

  const service = createProjectRequirementsService({ ProjectModel, RequirementModel });
  const result = await service.createRequirement('project-1', undefined);

  assert.equal(result._id, 'req-1');
  assert.equal(result.id, 'req-1');
  assert.equal(result.name, 'Sin nombre');
  assert.deepEqual(result.embedding, []);
});

test('tasks service returns a normalized payload and defaults for invalid values', async () => {
  const TaskModel = {
    create: async (payload) => ({
      _id: 'task-1',
      number: payload.number || 1,
      priority: payload.priority || 3,
      description: payload.description || '',
      targetType: payload.targetType || 'scenario',
      targetId: payload.targetId || '',
      targetLabel: payload.targetLabel || '',
      createdAt: new Date('2024-01-01T00:00:00.000Z')
    }),
    find: () => ({ sort: () => [] })
  };
  const ProjectModel = {
    findById: async () => ({ _id: 'project-1' })
  };

  const service = createProjectTasksService({ ProjectModel, TaskModel });
  const result = await service.createTask('project-1', { priority: 'invalid' });

  assert.equal(result._id, 'task-1');
  assert.equal(result.id, 'task-1');
  assert.equal(result.priority, 3);
  assert.equal(result.description, '');
});

test('inspections service returns a normalized payload and safe defaults', async () => {
  const InspectionModel = {
    create: async (payload) => ({
      _id: 'inspection-1',
      targetType: payload.targetType || 'symbol',
      targetId: payload.targetId || '',
      targetLabel: payload.targetLabel || '',
      aspect: payload.aspect || '',
      description: payload.description || '',
      createdAt: new Date('2024-01-01T00:00:00.000Z')
    })
  };
  const ProjectModel = {
    findById: async () => ({ _id: 'project-1' })
  };

  const service = createProjectInspectionsService({ ProjectModel, InspectionModel });
  const result = await service.createInspection('project-1', {});

  assert.equal(result._id, 'inspection-1');
  assert.equal(result.id, 'inspection-1');
  assert.equal(result.targetType, 'symbol');
  assert.equal(result.description, '');
});
