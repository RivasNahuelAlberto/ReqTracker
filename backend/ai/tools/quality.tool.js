import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function analyzeRequirement({
  requirementId,
  projectId
}) {
  // This will be implemented with the full quality analysis
  // For now, return basic structure
  return {
    requirementId,
    projectId,
    analysis: "Quality analysis to be implemented"
  };
}

export async function analyzeRequirementQuality({
  requirement,
  context = []
}) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
Eres un experto en ingeniería de requisitos.

Analiza la calidad del siguiente requisito y detecta problemas:

REQUISITO:
Título: ${requirement.name || requirement.title}
Descripción: ${requirement.description}
Tipo: ${requirement.type}
Prioridad: ${requirement.priority}
Costo: ${requirement.costoImplementacion}
Riesgo: ${requirement.riesgo}

CONTEXTO RELACIONADO:
${context.map(c => `- ${c.name}: ${c.description}`).join('\n')}

DETECTA estos tipos de problemas:

1. AMBIGÜEDAD
- palabras vagas (rápido, eficiente, seguro, fácil)
- falta de métricas cuantificables

2. FALTA DE CRITERIOS
- no hay métricas de aceptación
- no hay condiciones específicas

3. CONTRADICCIONES
- requisitos que se contradicen entre sí

4. INCOMPLETITUD
- falta información esencial
- dependencias no claras

5. RIESGOS TÉCNICOS
- imposibilidad técnica
- complejidad excesiva

6. REDUNDANCIA
- duplicación con otros requisitos

FORMATO DE RESPUESTA:
- Lista de problemas encontrados
- Severidad (bajo, medio, alto)
- Sugerencias concretas de mejora
- Nivel de calidad general (1-10)
`;

    const result = await model.generateContent(prompt);
    const analysis = result.response.text();

    return {
      analysis,
      qualityScore: Math.floor(Math.random() * 5) + 6, // Placeholder
      issues: [], // Would parse from analysis
      suggestions: [] // Would parse from analysis
    };
  } catch (error) {
    console.error('Error in quality analysis:', error);
    return {
      analysis: 'Error al analizar la calidad del requisito',
      qualityScore: 0,
      issues: [],
      suggestions: []
    };
  }
}