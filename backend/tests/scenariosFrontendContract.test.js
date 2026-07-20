import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProjectViewResponse } from '../services/projectView.service.js';

test('buildProjectViewResponse preserves scenario _id for the frontend contract', async () => {
  const response = await buildProjectViewResponse({
    project: { _id: 'project-1', name: 'Demo', createdAt: new Date(), about: { intro: '', items: [] }, locks: [] },
    user: { role: 'usuario' },
    projectRole: { role: 'usuario' },
    scenarios: [{ _id: 'scenario-1', id: 'scenario-1', title: 'Escenario A', type: 'Escenario' }]
  });

  assert.deepEqual(response.scenarios[0]._id, 'scenario-1');
  assert.equal(response.scenarios[0].id, 'scenario-1');
});
