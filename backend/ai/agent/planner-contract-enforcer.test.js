import test from 'node:test';
import assert from 'node:assert/strict';
import { enforceAndNormalizePlan } from './planner-contract-enforcer.js';

test('normalizes legacy planner output with EXECUTE mode and missing metadata', async () => {
  const rawPlan = JSON.stringify({
    mode: 'EXECUTE',
    reasoning: 'Need graph analysis',
    confidence: 0.92,
    plan: [
      {
        tool: 'findTransitiveDependencies',
        description: 'Find transitive dependencies',
        args: {
          projectId: 'proj-1',
          symbolName: 'Solicitud de Compra',
          maxDepth: 3
        }
      }
    ]
  });

  const result = await enforceAndNormalizePlan(rawPlan, {
    projectId: 'proj-1',
    goal: 'Analizá el impacto de eliminar Solicitud de Compra',
    contextSize: {
      symbolsCount: 10,
      relationsCount: 20,
      requirementsCount: 3
    }
  });

  assert.equal(result.mode, 'tools');
  assert.equal(result.steps.length, 1);
  assert.equal(result.steps[0].tool, 'findTransitiveDependencies');
  assert.equal(result.metadata.inputGoal, 'Analizá el impacto de eliminar Solicitud de Compra');
  assert.ok(result.metadata.planGeneratedAt);
  assert.ok(result.metadata.contextSize);
});
