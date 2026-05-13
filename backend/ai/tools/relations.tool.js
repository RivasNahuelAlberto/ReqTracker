import Relation from '../../models/Relation.js';
import Project from '../../models/Project.js';
import SymbolModel from '../../models/Symbol.js';
import { generateProjectRelations, suggestRelationsForEntity } from '../graph-generation.service.js';


function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\()]/g, '\\$&');
}
function normalizeText(value) {
  if (!value) return '';
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
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

async function getEntityInfo(project, entityType, entityId) {
  const node = await resolveNode(project, entityType, entityId);
  if (!node) return null;

  const name = node.name || node.title || node.identifier || node.targetLabel || '';
  const description = node.notion || node.impact || node.description || node.objective || '';

  return {
    entityId: normalizeId(entityId),
    entityType,
    name,
    description
  };
}

function matchEntityName(itemName, query) {
  const normalizedItem = normalizeText(itemName);
  const normalizedQuery = normalizeText(query);
  if (!normalizedItem || !normalizedQuery) return false;
  return normalizedItem === normalizedQuery
    || normalizedItem.includes(normalizedQuery)
    || normalizedQuery.includes(normalizedItem);
}

async function findSymbolsByName(projectId, name) {
  if (!name || !projectId) return [];
  const exactSearch = new RegExp(`^${escapeRegExp(name.trim())}$`, 'i');
  const exactMatch = await SymbolModel.findOne({ project: projectId, name: exactSearch }).lean();
  if (exactMatch) return [exactMatch];

  const symbols = await SymbolModel.find({ project: projectId }).lean();
  return symbols.filter((item) => matchEntityName(item.name, name));
}

function findItemsByName(items = [], name) {
  const normalizedName = normalizeText(name);
  if (!normalizedName || !Array.isArray(items)) return [];

  const exactSearch = new RegExp(`^${escapeRegExp(name.trim())}$`, 'i');
  const containsSearch = new RegExp(escapeRegExp(name.trim()), 'i');

  return items.filter((item) => {
    const title = item.name || item.title || item.identifier || item.targetLabel || '';
    if (!title) return false;
    return exactSearch.test(title) || containsSearch.test(title) || matchEntityName(title, name);
  });
}

function buildEntityCandidate(item, type, fallbackName) {
  if (!item) return null;
  const id = item._id?.toString() || item.id?.toString();
  if (!id) return null;
  const title = item.name || item.title || item.identifier || item.targetLabel || fallbackName || '';
  const description = item.notion || item.impact || item.description || item.objective || '';
  return {
    entityId: id,
    entityType: type,
    name: title,
    description
  };
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
  const candidates = [];

  const addCandidate = (item, type) => {
    const candidate = buildEntityCandidate(item, type, name);
    if (candidate) candidates.push(candidate);
  };

  const addAllCandidates = async () => {
    const symbolMatches = await findSymbolsByName(projectId, name);
    symbolMatches.forEach((item) => addCandidate(item, 'symbol'));
    findItemsByName(project.requirements, name).forEach((item) => addCandidate(item, 'requirement'));
    findItemsByName(project.scenarios, name).forEach((item) => addCandidate(item, 'scenario'));
    findItemsByName(project.inspections, name).forEach((item) => addCandidate(item, 'inspection'));
    findItemsByName(project.tasks, name).forEach((item) => addCandidate(item, 'task'));
  };

  if (normalizedType) {
    if (normalizedType === 'symbol') {
      (await findSymbolsByName(projectId, name)).forEach((item) => addCandidate(item, 'symbol'));
    } else if (normalizedType === 'requirement') {
      findItemsByName(project.requirements, name).forEach((item) => addCandidate(item, 'requirement'));
    } else if (normalizedType === 'scenario') {
      findItemsByName(project.scenarios, name).forEach((item) => addCandidate(item, 'scenario'));
    } else if (normalizedType === 'inspection') {
      findItemsByName(project.inspections, name).forEach((item) => addCandidate(item, 'inspection'));
    } else if (normalizedType === 'task') {
      findItemsByName(project.tasks, name).forEach((item) => addCandidate(item, 'task'));
    }

    if (candidates.length === 0) {
      await addAllCandidates();
    }
  } else {
    await addAllCandidates();
  }

  const uniqueCandidates = Object.values(candidates.reduce((acc, candidate) => {
    const key = `${candidate.entityType}:${candidate.entityId}`;
    if (!acc[key]) acc[key] = candidate;
    return acc;
  }, {}));

  if (uniqueCandidates.length === 0) {
    return {
      ambiguous: false,
      entityId: null,
      entityType: null,
      name,
      description: `No se encontró la entidad '${name}' en el proyecto.`
    };
  }

  if (uniqueCandidates.length > 1) {
    return {
      ambiguous: true,
      name,
      candidates: uniqueCandidates
    };
  }

  const resolved = uniqueCandidates[0];
  return {
    ambiguous: false,
    entityId: resolved.entityId,
    entityType: resolved.entityType,
    name: resolved.name || name,
    description: resolved.description || ''
  };
}

export async function getEntityGraph({ projectId, entityType, entityId, entityName }) {
  if (!projectId) {
    throw new Error('projectId es requerido para obtener el grafo de entidad.');
  }

  if (!entityId && entityName) {
    const resolved = await findEntityByName({ projectId, entityType, name: entityName });
    if (resolved.ambiguous) {
      return {
        projectId,
        entityName,
        ambiguous: true,
        candidates: resolved.candidates,
        error: `El nombre '${entityName}' es ambiguo. Indica cuál de las siguientes entidades quieres analizar.`
      };
    }
    entityId = resolved.entityId;
    entityType = resolved.entityType;
  }

  if (!entityId || !entityType) {
    return {
      projectId,
      entityId: entityId || null,
      entityType: entityType || null,
      relations: [],
      error: `No se pudo resolver la entidad '${entityName || ''}'. Verifica el nombre y el tipo.`
    };
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
    const project = await Project.findById(projectId).lean();
    if (!project) {
      throw new Error('Proyecto no encontrado para obtener el grafo de impacto.');
    }

    const relations = await Relation.find({
      projectId,
      $or: [
        { fromId: entityId, fromType: entityType },
        { toId: entityId, toType: entityType }
      ]
    }).lean();

    return await Promise.all(relations.map(async (rel) => {
      const fromInfo = await getEntityInfo(project, rel.fromType, rel.fromId);
      const toInfo = await getEntityInfo(project, rel.toType, rel.toId);
      return {
        id: rel._id.toString(),
        fromType: rel.fromType,
        fromId: rel.fromId.toString(),
        fromName: fromInfo?.name || `${rel.fromType} ${rel.fromId}`,
        fromDescription: fromInfo?.description || '',
        toType: rel.toType,
        toId: rel.toId.toString(),
        toName: toInfo?.name || `${rel.toType} ${rel.toId}`,
        toDescription: toInfo?.description || '',
        type: rel.type,
        strength: rel.strength
      };
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

export async function generateGraphRelations({ projectId, threshold = 0.65 }) {
  try {
    const result = await generateProjectRelations({ projectId, threshold });
    return {
      success: true,
      projectId,
      potentialRelations: result.potentialRelations,
      createdRelations: result.createdRelations,
      relations: result.relations.map((rel) => ({
        id: rel.id,
        fromType: rel.fromType,
        fromName: rel.fromId,
        toType: rel.toType,
        toName: rel.toId,
        type: rel.type,
        strength: rel.strength,
        confidence: (rel.similarity * 100).toFixed(2)
      }))
    };
  } catch (error) {
    console.error('Error generating graph relations:', error);
    throw error;
  }
}

export async function compareEntities({ projectId, entity1Name, entity2Name, entityType }) {
  try {
    // Resolver ambas entidades
    const resolved1 = await findEntityByName({ projectId, entityType, name: entity1Name });
    const resolved2 = await findEntityByName({ projectId, entityType, name: entity2Name });

    // Verificar si ambas se resolvieron exitosamente
    if (resolved1.ambiguous || resolved2.ambiguous) {
      const ambiguousEntities = [];
      if (resolved1.ambiguous) ambiguousEntities.push({ name: entity1Name, candidates: resolved1.candidates });
      if (resolved2.ambiguous) ambiguousEntities.push({ name: entity2Name, candidates: resolved2.candidates });
      
      return {
        success: false,
        error: 'Una o ambas entidades son ambiguas',
        ambiguousEntities
      };
    }

    if (!resolved1.entityId || !resolved2.entityId) {
      return {
        success: false,
        error: `No se pudieron resolver las entidades: ${entity1Name}, ${entity2Name}`
      };
    }

    // Obtener información detallada de ambas entidades
    const project = await Project.findById(projectId).lean();
    const entity1Node = await resolveNode(project, resolved1.entityType, resolved1.entityId);
    const entity2Node = await resolveNode(project, resolved2.entityType, resolved2.entityId);

    // Obtener grafos de impacto
    const relations1 = await getImpactGraph({
      projectId,
      entityId: resolved1.entityId,
      entityType: resolved1.entityType
    });

    const relations2 = await getImpactGraph({
      projectId,
      entityId: resolved2.entityId,
      entityType: resolved2.entityType
    });

    // Extraer entidades relacionadas
    const relatedTo1 = new Set();
    const relatedTo2 = new Set();

    relations1.forEach(rel => {
      relatedTo1.add(`${rel.fromType}:${rel.fromId}:${rel.type}`);
      relatedTo1.add(`${rel.toType}:${rel.toId}:${rel.type}`);
    });

    relations2.forEach(rel => {
      relatedTo2.add(`${rel.fromType}:${rel.fromId}:${rel.type}`);
      relatedTo2.add(`${rel.toType}:${rel.toId}:${rel.type}`);
    });

    // Detectar inconsistencias
    const inconsistencies = [];

    // 1. Comparar definiciones
    if (entity1Node && entity2Node) {
      const def1 = (entity1Node.notion || entity1Node.impact || entity1Node.description || '').toLowerCase();
      const def2 = (entity2Node.notion || entity2Node.impact || entity2Node.description || '').toLowerCase();

      if (def1 !== def2) {
        inconsistencies.push({
          type: 'DEFINICIONES_DIFERENTES',
          severity: 'ALTO',
          description: `${entity1Name} y ${entity2Name} tienen definiciones/nociones distintas. Si se tratan como sinónimos, se perdería información importante.`,
          details: {
            entity1_definition: def1.substring(0, 150) + (def1.length > 150 ? '...' : ''),
            entity2_definition: def2.substring(0, 150) + (def2.length > 150 ? '...' : '')
          }
        });
      }
    }

    // 2. Detectar relaciones diferentes
    const unique1 = new Set([...relatedTo1].filter(r => !relatedTo2.has(r)));
    const unique2 = new Set([...relatedTo2].filter(r => !relatedTo1.has(r)));

    if (unique1.size > 0 || unique2.size > 0) {
      inconsistencies.push({
        type: 'RELACIONES_DIFERENTES',
        severity: unique1.size + unique2.size > 5 ? 'ALTO' : 'MEDIO',
        description: `${entity1Name} y ${entity2Name} tienen relaciones distintas con otras entidades. Tratarlas como sinónimos podría causar conflictos de dependencias.`,
        details: {
          relations_unique_to_entity1: Array.from(unique1).slice(0, 5),
          relations_unique_to_entity2: Array.from(unique2).slice(0, 5),
          count_unique_to_entity1: unique1.size,
          count_unique_to_entity2: unique2.size
        }
      });
    }

    // 3. Comparar cantidad de relaciones
    if (Math.abs(relations1.length - relations2.length) > 2) {
      inconsistencies.push({
        type: 'CANTIDAD_RELACIONES_DIFERENTES',
        severity: 'MEDIO',
        description: `${entity1Name} tiene ${relations1.length} relaciones y ${entity2Name} tiene ${relations2.length}. Son entidades con contextos diferentes.`,
        details: {
          entity1_relation_count: relations1.length,
          entity2_relation_count: relations2.length,
          difference: Math.abs(relations1.length - relations2.length)
        }
      });
    }

    return {
      success: true,
      entity1: {
        name: resolved1.name,
        type: resolved1.entityType,
        id: resolved1.entityId,
        description: resolved1.description,
        relationCount: relations1.length
      },
      entity2: {
        name: resolved2.name,
        type: resolved2.entityType,
        id: resolved2.entityId,
        description: resolved2.description,
        relationCount: relations2.length
      },
      inconsistencies,
      recommendation: inconsistencies.length > 0 
        ? `⚠️ Se encontraron ${inconsistencies.length} inconsistencia(s) potencial(es). Estos elementos NO deberían ser tratados como sinónimos.`
        : `✅ Las entidades son similares y podrían considerarse sinónimos.`
    };
  } catch (error) {
    console.error('Error comparing entities:', error);
    throw error;
  }
}

export async function suggestEntityRelations({ projectId, entityId, entityType, threshold = 0.65 }) {
  try {
    const result = await suggestRelationsForEntity({ projectId, entityId, entityType, threshold });
    return {
      success: true,
      entityId,
      entityType,
      suggestedRelations: result.suggestions.map((sugg) => ({
        targetId: sugg.targetId,
        targetType: sugg.targetType,
        targetName: sugg.targetName,
        suggestedType: sugg.suggestedType,
        strength: sugg.strength,
        confidence: (sugg.similarity * 100).toFixed(2)
      }))
    };
  } catch (error) {
    console.error('Error suggesting entity relations:', error);
    throw error;
  }
}
