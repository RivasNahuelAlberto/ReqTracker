import { GoogleGenerativeAI } from '@google/generative-ai';
import Project from '../../models/Project.js';
import { semanticSearch } from './semantic.tool.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const GOOGLE_GEMINI_MODEL = process.env.GOOGLE_GEMINI_MODEL || process.env.GEMINI_MODEL || 'text-bison-001';

export async function analyzeRequirement({
  requirementId,
  projectId,
  requirement: requirementText
}) {
  if (!projectId) {
    throw new Error('projectId es requerido para el análisis de calidad.');
  }

  const project = await Project.findById(projectId).lean();
  if (!project) {
    throw new Error('Proyecto no encontrado para el análisis de calidad.');
  }

  let requirement;

  // If requirementId is provided, find by ID
  if (requirementId) {
    requirement = (project.requirements || []).find((item) => {
      const idMatch = item._id?.toString() === requirementId.toString();
      const identifierMatch = item.identifier?.toString() === requirementId.toString();
      return idMatch || identifierMatch;
    });

    if (!requirement) {
      throw new Error('Requisito no encontrado en el proyecto.');
    }
  } else if (requirementText) {
    // If only description text is provided, search for matching requirements
    const searchText = requirementText.toLowerCase();
    const matches = (project.requirements || []).filter((item) => {
      const name = (item.name || '').toLowerCase();
      const description = (item.description || '').toLowerCase();
      return name.includes(searchText) || description.includes(searchText);
    });

    if (matches.length === 0) {
      throw new Error(
        `No se encontraron requisitos que coincidan con: "${requirementText}". Por favor proporciona un texto más específico o un ID de requisito.`
      );
    }

    if (matches.length > 1) {
      throw new Error(
        `Se encontraron ${matches.length} requisitos que coinciden con "${requirementText}". Por favor, sé más específico o proporciona el ID exacto.`
      );
    }

    requirement = matches[0];
    requirementId = requirement._id.toString();
  } else {
    throw new Error('Debes proporcionar requirementId o una descripción del requisito (requirement).');
  }

  const contextQuery = [requirement.name, requirement.description, requirement.basis, requirement.type]
    .filter(Boolean)
    .join(' ');

  const contextResults = await semanticSearch({
    projectId,
    query: contextQuery
  });

  const context = [
    ...(contextResults.documentMatches || []),
    ...(contextResults.symbolMatches || []),
    ...(contextResults.requirementMatches || [])
  ];

  const analysis = await analyzeRequirementQuality({
    requirement,
    context
  });

  return {
    requirementId,
    projectId,
    analysis: analysis.analysis,
    qualityScore: analysis.qualityScore,
    issues: analysis.issues,
    suggestions: analysis.suggestions
  };
}

export async function analyzeRequirementQuality({
  requirement,
  context = []
}) {
  try {
    const model = genAI.getGenerativeModel({ model: GOOGLE_GEMINI_MODEL });

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