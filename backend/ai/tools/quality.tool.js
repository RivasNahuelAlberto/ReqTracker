import { GoogleGenerativeAI } from '@google/generative-ai';
import Project from '../../models/Project.js';
import { semanticSearch } from './semantic.tool.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const GOOGLE_GEMINI_MODEL = process.env.GOOGLE_GEMINI_MODEL || process.env.GEMINI_MODEL || 'text-bison-001';

function normalizeText(text) {
  return (text || '').toString().toLowerCase();
}

function buildSearchTerms(query) {
  const normalized = normalizeText(query);
  const segments = normalized.split(/\s+(?:y|and|o|or|,|;|\.|\?|!|\n)\s+/).filter(Boolean);
  const tokens = normalized.match(/\b\w{3,}\b/g) || [];
  return Array.from(new Set([...segments, ...tokens]));
}

function matchesSearch(query, ...fields) {
  const terms = buildSearchTerms(query);
  return terms.some(term => fields.some(field => normalizeText(field).includes(term)));
}

/**
 * Busca elementos en el proyecto por texto flexible
 * Devuelve múltiples tipos de elementos (requirements, symbols, scenarios, etc.)
 */
export async function searchProjectElements({ projectId, query }) {
  if (!projectId || !query) {
    throw new Error('projectId y query son requeridos para la búsqueda.');
  }

  const project = await Project.findById(projectId).lean();
  if (!project) {
    throw new Error('Proyecto no encontrado.');
  }

  const searchText = query.toLowerCase();
  const results = {
    requirements: [],
    symbols: [],
    scenarios: [],
    inspections: [],
    resolveNotes: []
  };

  // Buscar en requisitos
  if (project.requirements) {
    results.requirements = project.requirements
      .filter(item => {
        return matchesSearch(query, item.name, item.description, item.basis);
      })
      .map(item => ({
        type: 'requirement',
        id: item._id.toString(),
        name: item.name,
        description: item.description?.substring(0, 100) + (item.description?.length > 100 ? '...' : ''),
        identifier: item.identifier
      }));
  }

  // Buscar en símbolos
  if (project.symbols) {
    results.symbols = project.symbols
      .filter(item => {
        return matchesSearch(query, item.name, item.description);
      })
      .map(item => ({
        type: 'symbol',
        id: item._id.toString(),
        name: item.name,
        description: item.description?.substring(0, 100) + (item.description?.length > 100 ? '...' : '')
      }));
  }

  // Buscar en escenarios
  if (project.scenarios) {
    results.scenarios = project.scenarios
      .filter(item => {
        return matchesSearch(query, item.name, item.description);
      })
      .map(item => ({
        type: 'scenario',
        id: item._id.toString(),
        name: item.name,
        description: item.description?.substring(0, 100) + (item.description?.length > 100 ? '...' : '')
      }));
  }

  // Buscar en inspecciones
  if (project.inspections) {
    results.inspections = project.inspections
      .filter(item => {
        return matchesSearch(query, item.name, item.description);
      })
      .map(item => ({
        type: 'inspection',
        id: item._id.toString(),
        name: item.name,
        description: item.description?.substring(0, 100) + (item.description?.length > 100 ? '...' : '')
      }));
  }

  // Buscar en notas a resolver
  if (project.resolveNotes) {
    results.resolveNotes = project.resolveNotes
      .filter(item => {
        return matchesSearch(query, item.name, item.description);
      })
      .map(item => ({
        type: 'resolveNote',
        id: item._id.toString(),
        name: item.name,
        description: item.description?.substring(0, 100) + (item.description?.length > 100 ? '...' : '')
      }));
  }

  return results;
}

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
    const matches = (project.requirements || []).filter((item) => {
      return matchesSearch(requirementText, item.name, item.description, item.basis);
    });

    if (matches.length === 0) {
      const searchResults = await searchProjectElements({ projectId, query: requirementText });
      const candidates = [
        ...searchResults.requirements,
        ...searchResults.symbols,
        ...searchResults.scenarios,
        ...searchResults.inspections,
        ...searchResults.resolveNotes
      ].slice(0, 10);

      const error = new Error(`No se encontraron requisitos exactos que coincidan con: "${requirementText}".`);
      error.code = 'NO_MATCH';
      error.suggestion = 'Intenta con palabras clave más específicas o usa un ID de requisito.';

      if (candidates.length > 0) {
        error.options = candidates.map(item => ({
          type: item.type,
          id: item.id,
          name: item.name,
          description: item.description
        }));
        error.suggestion = '¿Te refieres a alguno de estos elementos? Si es un requisito específico, proporciona su nombre exacto o su ID.';
      }

      throw error;
    }

    if (matches.length > 1) {
      // Return ambiguity error with options - this will be handled by controller
      const error = new Error(`Se encontraron ${matches.length} requisitos que podrían coincidir con tu búsqueda.`);
      error.code = 'AMBIGUOUS';
      error.options = matches.map(m => ({
        id: m._id.toString(),
        name: m.name,
        description: m.description?.substring(0, 80) + (m.description?.length > 80 ? '...' : '')
      }));
      error.suggestion = 'Por favor, especifica cuál de estos requisitos deseas analizar.';
      throw error;
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
    requirementName: requirement.name,
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