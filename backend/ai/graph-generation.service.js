import Project from '../models/Project.js';
import SymbolModel from '../models/Symbol.js';
import Requirement from '../models/Requirement.js';
import Relation from '../models/Relation.js';
import { createProjectRequirementsService } from '../services/projectRequirements.service.js';
import { createProjectScenariosService } from '../services/projectScenarios.service.js';
import { createProjectTasksService } from '../services/projectTasks.service.js';
import { createProjectInspectionsService } from '../services/projectInspections.service.js';

const requirementsService = createProjectRequirementsService({
  ProjectModel: Project,
  RequirementModel: Requirement
});
const scenariosService = createProjectScenariosService({
  ProjectModel: Project,
  ScenarioModel: (await import('../models/Scenario.js')).default
});
const tasksService = createProjectTasksService({
  ProjectModel: Project,
  TaskModel: (await import('../models/Task.js')).default
});
const inspectionsService = createProjectInspectionsService({
  ProjectModel: Project,
  InspectionModel: (await import('../models/Inspection.js')).default
});

const SIMILARITY_THRESHOLD = 0.65;
const RELATION_TYPES = ['depends_on', 'implements', 'related_to', 'references', 'affects'];

function cosineSimilarity(vecA, vecB) {
  if (!vecA?.length || !vecB?.length || vecA.length !== vecB.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

function inferRelationType(fromType, toType, similarity) {
  if (fromType === 'requirement' && toType === 'requirement') {
    return similarity > 0.8 ? 'depends_on' : 'related_to';
  }
  if (fromType === 'symbol' && toType === 'requirement') {
    return 'implements';
  }
  if (fromType === 'requirement' && toType === 'symbol') {
    return 'references';
  }
  if (fromType === 'scenario' && toType === 'requirement') {
    return 'related_to';
  }
  return 'related_to';
}

function inferStrength(similarity) {
  return Math.min(10, Math.max(1, Math.round(similarity * 10)));
}

export async function generateProjectRelations({ projectId, threshold = SIMILARITY_THRESHOLD }) {
  try {
    const project = await Project.findById(projectId).lean();
    if (!project) {
      throw new Error('Proyecto no encontrado.');
    }

    const symbols = await SymbolModel.find({ project: projectId }).lean();
    const requirements = await requirementsService.getProjectRequirements(projectId);
    const scenarios = await scenariosService.getProjectScenarios(projectId);
    const tasks = await tasksService.getProjectTasks(projectId);
    const inspections = await inspectionsService.getProjectInspections(projectId);

    // Coleccionar entidades con embeddings
    const entities = [];

    for (const symbol of symbols) {
      if (symbol.embedding?.length > 0) {
        entities.push({
          id: symbol._id,
          type: 'symbol',
          name: symbol.name,
          embedding: symbol.embedding,
          isSeed: symbol.isSeed
        });
      }
    }

    for (const req of requirements) {
      if (req.embedding?.length > 0) {
        entities.push({
          id: req.id,
          type: 'requirement',
          name: req.name,
          embedding: req.embedding
        });
      }
    }

    for (const scenario of scenarios) {
      entities.push({
        id: scenario.id,
        type: 'scenario',
        name: scenario.title,
        embedding: [] // Scenarios sin embeddings por ahora
      });
    }

    for (const task of tasks) {
      entities.push({
        id: task.id,
        type: 'task',
        name: task.description,
        embedding: []
      });
    }

    for (const inspection of inspections) {
      entities.push({
        id: inspection.id,
        type: 'inspection',
        name: inspection.aspect,
        embedding: []
      });
    }

    // Detectar relaciones por similitud
    const potentialRelations = [];
    const existingRelations = await Relation.find({ projectId }).lean();
    const existingPairs = new Set(
      existingRelations.map((r) => `${r.fromType}:${r.fromId}:${r.toType}:${r.toId}`)
    );

    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const entityA = entities[i];
        const entityB = entities[j];

        // Saltar si ya existe relación
        const pairAB = `${entityA.type}:${entityA.id}:${entityB.type}:${entityB.id}`;
        const pairBA = `${entityB.type}:${entityB.id}:${entityA.type}:${entityA.id}`;
        if (existingPairs.has(pairAB) || existingPairs.has(pairBA)) {
          continue;
        }

        // Si no hay embeddings, saltar
        if (!entityA.embedding?.length || !entityB.embedding?.length) {
          continue;
        }

        const similarity = cosineSimilarity(entityA.embedding, entityB.embedding);

        if (similarity >= threshold) {
          const relationType = inferRelationType(entityA.type, entityB.type, similarity);
          const strength = inferStrength(similarity);

          potentialRelations.push({
            fromType: entityA.type,
            fromId: entityA.id,
            toType: entityB.type,
            toId: entityB.id,
            type: relationType,
            strength,
            similarity,
            confidence: similarity
          });
        }
      }
    }

    // Crear las relaciones en BD
    const createdRelations = [];
    for (const potentialRel of potentialRelations) {
      try {
        const created = await Relation.create({
          fromType: potentialRel.fromType,
          fromId: potentialRel.fromId,
          toType: potentialRel.toType,
          toId: potentialRel.toId,
          type: potentialRel.type,
          projectId,
          strength: potentialRel.strength
        });
        createdRelations.push({
          id: created._id.toString(),
          ...potentialRel
        });
      } catch (error) {
        console.error('Error creating relation:', error);
      }
    }

    return {
      projectId,
      potentialRelations: potentialRelations.length,
      createdRelations: createdRelations.length,
      relations: createdRelations
    };
  } catch (error) {
    console.error('Error generating project relations:', error);
    throw error;
  }
}

