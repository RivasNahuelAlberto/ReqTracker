import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeToolArgs } from './tool-args-normalizer.js';

test('normalizes legacy findTransitiveDependencies args into the tool contract', async () => {
  const result = await normalizeToolArgs('findTransitiveDependencies', {
    node: 'Solicitud de Compra',
    depth: 3
  }, {
    projectId: 'proj-1',
    projectSnapshot: {
      symbols: [{ id: 'sym-1', name: 'Solicitud de Compra', type: 'process' }],
      requirements: []
    }
  });

  assert.equal(result.projectId, 'proj-1');
  assert.equal(result.symbolName, 'Solicitud de Compra');
  assert.equal(result.maxDepth, 3);
});

test('normalizes requirement-based analysis into requirementText', async () => {
  const result = await normalizeToolArgs('analyzeRequirement', {
    requirement: 'Solicitud de Compra'
  }, {
    projectId: 'proj-1',
    projectSnapshot: {
      symbols: [],
      requirements: [{ id: 'req-1', name: 'Solicitud de Compra', description: 'Requisito de compra' }]
    }
  });

  assert.equal(result.requirementText, 'Requisito de compra');
  assert.equal(result.projectId, 'proj-1');
});
