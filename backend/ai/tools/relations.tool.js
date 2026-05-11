import Relation from '../../models/Relation.js';
import Project from '../../models/Project.js';
import SymbolModel from '../../models/Symbol.js';

function resolveNode(project, nodeType, nodeId) {
  const idString = nodeId?.toString();
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