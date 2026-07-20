import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFinalResponseSummary, buildProjectAwareSynthesisPrompt } from './response-synthesizer.js';

test('buildProjectAwareSynthesisPrompt includes the original query and project context', () => {
  const prompt = buildProjectAwareSynthesisPrompt({
    originalMessage: 'Considerando el proyecto completo: identificá las 3 decisiones de modelado más riesgosas',
    contextPack: {
      summary: 'El proyecto modela compras, proveedores y aprobaciones.',
      nodes: [{ id: 's1', label: 'Solicitud de Compra' }],
      relations: [{ from: 's1', to: 'Proveedor' }]
    },
    snapshot: {
      counts: { symbols: 12, requirements: 8, scenarios: 3 }
    },
    toolResults: [{ tool: 'findTransitiveDependencies', result: { success: true, analysis: { totalPaths: 3 } } }]
  });

  assert.match(prompt, /Considerando el proyecto completo/);
  assert.match(prompt, /El proyecto modela compras, proveedores y aprobaciones/);
  assert.match(prompt, /3 decisiones de modelado más riesgosas/);
  assert.match(prompt, /No repitas respuestas genéricas/);
});

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
  assert.match(summary, /Resumen ejecutivo/);
  assert.match(summary, /Acciones recomendadas/);
  assert.match(summary, /Se encontraron 3 rutas de dependencia/);
  assert.match(summary, /Impacto sistémico HIGH/);
  assert.match(summary, /Priorizar/);
  assert.doesNotMatch(summary, /"success": true/);
});
