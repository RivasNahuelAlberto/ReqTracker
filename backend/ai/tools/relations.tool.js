import Relation from '../../models/Relation.js';
import Project from '../../models/Project.js';
import SymbolModel from '../../models/Symbol.js';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\()]/g, '\\$&');
}

function normalizeId(value) {
  if (!value) return null;
  return value.toString();
}

function resolveNode(project, nodeType, nodeId) {
  const idString = normalizeId(nodeId);
  if (!idString) return null;

  if (nodeType === 'symbol') {
    return SymbolModel.findOne({ _id: nodeId, project: project._id }).lean();
  }

  const collectionMap = {
    requirement: project.requirements || [],
    scenario: project.scenarios || [],
    inspection: project.inspections || [],
    task: project.tasks || []
  };

  const collection = collectionMap[nodeType] || [];
  return collection.find((item) => {
    return item._id?.toString() === idString || item.id?.toString() === idString || item.identifier?.toString() === idString;
  });
}

async function findSymbolByName(projectId, name) {
  if (!name || !projectId) return null;
  const search = new RegExp(`^${escapeRegExp(name.trim())}$`, 'i');
  return SymbolModel.findOne({ project: projectId, name: search }).lean();
}

function findItemByName(items = [], name) {
  const searchExact = new RegExp(`^${escapeRegExp(name.trim())}$`, 'i');
  const searchContains = new RegExp(escapeRegExp(name.trim()), 'i');
  return items.find((item) => {
    const title = item.name || item.title || item.identifier || item.targetLabel || '';
    return title && (searchExact.test(title) || searchContains.test(title));
  });
}

export async function findEntityByName({ projectId, entityType, name }) {
  if (!projectId || !name) {
    throw new Error('projectId y name son requeridos para encontrar la entidad.');
  }

  const project = await Project.findById(projectId).lean();
  if (!project) {
    throw new Error('Proyecto no encontrado.');
  }

  const normalizedType = (entityType || '').toString().trim().toLowerCase();
  let entity = null;
  let resolvedType = normalizedType;

  if (!normalizedType || normalizedType === 'symbol') {
    entity = await findSymbolByName(projectId, name);
    if (entity) {
      resolvedType = 'symbol';
    }
  }

  if (!entity && (!normalizedType || normalizedType === 'requirement')) {
    entity = findItemByName(project.requirements, name);
    resolvedType = 'requirement';
  }

  if (!entity && (!normalizedType || normalizedType === 'scenario')) {
    entity = findItemByName(project.scenarios, name);
    resolvedType = 'scenario';
  }

  if (!entity && (!normalizedType || normalizedType === 'inspection')) {
    entity = findItemByName(project.inspections, name);
    resolvedType = 'inspection';
  }

  if (!entity && (!normalizedType || normalizedType === 'task')) {
    entity = findItemByName(project.tasks, name);
    resolvedType = 'task';
  }

  if (!entity) {
    throw new Error(`No se encontró la entidad '${name}' en el proyecto.`);
  }

  const id = entity._id?.toString() || entity.id?.toString() || null;
  const title = entity.name || entity.title || entity.identifier || entity.targetLabel || name;
  const description = entity.notion || entity.impact || entity.description || entity.objective || '';

  return {
    entityId: id,
    entityType: resolvedType,
    name: title,
    description
  };
}

export async function getEntityGraph({ projectId, entityType, entityId, entityName }) {
  if (!projectId) {
    throw new Error('projectId es requerido para obtener el grafo de entidad.');
  }

  if (!entityId && entityName) {
    const resolved = await findEntityByName({ projectId, entityType, name: entityName });
    entityId = resolved.entityId;
    entityType = resolved.entityType;
  }

  if (!entityId || !entityType) {
    throw new Error('entityId o entityType son requeridos para obtener el grafo de entidad.');
  }

  const relations = await getImpactGraph({ projectId, entityId, entityType });
  return {
    projectId,
    entityId,
    entityType,
    relations
  };
}

export async function getImpactGraph({
  entityId,
  entityType,
  projectId
}) {
  try {
    const relations = await Relation.find({
      projectId,
      $or: [
        { fromId: entityId, fromType: entityType },
        { toId: entityId, toType: entityType }
      ]
    }).lean();

    return relations.map(rel => ({
      id: rel._id.toString(),
      fromType: rel.fromType,
      fromId: rel.fromId.toString(),
      toType: rel.toType,
      toId: rel.toId.toString(),
      type: rel.type,
      strength: rel.strength
    }));
  } catch (error) {
    console.error('Error getting impact graph:', error);
    return [];
  }
}

export async function getProjectGraph({ projectId }) {
  try {
    const project = await Project.findById(projectId).lean();
    if (!project) {
      throw new Error('Proyecto no encontrado para grafo.');
    }

    const relations = await Relation.find({ projectId }).lean();

    const symbolIds = relations.reduce((acc, rel) => {
      acc.add(rel.fromId.toString());
      acc.add(rel.toId.toString());
      return acc;
    }, new Set());

    const symbols = await SymbolModel.find({ _id: { $in: [...symbolIds] }, project: projectId }).lean();

    const nodes = [];
    const seen = new Set();

    function addNode(nodeType, nodeId, name, description) {
      const key = `${nodeType}:${nodeId}`;
      if (seen.has(key)) return;
      seen.add(key);
      nodes.push({
        id: nodeId.toString(),
        type: nodeType,
        name: name || `${nodeType}-${nodeId}`,
        description: description || ''
      });
    }

    for (const relation of relations) {
      const fromNode = await resolveNode(project, relation.fromType, relation.fromId);
      const toNode = await resolveNode(project, relation.toType, relation.toId);

      addNode(
        relation.fromType,
        relation.fromId,
        fromNode?.name || fromNode?.title || fromNode?.identifier,
        fromNode?.description || fromNode?.notion || ''
      );
      addNode(
        relation.toType,
        relation.toId,
        toNode?.name || toNode?.title || toNode?.identifier,
        toNode?.description || toNode?.notion || ''
      );
    }

    return {
      nodes,
      relations: relations.map((rel) => ({
        id: rel._id.toString(),
        fromType: rel.fromType,
        fromId: rel.fromId.toString(),
        toType: rel.toType,
        toId: rel.toId.toString(),
        type: rel.type,
        strength: rel.strength
      }))
    };
  } catch (error) {
    console.error('Error getting project graph:', error);
    return { nodes: [], relations: [] };
  }
}

export async function createRelation({
  fromType,
  fromId,
  toType,
  toId,
  type,
  projectId,
  strength = 5
}) {
  try {
    const relation = await Relation.create({
      fromType,
      fromId,
      toType,
      toId,
      type,
      projectId,
      strength
    });

    return {
      id: relation._id.toString(),
      fromType: relation.fromType,
      fromId: relation.fromId.toString(),
      toType: relation.toType,
      toId: relation.toId.toString(),
      type: relation.type,
      strength: relation.strength
    };
  } catch (error) {
    console.error('Error creating relation:', error);
    throw error;
  }
}

export async function deleteRelation({
  relationId
}) {
  try {
    await Relation.findByIdAndDelete(relationId);
    return { success: true };
  } catch (error) {
    console.error('Error deleting relation:', error);
    throw error;
  }
}