export async function suggestRelationsForEntity({ projectId, entityId, entityType, threshold = SIMILARITY_THRESHOLD }) {
  try {
    const entity = await getEntity(projectId, entityId, entityType);
    if (!entity) {
      throw new Error('Entidad no encontrada.');
    }

    if (!entity.embedding?.length) {
      return {
        entityId,
        entityType,
        suggestions: []
      };
    }

    // Obtener todas las otras entidades del proyecto
    const allEntities = [];

    const symbols = await SymbolModel.find({ project: projectId, _id: { $ne: entityId } }).lean();
    for (const symbol of symbols) {
      if (symbol.embedding?.length > 0) {
        allEntities.push({
          id: symbol._id,
          type: 'symbol',
          name: symbol.name,
          embedding: symbol.embedding
        });
      }
    }

    const requirements = await requirementsService.getProjectRequirements(projectId);
    for (const req of requirements) {
      if (req.id !== entityId && req.embedding?.length > 0) {
        allEntities.push({
          id: req.id,
          type: 'requirement',
          name: req.name,
          embedding: req.embedding
        });
      }
    }

    // Calcular similitud con cada entidad
    const suggestions = [];
    const existingRelations = await Relation.find({
      projectId,
      $or: [
        { fromId: entityId, fromType: entityType },
        { toId: entityId, toType: entityType }
      ]
    }).lean();

    const existingIds = new Set(
      existingRelations.flatMap((r) => [
        `${r.fromType}:${r.fromId}`,
        `${r.toType}:${r.toId}`
      ])
    );

    for (const otherEntity of allEntities) {
      const key = `${otherEntity.type}:${otherEntity.id}`;
      if (existingIds.has(key)) {
        continue;
      }

      const similarity = cosineSimilarity(entity.embedding, otherEntity.embedding);

      if (similarity >= threshold) {
        const relationType = inferRelationType(entityType, otherEntity.type, similarity);
        const strength = inferStrength(similarity);

        suggestions.push({
          targetId: otherEntity.id.toString(),
          targetType: otherEntity.type,
          targetName: otherEntity.name,
          suggestedType: relationType,
          strength,
          similarity,
          confidence: similarity
        });
      }
    }

    return {
      entityId,
      entityType,
      suggestions: suggestions.sort((a, b) => b.similarity - a.similarity)
    };
  } catch (error) {
    console.error('Error suggesting relations:', error);
    throw error;
  }
}

async function getEntity(projectId, entityId, entityType) {
  if (entityType === 'symbol') {
    return SymbolModel.findOne({ _id: entityId, project: projectId }).lean();
  }

  const project = await Project.findById(projectId).lean();
  if (!project) return null;

  switch (entityType) {
    case 'requirement':
      return Requirement.findOne({ _id: entityId, project: projectId }).lean();
    case 'scenario': {
      const scenarios = await scenariosService.getProjectScenarios(projectId);
      return scenarios.find((s) => s.id?.toString() === entityId.toString());
    }
    case 'inspection': {
      const inspections = await inspectionsService.getProjectInspections(projectId);
      return inspections.find((i) => i.id?.toString() === entityId.toString());
    }
    case 'task': {
      const tasks = await tasksService.getProjectTasks(projectId);
      return tasks.find((t) => t.id?.toString() === entityId.toString());
    }
    default:
      return null;
  }
}
