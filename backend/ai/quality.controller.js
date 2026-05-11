import { analyzeRequirement as analyzeRequirementTool } from './tools/quality.tool.js';

export async function analyzeRequirement(req, res) {
  try {
    const { requirementId, projectId } = req.body;

    if (!requirementId || !projectId) {
      return res.status(400).json({
        error: 'requirementId y projectId son requeridos'
      });
    }

    const result = await analyzeRequirementTool({ requirementId, projectId });

    res.json(result);

  } catch (error) {
    console.error('Error en análisis de calidad:', error);
    res.status(500).json({
      error: error.message || 'Error interno del servidor durante el análisis'
    });
  }
}