import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProjectViewResponse } from '../services/projectView.service.js';

test('buildProjectViewResponse returns safe arrays and project metadata from dedicated collections', async () => {
  const project = {
    _id: 'project-1',
    name: 'Demo',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    about: { intro: 'Intro', items: ['One'] },
    documents: undefined,
    locks: undefined,
    assistantConfig: undefined,
    securityCode: 'secret',
    projectHash: 'hash-1'
  };

  const response = await buildProjectViewResponse({
    project,
    user: { role: 'usuario' },
    projectRole: { role: 'usuario' },
    symbols: undefined,
    requirements: undefined,
    scenarios: undefined,
    tasks: undefined,
    inspections: undefined,
    resolveNotes: undefined
  });

  assert.equal(response.name, 'Demo');
  assert.deepEqual(response.symbols, []);
  assert.deepEqual(response.requirements, []);
  assert.deepEqual(response.scenarios, []);
  assert.deepEqual(response.tasks, []);
  assert.deepEqual(response.inspections, []);
  assert.deepEqual(response.resolveNotes, []);
  assert.deepEqual(response.documents, []);
  assert.deepEqual(response.locks, []);
  assert.deepEqual(response.about, { intro: 'Intro', items: ['One'] });
  assert.equal(response.embeddingStats.totalSymbols, 0);
  assert.equal(response.embeddingStats.totalRequirements, 0);
});
