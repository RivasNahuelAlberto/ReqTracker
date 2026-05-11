import { analyzeRequirementQuality } from './tools/quality.tool.js';
import { semanticSearch } from './tools/semantic.tool.js';

export async function analyzeRequirement(req, res) {
  try {
    const { requirementId, projectId } = req.body;

    if (!requirementId || !projectId) {
      return res.status(400).json({
        error: 'requirementId y projectId son requeridos'
      });
    }

    // Obtener el requisito (esto debería hacerse con el modelo, pero por simplicidad usamos placeholder)
    const requirement = {
      _id: requirementId,
      name: 'Requisito de ejemplo',
      description: 'Descripción del requisito',
      type: 'Funcional',
      priority: 'Alta',
      costoImplementacion: 'Medio',
      riesgo: 'Bajo'
    };

    // Obtener contexto semántico
    const contextResults = await semanticSearch({
      projectId,
      query: requirement.description
    });

    const context = contextResults.documentMatches || [];

    // Analizar calidad
    const analysis = await analyzeRequirementQuality({
      requirement,
      context
    });

    res.json({
      requirementId,
      analysis: analysis.analysis,
      qualityScore: analysis.qualityScore,
      issues: analysis.issues,
      suggestions: analysis.suggestions
    });

  } catch (error) {
    console.error('Error en análisis de calidad:', error);
    res.status(500).json({
      error: 'Error interno del servidor durante el análisis'
    });
  }
}