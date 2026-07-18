import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransitionScenarioEdit, mergeScenarioDraft } from './scenarioEditState.js';

test('canTransitionScenarioEdit returns false when no scenario id is present', () => {
  assert.equal(canTransitionScenarioEdit({ scenarioId: '', editMode: false }), false);
});

test('canTransitionScenarioEdit returns true for a valid transition', () => {
  assert.equal(canTransitionScenarioEdit({ scenarioId: 'scenario-1', editMode: false }), true);
});

test('mergeScenarioDraft preserves unsaved changes while keeping stable fields', () => {
  const draft = mergeScenarioDraft({
    baseScenario: { _id: 'scenario-1', title: 'A', type: 'Escenario', objective: 'old' },
    updates: { title: 'B', objective: 'new' }
  });

  assert.equal(draft.title, 'B');
  assert.equal(draft.objective, 'new');
  assert.equal(draft.type, 'Escenario');
});
