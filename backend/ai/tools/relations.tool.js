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
  let resolvedType = null;

  // Si se especifica un tipo, buscar solo en ese tipo
  if (normalizedType) {
    if (normalizedType === 'symbol') {
      entity = await findSymbolByName(projectId, name);
      if (entity) resolvedType = 'symbol';
    } else if (normalizedType === 'requirement') {
      entity = findItemByName(project.requirements, name);
      if (entity) resolvedType = 'requirement';
    } else if (normalizedType === 'scenario') {
      entity = findItemByName(project.scenarios, name);
      if (entity) resolvedType = 'scenario';
    } else if (normalizedType === 'inspection') {
      entity = findItemByName(project.inspections, name);
      if (entity) resolvedType = 'inspection';
    } else if (normalizedType === 'task') {
      entity = findItemByName(project.tasks, name);
      if (entity) resolvedType = 'task';
    }
  } else {
    // Si no se especifica tipo, buscar en todos (prioridad: symbol, requirement, scenario, inspection, task)
    entity = await findSymbolByName(projectId, name);
    if (entity) {
      resolvedType = 'symbol';
    } else {
      entity = findItemByName(project.requirements, name);
      if (entity) {
        resolvedType = 'requirement';
      } else {
        entity = findItemByName(project.scenarios, name);
        if (entity) {
          resolvedType = 'scenario';
        } else {
          entity = findItemByName(project.inspections, name);
          if (entity) {
            resolvedType = 'inspection';
          } else {
            entity = findItemByName(project.tasks, name);
            if (entity) {
              resolvedType = 'task';
            }
          }
        }
      }
    }
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

export async function getProjectSummary({ projectId }) {
  try {
    const project = await Project.findById(projectId).lean();
    if (!project) {
      throw new Error('Proyecto no encontrado.');
    }

    const symbols = await SymbolModel.find({ project: projectId }).lean();
    const relations = await Relation.find({ projectId }).lean();

    const summary = {
      projectId,
      projectName: project.name,
      symbols: {
        count: symbols.length,
        items: symbols.slice(0, 10).map((s) => ({ id: s._id.toString(), name: s.name, type: s.type, isSeed: s.isSeed }))
      },
      requirements: {
        count: (project.requirements || []).length,
        items: (project.requirements || []).slice(0, 10).map((r) => ({ id: r._id?.toString(), name: r.name, identifier: r.identifier }))
      },
      scenarios: {
        count: (project.scenarios || []).length,
        items: (project.scenarios || []).slice(0, 5).map((s) => ({ id: s._id?.toString(), title: s.title, type: s.type }))
      },
      inspections: {
        count: (project.inspections || []).length
      },
      tasks: {
        count: (project.tasks || []).length
      },
      relations: {
        count: relations.length,
        types: relations.reduce((acc, rel) => {
          acc[rel.type] = (acc[rel.type] || 0) + 1;
          return acc;
        }, {})
      }
    };

    return summary;
  } catch (error) {
    console.error('Error getting project summary:', error);
    throw error;
  }
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
    const nodes = [];
    const seen = new Set();

    function addNode(nodeType, nodeId, name, description) {
      if (!nodeId) return;
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

    // Agregar todos los símbolos del proyecto
    const symbols = await SymbolModel.find({ project: projectId }).lean();
    for (const symbol of symbols) {
      addNode('symbol', symbol._id, symbol.name, symbol.notion || symbol.impact || '');
    }

    // Agregar todos los requisitos del proyecto
    for (const req of (project.requirements || [])) {
      addNode('requirement', req._id, req.name, req.description || req.basis || '');
    }

    // Agregar todos los escenarios del proyecto
    for (const scenario of (project.scenarios || [])) {
      addNode('scenario', scenario._id, scenario.title, scenario.objective || scenario.episodes || '');
    }

    // Agregar todas las inspecciones del proyecto
    for (const inspection of (project.inspections || [])) {
      addNode('inspection', inspection._id, inspection.aspect, inspection.description || '');
    }

    // Agregar todas las tareas del proyecto
    for (const task of (project.tasks || [])) {
      addNode('task', task._id, task.description, task.targetLabel || '');
    }

    // Ahora agregar relaciones explícitas
    for (const relation of relations) {
      const fromNode = await resolveNode(project, relation.fromType, relation.fromId);
      const toNode = await resolveNode(project, relation.toType, relation.toId);

      addNode(
        relation.fromType,
        relation.fromId,
        fromNode?.name || fromNode?.title || fromNode?.identifier || fromNode?.aspect || fromNode?.description,
        fromNode?.description || fromNode?.notion || fromNode?.objective || ''
      );
      addNode(
        relation.toType,
        relation.toId,
        toNode?.name || toNode?.title || toNode?.identifier || toNode?.aspect || toNode?.description,
        toNode?.description || toNode?.notion || toNode?.objective || ''
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