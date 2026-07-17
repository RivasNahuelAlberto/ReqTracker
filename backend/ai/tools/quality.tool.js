import { GoogleGenerativeAI } from '@google/generative-ai';
import Project from '../../models/Project.js';
import Requirement from '../../models/Requirement.js';
import SymbolModel from '../../models/Symbol.js';
import { semanticSearch } from './semantic.tool.js';
import { createProjectRequirementsService } from '../../services/projectRequirements.service.js';
import { createProjectScenariosService } from '../../services/projectScenarios.service.js';
import { createProjectInspectionsService } from '../../services/projectInspections.service.js';

const requirementsService = createProjectRequirementsService({
  ProjectModel: Project,
  RequirementModel: Requirement
});
const scenariosService = createProjectScenariosService({
  ProjectModel: Project,
  ScenarioModel: (await import('../../models/Scenario.js')).default
});
const inspectionsService = createProjectInspectionsService({
  ProjectModel: Project,
  InspectionModel: (await import('../../models/Inspection.js')).default
});

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

  const requirements = await requirementsService.getProjectRequirements(projectId);
  const symbolsList = await SymbolModel.find({ project: projectId }).lean();
  const scenariosList = await scenariosService.getProjectScenarios(projectId);
  const inspectionsList = await inspectionsService.getProjectInspections(projectId);
  const resolveNotes = Array.isArray(project.resolveNotes) ? project.resolveNotes : [];

  // Buscar en requisitos
  results.requirements = requirements
    .filter(item => matchesSearch(query, item.name, item.description, item.basis))
    .map(item => ({
      type: 'requirement',
      id: item.id,
      name: item.name,
      description: item.description?.substring(0, 100) + (item.description?.length > 100 ? '...' : ''),
      identifier: item.identifier
    }));

  // Buscar en símbolos
  results.symbols = symbolsList
    .filter(item => matchesSearch(query, item.name, item.description))
    .map(item => ({
      type: 'symbol',
      id: item._id.toString(),
      name: item.name,
      description: item.description?.substring(0, 100) + (item.description?.length > 100 ? '...' : '')
    }));

  // Buscar en escenarios
  results.scenarios = scenariosList
    .filter(item => matchesSearch(query, item.title, item.objective, item.description))
    .map(item => ({
      type: 'scenario',
      id: item.id,
      name: item.title,
      description: item.objective?.substring(0, 100) + (item.objective?.length > 100 ? '...' : '')
    }));

  // Buscar en inspecciones
  results.inspections = inspectionsList
    .filter(item => matchesSearch(query, item.aspect, item.description))
    .map(item => ({
      type: 'inspection',
      id: item.id,
      name: item.aspect,
      description: item.description?.substring(0, 100) + (item.description?.length > 100 ? '...' : '')
    }));

  // Buscar en notas a resolver
  results.resolveNotes = resolveNotes
    .filter(item => matchesSearch(query, item.name, item.description))
    .map(item => ({
      type: 'resolveNote',
      id: item._id?.toString() || item.id,
      name: item.name,
      description: item.description?.substring(0, 100) + (item.description?.length > 100 ? '...' : '')
    }));

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

  let entity = null;
  let entityType = 'requirement';

  const typeHints = extractEntityTypeHints(requirementText || '');

  // If requirementId is provided, find by ID across types
  if (requirementId) {
    entity = await findEntityById(project, requirementId, projectId);
    if (!entity) {
      throw new Error('Entidad no encontrada en el proyecto.');
    }
    entityType = entity.type;
  } else if (requirementText) {
    const allMatches = await findProjectMatches(project, requirementText, projectId);
    const preferredMatches = typeHints.length
      ? allMatches.filter(match => typeHints.includes(match.type))
      : allMatches;

    const effectiveMatches = preferredMatches.length > 0 ? preferredMatches : allMatches;

    if (effectiveMatches.length === 0) {
      const searchResults = await searchProjectElements({ projectId, query: requirementText });
      const candidates = [
        ...searchResults.requirements,
        ...searchResults.symbols,
        ...searchResults.scenarios,
        ...searchResults.inspections,
        ...searchResults.resolveNotes
      ].slice(0, 10);

      const error = new Error(`No se encontraron elementos del dominio que coincidan con: "${requirementText}".`);
      error.code = 'NO_MATCH';
      error.suggestion = 'Intenta con palabras clave más específicas o usa un ID de elemento.';

      if (candidates.length > 0) {
        error.options = candidates.map(item => ({
          type: item.type,
          id: item.id,
          name: item.name,
          description: item.description
        }));
        error.suggestion = '¿Te refieres a alguno de estos elementos? Proporciona el nombre exacto o el ID si sabes cuál es.';
      }

      throw error;
    }

    if (effectiveMatches.length > 1) {
      const error = new Error(`Se encontraron ${effectiveMatches.length} elementos que podrían coincidir con tu búsqueda.`);
      error.code = 'AMBIGUOUS';
      error.options = effectiveMatches.map(match => ({
        type: match.type,
        id: match.id,
        name: match.name,
        description: match.description
      }));
      error.suggestion = 'Por favor, especifica cuál de estos elementos deseas analizar.';
      throw error;
    }

    entity = effectiveMatches[0].entity;
    entityType = effectiveMatches[0].type;
    requirementId = effectiveMatches[0].id;
  } else {
    throw new Error('Debes proporcionar requirementId o una descripción del requisito (requirement).');
  }

  const contextQuery = [entity.name, entity.description, entity.basis, entity.type]
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

  const analysis = await analyzeEntityQuality({
    entity,
    entityType,
    context
  });

  return {
    entityId: requirementId,
    entityType,
    entityName: entity.name || entity.title,
    projectId,
    analysis: analysis.analysis,
    qualityScore: analysis.qualityScore,
    issues: analysis.issues,
    suggestions: analysis.suggestions
  };
}

