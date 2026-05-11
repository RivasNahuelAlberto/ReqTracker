import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function expandImpact({
  entityId,
  entityType,
  projectId,
  visited = new Set()
}) {
  // Placeholder - en una implementación completa, esto haría una búsqueda recursiva
  // de todas las relaciones conectadas
  if (visited.has(entityId)) {
    return [];
  }

  visited.add(entityId);

  // Aquí iría la lógica para encontrar relaciones recursivamente
  // Por simplicidad, retornamos un array vacío por ahora
  return [];
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
Nombre: ${entity.name || entity.title}
Descripción: ${entity.description}

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