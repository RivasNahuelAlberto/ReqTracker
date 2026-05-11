import Project from '../models/Project.js';
import SymbolModel from '../models/Symbol.js';
import { analyzeImpact as analyzeImpactService } from './impact.service.js';

function findEntityById(items, entityId) {
  return (items || []).find((item) => item._id?.toString() === entityId.toString() || item.id?.toString() === entityId.toString() || item.identifier?.toString() === entityId.toString());
}

function buildEntitySummary(entityType, entity) {
  if (!entity) return { type: entityType, id: null, name: null, description: '' };

  const name = entity.name || entity.title || entity.identifier || `${entityType}-${entity._id || entity.id}`;
  let description = '';

  switch (entityType) {
    case 'scenario':
      description = [entity.objective, entity.preconditions, entity.actors, entity.episodes, entity.exceptions].filter(Boolean).join('\n');
      break;
    case 'requirement':
      description = [entity.description, entity.basis, entity.priority, entity.riesgo].filter(Boolean).join('\n');
      break;
    case 'inspection':
      description = [entity.aspect, entity.description, entity.targetLabel].filter(Boolean).join('\n');
      break;
    case 'task':
      description = [entity.description, entity.targetLabel].filter(Boolean).join('\n');
      break;
    case 'symbol':
    default:
      description = [entity.notion, entity.impact, entity.reviewNotes].filter(Boolean).join('\n');
      break;
  }

  return {
    type: entityType,
    id: entity._id?.toString() || entity.id?.toString() || null,
    name,
    description
  };
}

async function resolveEntity({ entityType, entityId, projectId }) {
  const project = await Project.findById(projectId).lean();
  if (!project) {
    throw new Error('Proyecto no encontrado.');
  }

  let entity = null;

  switch (entityType) {
    case 'symbol':
      entity = await SymbolModel.findOne({ _id: entityId, project: projectId }).lean();
      break;
    case 'scenario':
      entity = findEntityById(project.scenarios, entityId);
      break;
    case 'requirement':
      entity = findEntityById(project.requirements, entityId);
      break;
    case 'inspection':
      entity = findEntityById(project.inspections, entityId);
      break;
    case 'task':
      entity = findEntityById(project.tasks, entityId);
      break;
    default:
      throw new Error('Tipo de entidad no soportado para análisis de impacto.');
  }

  if (!entity) {
    throw new Error(`Entidad ${entityType} no encontrada en el proyecto.`);
  }

  return buildEntitySummary(entityType, entity);
}

export async function analyzeImpact(req, res) {
  try {
    const { entityId, entityType, projectId } = req.body;

    if (!entityId || !entityType || !projectId) {
      return res.status(400).json({
        error: 'Faltan parámetros requeridos: entityId, entityType, projectId'
      });
    }

    const entity = await resolveEntity({ entityType, entityId, projectId });

    const result = await analyzeImpactService({
      entityId,
      entityType,
      projectId,
      entity
    });

    res.json(result);
  } catch (error) {
    console.error('Error in impact analysis:', error);
    res.status(500).json({
      error: error.message || 'Error interno del servidor al analizar impacto'
    });
  }
}