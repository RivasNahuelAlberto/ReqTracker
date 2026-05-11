import { getImpactGraph } from './tools/relations.tool.js';
import { expandImpact, reasonImpact } from './impact.service.js';
import { semanticSearch } from './tools/semantic.tool.js';

export async function analyzeImpact(req, res) {
  try {
    const { entityId, entityType, projectId } = req.body;

    if (!entityId || !entityType || !projectId) {
      return res.status(400).json({
        error: 'Faltan parámetros requeridos: entityId, entityType, projectId'
      });
    }

    // Obtener el grafo de relaciones
    const graph = await getImpactGraph({
      entityId,
      entityType,
      projectId
    });

    // Expandir el impacto recursivamente
    const expandedImpact = await expandImpact({
      entityId,
      entityType,
      projectId
    });

    // Obtener información de la entidad principal
    const entity = await semanticSearch({
      query: `entity ${entityId} ${entityType}`,
      projectId,
      limit: 1
    });

    // Analizar el impacto usando IA
    const analysis = await reasonImpact({
      entity: entity[0] || { type: entityType, id: entityId },
      graph: [...graph, ...expandedImpact],
      projectId
    });

    res.json({
      entityId,
      entityType,
      graph,
      expandedImpact,
      analysis
    });

  } catch (error) {
    console.error('Error in impact analysis:', error);
    res.status(500).json({
      error: 'Error interno del servidor al analizar impacto'
    });
  }
}