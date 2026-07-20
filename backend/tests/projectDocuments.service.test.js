import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectDocumentsService } from '../services/projectDocuments.service.js';

test('create and list documents through the decoupled service', async () => {
  const projects = new Map();
  const documents = [];

  const ProjectModel = {
    async findById(id) {
      return projects.get(id) || null;
    }
  };

  const DocumentModel = {
    async create(doc) {
      const created = { _id: `doc-${documents.length + 1}`, ...doc };
      documents.push(created);
      return created;
    },
    find(query) {
      const items = documents.filter((item) => item.project === query.project);
      return {
        sort() {
          return items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        }
      };
    },
    async findOne(query) {
      return documents.find((item) => item._id === query._id && item.project === query.project) || null;
    },
    async findByIdAndUpdate(id, update) {
      const index = documents.findIndex((item) => item._id === id);
      if (index === -1) return null;
      documents[index] = { ...documents[index], ...update };
      return documents[index];
    },
    async deleteOne(query) {
      const index = documents.findIndex((item) => item._id === query._id && item.project === query.project);
      if (index === -1) return { deletedCount: 0 };
      documents.splice(index, 1);
      return { deletedCount: 1 };
    }
  };

  projects.set('project-1', { _id: 'project-1' });

  const service = createProjectDocumentsService({ ProjectModel, DocumentModel });

  const created = await service.createDocument('project-1', {
    name: 'Especificación',
    type: 'texto',
    description: 'Contenido',
    fileName: 'spec.txt',
    extension: 'txt',
    content: 'Contenido',
    embedding: [0.1, 0.2]
  });

  assert.equal(created.name, 'Especificación');
  assert.equal(created.id, 'doc-1');

  const listed = await service.getProjectDocuments('project-1');
  assert.equal(listed.length, 1);
  assert.equal(listed[0].name, 'Especificación');

  const updated = await service.updateDocument('project-1', created.id, { description: 'Nuevo contenido' });
  assert.equal(updated.description, 'Nuevo contenido');

  const deleted = await service.deleteDocument('project-1', created.id);
  assert.equal(deleted.deleted, true);
});
