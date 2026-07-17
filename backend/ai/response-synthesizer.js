function normalizeString(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function summarizeDependencyAnalysis(result = {}) {
  const analysis = result.analysis || {};
  const paths = Array.isArray(result.paths) ? result.paths : [];
  const summary = result.summary || {};
  const lines = [];

  lines.push(`Se encontraron ${analysis.totalPaths ?? paths.length ?? 0} rutas de dependencia.`);
  lines.push(`Rutas críticas: ${summary.criticalPaths ?? 0}.`);
  lines.push(`Profundidad máxima: ${summary.deepestPath ?? 'n/a'}.`);

  const topPaths = paths.slice(0, 3);
  if (topPaths.length > 0) {
    lines.push('Rutas destacadas:');
    topPaths.forEach((path) => {
      const pathText = normalizeString(path.path);
      const criticality = path.criticality != null ? ` (criticidad ${path.criticality})` : '';
      if (pathText) {
        lines.push(`- ${pathText}${criticality}`);
      }
    });
  }

  return lines.join('\n');
}

function summarizeImpactAnalysis(result = {}) {
  const impacts = Array.isArray(result.impacts) ? result.impacts : [];
  const analysis = result.analysis || {};
  const source = normalizeString(result.sourceSymbol) || 'elemento';
  const lines = [];

  lines.push(`Impacto sistémico ${normalizeString(result.riskLevel) || 'detectado'} sobre "${source}".`);
  lines.push(`${analysis.symbolsAffected ?? impacts.length ?? 0} símbolos afectados.`);

  const topImpacts = impacts.slice(0, 3);
  if (topImpacts.length > 0) {
    lines.push('Principales afectaciones:');
    topImpacts.forEach((item) => {
      const symbol = normalizeString(item.symbol) || 'Sin nombre';
      const score = item.totalImpact != null ? ` (${item.totalImpact.toFixed(2)})` : '';
      lines.push(`- ${symbol}${score}`);
    });
  }

  return lines.join('\n');
}

function summarizeInconsistencyAnalysis(result = {}) {
  const analysis = result.analysis || {};
  const findings = Array.isArray(analysis.findings)
    ? analysis.findings
    : Array.isArray(analysis.issues)
      ? analysis.issues
      : [];
  const lines = [];

  const totalFindings = findings.length || analysis.totalFindings || analysis.count || 0;
  lines.push(`Se detectaron ${totalFindings} hallazgos de inconsistencia.`);

  const topFindings = findings.slice(0, 3);
  if (topFindings.length > 0) {
    lines.push('Hallazgos principales:');
    topFindings.forEach((finding) => {
      if (typeof finding === 'string') {
        lines.push(`- ${finding}`);
      } else {
        const message = normalizeString(finding.message || finding.title || finding.description || JSON.stringify(finding));
        if (message) {
          lines.push(`- ${message}`);
        }
      }
    });
  }

  return lines.join('\n');
}

function summarizeToolResult(toolName, result) {
  if (!result || typeof result !== 'object') {
    return 'No se devolvieron resultados detallados.';
  }

  if (result.success === false) {
    return `No se pudo completar el análisis. ${normalizeString(result.error) || 'Revisar logs del tool.'}`;
  }

  switch (toolName) {
    case 'findTransitiveDependencies':
      return summarizeDependencyAnalysis(result);
    case 'analyzeSytemicImpact':
      return summarizeImpactAnalysis(result);
    case 'analyzeInconsistencyRisk':
      return summarizeInconsistencyAnalysis(result);
    default:
      if (result.summary) {
        return typeof result.summary === 'string' ? result.summary : JSON.stringify(result.summary);
      }
      if (result.analysis) {
        return typeof result.analysis === 'string' ? result.analysis : JSON.stringify(result.analysis);
      }
      return 'El análisis se ejecutó correctamente.';
  }
}

function buildExecutiveSummary(toolResults = []) {
  const relevant = Array.isArray(toolResults) ? toolResults : [];
  const findings = [];

  relevant.forEach((toolResult) => {
    const result = toolResult?.result || {};
    if (result.success === false) {
      findings.push(`- ${toolResult.tool || 'Herramienta'} no pudo completarse.`);
      return;
    }

    if (toolResult?.tool === 'findTransitiveDependencies') {
      const totalPaths = result?.analysis?.totalPaths ?? 0;
      findings.push(`- Se detectaron ${totalPaths} rutas de dependencia relevantes.`);
    }

    if (toolResult?.tool === 'analyzeSytemicImpact') {
      const affected = result?.analysis?.symbolsAffected ?? 0;
      const risk = normalizeString(result?.riskLevel) || 'bajo';
      findings.push(`- El impacto sistémico es ${risk.toLowerCase()} y afecta a ${affected} símbolos.`);
    }

    if (toolResult?.tool === 'analyzeInconsistencyRisk') {
      const count = result?.analysis?.findings?.length || result?.analysis?.issues?.length || 0;
      findings.push(`- Se identificaron ${count} posibles inconsistencias.`);
    }
  });

  if (findings.length === 0) {
    findings.push('- No se detectaron hallazgos adicionales.');
  }

  return [
    '### Resumen ejecutivo',
    'El análisis revela los puntos más sensibles del proyecto y las áreas que conviene revisar con prioridad.',
    ...findings,
    '',
    '### Acciones recomendadas',
    '- Priorizar la revisión de los nodos con mayor impacto en el grafo.',
    '- Validar las rutas críticas antes de aplicar cambios.',
    '- Confirmar los hallazgos de inconsistencia con el equipo responsable.'
  ].join('\n');
}

export function buildFinalResponseSummary(toolResults = []) {
  if (!Array.isArray(toolResults) || toolResults.length === 0) {
    return '## Análisis Completado\n\nNo se ejecutaron herramientas de análisis.';
  }

  const sections = ['## Análisis Completado', '', buildExecutiveSummary(toolResults), ''];

  toolResults.forEach((toolResult) => {
    const title = normalizeString(toolResult.tool) || 'Herramienta';
    const summary = summarizeToolResult(title, toolResult.result);

    sections.push(`### ${title}`);
    sections.push(summary);
    sections.push('');
  });

  return sections.join('\n').trim();
}

export default {
  buildFinalResponseSummary,
  summarizeToolResult
};
