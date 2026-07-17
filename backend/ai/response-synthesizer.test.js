import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFinalResponseSummary } from './response-synthesizer.js';

test('buildFinalResponseSummary creates concise summaries for tool results', () => {
  const summary = buildFinalResponseSummary([
    {
      tool: 'findTransitiveDependencies',
      result: {
        success: true,
        analysis: { totalPaths: 3 },
        summary: { criticalPaths: 1, deepestPath: 2 },
        paths: [
          { path: 'Solicitud de Compra → Pago', criticality: '0.91' },
          { path: 'Solicitud de Compra → Aprobación', criticality: '0.74' }
        ]
      }
    },
    {
      tool: 'analyzeSytemicImpact',
      result: {
        success: true,
        sourceSymbol: 'Solicitud de Compra',
        riskLevel: 'HIGH',
        analysis: { symbolsAffected: 4 },
        impacts: [
          { symbol: 'Pago', totalImpact: 0.91 },
          { symbol: 'Aprobación', totalImpact: 0.78 }
        ]
      }
    }
  ]);

  assert.match(summary, /## Análisis Completado/);
  assert.match(summary, /Se encontraron 3 rutas de dependencia/);
  assert.match(summary, /Impacto sistémico HIGH/);
  assert.doesNotMatch(summary, /"success": true/);
});
