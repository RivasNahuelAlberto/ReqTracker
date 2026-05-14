import { GoogleGenerativeAI } from '@google/generative-ai';
import Project from '../models/Project.js';
import SymbolModel from '../models/Symbol.js';
import { getProjectGraph } from './tools/relations.tool.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const GOOGLE_GEMINI_MODEL = process.env.GOOGLE_GEMINI_MODEL || process.env.GEMINI_MODEL || 'text-bison-001';

function filterNodeSummary(node) {
  return {
    id: node.id,
    type: node.type,
    name: node.name,
    description: node.description
  };
}

function buildProjectSummary(project) {
  const requirementCount = (project.requirements || []).length;
  const symbolCount = (project.symbols || []).length;
  const scenarioCount = (project.scenarios || []).length;
  const inspectionCount = (project.inspections || []).length;
  const taskCount = (project.tasks || []).length;

  const keyItems = [
    ...(project.about?.items || []).slice(0, 10),
    ...(project.tasks || []).slice(0, 5).map((task) => task.description),
    ...(project.requirements || []).slice(0, 5).map((req) => req.name)
  ].filter(Boolean);

  return {
    name: project.name,
    documentCount: (project.documents || []).length,
    symbolCount,
    requirementCount,
    scenarioCount,
    inspectionCount,
    taskCount,
    keyItems: keyItems.slice(0, 20)
  };
}

export async function optimizeProject({ projectId }) {
  if (!projectId) {
    throw new Error('projectId es requerido para la optimización.');
  }

  const project = await Project.findById(projectId).lean();
  if (!project) {
    throw new Error('Proyecto no encontrado para optimización.');
  }

  const graphData = await getProjectGraph({ projectId });
  
  // GRAPH CONTRACT NORMALIZATION
  let normalizedGraph = graphData;
  if (graphData && typeof graphData === 'object') {
    if (!Array.isArray(graphData)) {
      // If it's an object with relations, use that
      normalizedGraph = Array.isArray(graphData.relations) ? graphData.relations : graphData;
    }
  }
  
  const projectSummary = buildProjectSummary(project);

  const prompt = `
Eres un experto en ingeniería de requisitos y arquitectura de proyectos. Analiza el siguiente proyecto y propone optimizaciones estructurales.

Proyecto:
Nombre: ${projectSummary.name}
Documentos: ${projectSummary.documentCount}
Símbolos: ${projectSummary.symbolCount}
Requisitos: ${projectSummary.requirementCount}
Escenarios: ${projectSummary.scenarioCount}
Inspecciones: ${projectSummary.inspectionCount}
Tareas: ${projectSummary.taskCount}

Elementos clave:
${projectSummary.keyItems.map((item) => `- ${item}`).join('\n')}

Relaciones del proyecto:
${JSON.stringify(normalizedGraph, null, 2)}

Analiza y responde con:
1. Redundancias o duplicidades estructurales.
2. Partes sobre-modeladas o complejas.
3. Vacíos funcionales o faltantes.
4. Recomendaciones para reorganizar el proyecto y simplificarlo.
5. Una propuesta breve de pasos para optimizar el modelo.

Devuelve la respuesta en formato estructurado, con secciones claras.\n`;

  const model = genAI.getGenerativeModel({ model: GOOGLE_GEMINI_MODEL });
  const result = await model.generateContent(prompt);
  const analysis = result.response.text();

  return {
    projectId,
    summary: projectSummary,
    graph: graphData,
    recommendations: analysis
  };
}
