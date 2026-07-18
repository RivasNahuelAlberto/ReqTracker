import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectTasksService } from '../services/projectTasks.service.js';

test('create and list tasks through the decoupled service', async () => {
  const projects = new Map();
  const tasks = [];

  const ProjectModel = {
    async findById(id) {
      return projects.get(id) || null;
    }
  };

  const TaskModel = {
    async create(doc) {
      const created = { _id: `task-${tasks.length + 1}`, ...doc };
      tasks.push(created);
      return created;
    },
    find(query) {
      const orConditions = Array.isArray(query?.$or) ? query.$or : [];
      const items = tasks.filter((item) => {
        if (orConditions.length > 0) {
          return orConditions.some((condition) => (condition.projectId !== undefined ? item.projectId === condition.projectId : item.project === condition.project));
        }
        return item.projectId === query?.projectId || item.project === query?.project;
      });
      return {
        sort() {
          return items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        }
      };
    },
    async findOne(query) {
      const orConditions = Array.isArray(query?.$or) ? query.$or : [];
      return tasks.find((item) => item._id === query._id && (
        orConditions.length > 0
          ? orConditions.some((condition) => (condition.projectId !== undefined ? item.projectId === condition.projectId : item.project === condition.project))
          : item.projectId === query.projectId || item.project === query.project
      )) || null;
    },
    async findByIdAndUpdate(id, update) {
      const index = tasks.findIndex((item) => item._id === id);
      if (index === -1) return null;
      tasks[index] = { ...tasks[index], ...update };
      return tasks[index];
    },
    async deleteOne(query) {
      const orConditions = Array.isArray(query?.$or) ? query.$or : [];
      const index = tasks.findIndex((item) => item._id === query._id && (
        orConditions.length > 0
          ? orConditions.some((condition) => (condition.projectId !== undefined ? item.projectId === condition.projectId : item.project === condition.project))
          : item.projectId === query.projectId || item.project === query.project
      ));
      if (index === -1) return { deletedCount: 0 };
      tasks.splice(index, 1);
      return { deletedCount: 1 };
    }
  };

  projects.set('project-1', {
    _id: 'project-1',
    tasks: []
  });

  const service = createProjectTasksService({ ProjectModel, TaskModel });

  const created = await service.createTask('project-1', {
    description: 'Preparar la revisión',
    targetType: 'scenario',
    targetId: 'scenario-1',
    targetLabel: 'Escenario A'
  });

  assert.equal(created.description, 'Preparar la revisión');

  const listed = await service.getProjectTasks('project-1');
  assert.equal(listed.length, 1);
  assert.equal(listed[0].description, 'Preparar la revisión');

  const updated = await service.updateTask('project-1', created.id, { description: 'Revisión ajustada' });
  assert.equal(updated.description, 'Revisión ajustada');

  const deleted = await service.deleteTask('project-1', created.id);
  assert.equal(deleted.deleted, true);
});

test('createTask normalizes payload for the required schema fields', async () => {
  const projects = new Map();
  const tasks = [];

  const ProjectModel = {
    async findById(id) {
      return projects.get(id) || null;
    }
  };

  const TaskModel = {
    async create(doc) {
      const created = { _id: `task-${tasks.length + 1}`, ...doc };
      tasks.push(created);
      return created;
    },
    find(query) {
      const orConditions = Array.isArray(query?.$or) ? query.$or : [];
      const items = tasks.filter((item) => {
        if (orConditions.length > 0) {
          return orConditions.some((condition) => (condition.projectId !== undefined ? item.projectId === condition.projectId : item.project === condition.project));
        }
        return item.projectId === query?.projectId || item.project === query?.project;
      });
      return {
        sort() {
          return items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        }
      };
    },
    async findOne(query) {
      const orConditions = Array.isArray(query?.$or) ? query.$or : [];
      return tasks.find((item) => item._id === query._id && (
        orConditions.length > 0
          ? orConditions.some((condition) => (condition.projectId !== undefined ? item.projectId === condition.projectId : item.project === condition.project))
          : item.projectId === query.projectId || item.project === query.project
      )) || null;
    },
    async findByIdAndUpdate() {
      return null;
    },
    async deleteOne() {
      return { deletedCount: 0 };
    }
  };

  projects.set('project-2', {
    _id: 'project-2',
    tasks: []
  });

  const service = createProjectTasksService({ ProjectModel, TaskModel });
  const created = await service.createTask('project-2', {
    description: 'Revisar riesgos',
    priority: 2,
    targetType: 'symbol',
    targetId: 'symbol-7',
    targetLabel: 'Símbolo X'
  });

  assert.equal(created.description, 'Revisar riesgos');
  assert.equal(created.priority, 2);
  assert.equal(created.targetType, 'symbol');
  assert.equal(created.targetId, 'symbol-7');
  assert.equal(created.targetLabel, 'Símbolo X');
});