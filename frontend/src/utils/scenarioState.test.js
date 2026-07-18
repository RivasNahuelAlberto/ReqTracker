import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeScenario, resolveScenarioSelection } from './scenarioState.js';

test('normalizeScenario preserves both _id and id for compatibility', () => {
  const normalized = normalizeScenario({ id: 'scenario-42', title: 'Escenario A' });

  assert.equal(normalized._id, 'scenario-42');
  assert.equal(normalized.id, 'scenario-42');
  assert.equal(normalized.title, 'Escenario A');
});

test('resolveScenarioSelection preserves the active scenario when it still exists', () => {
  const scenarios = [
    normalizeScenario({ id: 'scenario-1', title: 'Uno' }),
    normalizeScenario({ id: 'scenario-2', title: 'Dos' })
  ];

  const selection = resolveScenarioSelection({
    scenarios,
    selectedScenario: { _id: 'scenario-2', id: 'scenario-2', title: 'Dos' },
    selectedScenarioId: 'scenario-2'
  });

  assert.equal(selection.selectedScenarioId, 'scenario-2');
  assert.equal(selection.selectedScenario.title, 'Dos');
});

test('resolveScenarioSelection falls back to the first available scenario when the current one is gone', () => {
  const scenarios = [
    normalizeScenario({ id: 'scenario-1', title: 'Uno' }),
    normalizeScenario({ id: 'scenario-2', title: 'Dos' })
  ];

  const selection = resolveScenarioSelection({
    scenarios,
    selectedScenario: { _id: 'scenario-9', id: 'scenario-9', title: 'No existe' },
    selectedScenarioId: 'scenario-9'
  });

  assert.equal(selection.selectedScenarioId, 'scenario-1');
  assert.equal(selection.selectedScenario.title, 'Uno');
});