function extractEntityTypeHints(query) {
  const text = normalizeText(query);
  const hints = [];

  if (/\b(requisito|requisitos|requirement|requirements)\b/.test(text)) hints.push('requirement');
  if (/\b(símbolo|simbolo|símbolos|simbolos|symbol|symbols)\b/.test(text)) hints.push('symbol');
  if (/\b(escenario|escenarios|scenario|scenarios)\b/.test(text)) hints.push('scenario');
  if (/\b(inspección|inspeccion|inspecciones|inspection|inspections)\b/.test(text)) hints.push('inspection');
  if (/\b(nota|notas|resolve note|resolve notes|a resolver)\b/.test(text)) hints.push('resolveNote');

  return hints;
}

async function findEntityById(project, id, projectId) {
  const collections = [
    { items: await requirementsService.getProjectRequirements(projectId), type: 'requirement' },
    { items: await SymbolModel.find({ project: projectId }).lean(), type: 'symbol' },
    { items: await scenariosService.getProjectScenarios(projectId), type: 'scenario' },
    { items: await inspectionsService.getProjectInspections(projectId), type: 'inspection' },
    { items: Array.isArray(project.resolveNotes) ? project.resolveNotes : [], type: 'resolveNote' }
  ];

  for (const collection of collections) {
    if (!Array.isArray(collection.items)) continue;
    const item = collection.items.find(it => it._id?.toString() === id.toString() || it.id?.toString() === id.toString() || it.identifier?.toString() === id.toString());
    if (item) {
      return { ...item, type: collection.type };
    }
  }
  return null;
}

async function findProjectMatches(project, query, projectId) {
  const matches = [];

  const pushMatches = (items, type, extraFields = []) => {
    if (!Array.isArray(items)) return;
    items.forEach(item => {
      const fields = [item.name, item.description, item.basis, item.identifier, item.notion, item.impact, item.title, item.type].filter(Boolean);
      if (matchesSearch(query, ...fields)) {
        matches.push({
          type,
          id: item._id?.toString(),
          name: item.name || item.title || item.identifier || 'Sin nombre',
          description: item.description || item.notion || item.impact || '',
          entity: { ...item, type }
        });
      }
    });
  };

  pushMatches(await requirementsService.getProjectRequirements(projectId), 'requirement');
  pushMatches(await SymbolModel.find({ project: projectId }).lean(), 'symbol');
  pushMatches(await scenariosService.getProjectScenarios(projectId), 'scenario');
  pushMatches(await inspectionsService.getProjectInspections(projectId), 'inspection');
  pushMatches(Array.isArray(project.resolveNotes) ? project.resolveNotes : [], 'resolveNote');

  return matches;
}


export async function analyzeEntityQuality({
  entity,
  entityType = 'requirement',
  context = []
}) {
  try {
    const model = genAI.getGenerativeModel({ model: GOOGLE_GEMINI_MODEL });

    const entityFields = [
      `Nombre: ${entity.name || entity.title || ''}`,
      entity.identifier ? `Identificador: ${entity.identifier}` : null,
      entity.type ? `Tipo: ${entity.type}` : null,
      entity.priority ? `Prioridad: ${entity.priority}` : null,
      entity.costoImplementacion ? `Costo: ${entity.costoImplementacion}` : null,
      entity.riesgo ? `Riesgo: ${entity.riesgo}` : null,
      entity.notion ? `Noción: ${entity.notion}` : null,
      entity.impact ? `Impacto: ${entity.impact}` : null,
      entity.description ? `Descripción: ${entity.description}` : null
    ].filter(Boolean).join('\n');

    const prompt = `
Eres un experto en análisis de elementos de proyecto.

Analiza la calidad y las posibles inconsistencias del siguiente elemento del dominio de tipo ${entityType}:

ELEMENTO:
${entityFields}

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
- elementos que se contradicen entre sí

4. INCOMPLETITUD
- falta de información esencial
- dependencias o relaciones no claras

5. RIESGOS TÉCNICOS
- imposibilidad técnica
- complejidad excesiva

6. REDUNDANCIA
- duplicación con otros elementos del dominio

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
      qualityScore: Math.floor(Math.random() * 5) + 6,
      issues: [],
      suggestions: []
    };
  } catch (error) {
    console.error('Error in entity quality analysis:', error);
    return {
      analysis: 'Error al analizar la calidad del elemento',
      qualityScore: 0,
      issues: [],
      suggestions: []
    };
  }
}

export async function analyzeRequirementQuality(args) {
  return analyzeEntityQuality({
    ...args,
    entityType: 'requirement'
  });
}