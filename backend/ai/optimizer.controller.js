import { optimizeProject } from './optimizer.service.js';

export async function analyzeOptimization(req, res) {
  try {
    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({
        error: 'projectId es requerido'
      });
    }

    const result = await optimizeProject({ projectId });
    res.json(result);
  } catch (error) {
    console.error('Error en optimización de proyecto:', error);
    res.status(500).json({
      error: error.message || 'Error interno del servidor durante la optimización'
    });
  }
}
