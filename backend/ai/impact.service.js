import { GoogleGenerativeAI } from '@google/generative-ai';
import { getImpactGraph } from './tools/relations.tool.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function expandImpact({
  entityId,
  entityType,
  projectId,
  visited = new Set()
}) {
  const relations = await getImpactGraph({ entityId, entityType, projectId });
  const expanded = [];

  for (const rel of relations) {
    if (visited.has(rel.id)) {
      continue;
    }
    visited.add(rel.id);
    expanded.push(rel);

    const nextEntityId = rel.fromId === entityId ? rel.toId : rel.fromId;
    const nextEntityType = rel.fromId === entityId ? rel.toType : rel.fromType;

    const nested = await expandImpact({
      entityId: nextEntityId,
      entityType: nextEntityType,
      projectId,
      visited
    });
    expanded.push(...nested);
  }

  return expanded;
}

export async function reasonImpact({
  entity,
  graph,
  projectId
}) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
Eres un analista de impacto de sistemas complejos especializado en proyectos de software.

Analiza qué impacto tendría cambiar la siguiente entidad:

ENTIDAD:
Tipo: ${entity.type}
Nombre: ${entity.name || entity.title || entity.identifier}
Descripción: ${entity.description || entity.notion || entity.impact || ''}

GRAFO DE RELACIONES:
${JSON.stringify(graph, null, 2)}

Analiza:
1. Componentes que se verían afectados directamente
2. Impacto en cadena (efectos indirectos)
3. Riesgos técnicos identificados
4. Recomendaciones para mitigar riesgos
5. Nivel de impacto general (bajo, medio, alto)

Proporciona un análisis estructurado y recomendaciones prácticas.
`;

    const result = await model.generateContent(prompt);
    const analysis = result.response.text();

    return analysis;
  } catch (error) {
    console.error('Error in impact analysis:', error);
    return 'Error al analizar el impacto del cambio.';
  }
}

export async function analyzeImpact({ entityId, entityType, projectId, entity }) {
  const graph = await getImpactGraph({ entityId, entityType, projectId });
  const expandedImpact = await expandImpact({ entityId, entityType, projectId });
  const analysis = await reasonImpact({ entity, graph: [...graph, ...expandedImpact], projectId });

  return {
    entityId,
    entityType,
    graph,
    expandedImpact,
    analysis
  };
}