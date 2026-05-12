import { createRequirement, getRequirements, getRequirement, updateRequirement, deleteRequirement } from './requirements.tool.js';
import { createSymbol, listSymbols, getSymbol, updateSymbol, deleteSymbol } from './symbols.tool.js';
import { createScenario, getScenario, updateScenario, deleteScenario, listScenarios } from './scenarios.tool.js';
import { createInspection, getInspection, listInspections, updateInspection, deleteInspection } from './inspections.tool.js';
import { createResolveNote, getResolveNote, listResolveNotes, updateResolveNote, deleteResolveNote } from './resolveNotes.tool.js';
import { getProject } from './project.tool.js';
import { semanticSearch } from './semantic.tool.js';
import { saveMemory } from './memory.tool.js';
import { analyzeRequirement, analyzeRequirementQuality } from './quality.tool.js';
import { getImpactGraph, createRelation, deleteRelation, getProjectGraph, getEntityGraph, findEntityByName, getProjectSummary, generateGraphRelations, suggestEntityRelations } from './relations.tool.js';
import { analyzeImpact } from '../impact.service.js';
import { optimizeProject } from '../optimizer.service.js';

export async function searchDocuments({ projectId, query }) {
  const result = await semanticSearch({ projectId, query });
  return result.documentMatches || [];
}

export const tools = [
  {
    name: 'createRequirement',
    description: 'Crea un nuevo requisito dentro del proyecto. Usa valores por defecto o de prueba cuando el usuario indique que no son relevantes.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID del proyecto donde se crea el requisito.' },
        name: { type: 'string', description: 'Título del requisito.' },
        description: { type: 'string', description: 'Descripción del requisito. Si falta, se puede completar con un texto de prueba.' },
        type: { type: 'string', description: 'Tipo de requisito.' },
        status: { type: 'string', description: 'Estado del requisito, como Nuevo, En progreso, Resuelto.' },
        basis: { type: 'string', description: 'Base o razón del requisito.' },
        priority: { type: 'string', enum: ['Alta', 'Media', 'Baja'] },
        criticidad: { type: 'string', enum: ['Alta', 'Media', 'Baja'] },
        costoImplementacion: { type: 'string', enum: ['Alto', 'Medio', 'Bajo'] },
        volatilidad: { type: 'string', enum: ['Alta', 'Media', 'Baja'] },
        factibilidad: { type: 'string', enum: ['Alta', 'Media', 'Baja'] },
        riesgo: { type: 'string', enum: ['Alto', 'Medio', 'Bajo'] }
      },
      required: ['projectId', 'name']
    }
  },
  {
    name: 'createSymbol',
    description: 'Crea un nuevo símbolo dentro del proyecto.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID del proyecto donde se crea el símbolo.' },
        name: { type: 'string', description: 'Nombre del símbolo.' },
        type: { type: 'string', description: 'Tipo del símbolo.' },
        notion: { type: 'string', description: 'Noción del símbolo.' },
        impact: { type: 'string', description: 'Impacto del símbolo.' }
      },
      required: ['projectId', 'name']
    }
  },
  {
    name: 'updateSymbol',
    description: 'Actualiza campos de un símbolo existente.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID del proyecto.' },
        symbolId: { type: 'string', description: 'ID del símbolo a actualizar.' },
        name: { type: 'string', description: 'Nombre del símbolo.' },
        type: { type: 'string', description: 'Tipo del símbolo.' },
        parentSymbol: { type: 'string', description: 'ID del símbolo padre.' },
        isSeed: { type: 'boolean', description: 'Indica si es un símbolo semilla.' },
        notion: { type: 'string', description: 'Noción del símbolo.' },
        impact: { type: 'string', description: 'Impacto del símbolo.' },
        reviewNotes: { type: 'string', description: 'Notas de revisión.' },
        status: { type: 'string', description: 'Estado del símbolo.' },
        order: { type: 'string', description: 'Orden del símbolo.' }
      },
      required: ['projectId', 'symbolId']
    }
  },
  {
    name: 'deleteSymbol',
    description: 'Elimina un símbolo del proyecto y ajusta sus hijos.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID del proyecto.' },
        symbolId: { type: 'string', description: 'ID del símbolo a eliminar.' }
      },
      required: ['projectId', 'symbolId']
    }
  },
  {
    name: 'getProject',
    description: 'Obtiene un resumen del proyecto y su estado actual.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID del proyecto a consultar.' }
      },
      required: ['projectId']
    }
  },
  {
    name: 'getRequirement',
    description: 'Obtiene un requisito específico por su ID para revisar antes de actualizar o eliminar.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID del proyecto.' },
        requirementId: { type: 'string', description: 'ID del requisito a recuperar.' }
      },
      required: ['projectId', 'requirementId']
    }
  },
  {
    name: 'getScenario',
    description: 'Obtiene un escenario específico por su ID para revisar antes de actualizar o eliminar.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID del proyecto.' },
        scenarioId: { type: 'string', description: 'ID del escenario a recuperar.' }
      },
      required: ['projectId', 'scenarioId']
    }
  },
  {
    name: 'getSymbol',
    description: 'Obtiene un símbolo específico por su ID para revisar antes de actualizar o eliminar.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID del proyecto.' },
        symbolId: { type: 'string', description: 'ID del símbolo a recuperar.' }
      },
      required: ['projectId', 'symbolId']
    }
  },
  {
    name: 'listSymbols',
    description: 'Lista símbolos del proyecto con información clave.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID del proyecto.' }
      },
      required: ['projectId']
    }
  },
  {
    name: 'getRequirements',
    description: 'Lista los requisitos existentes de un proyecto.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID del proyecto.' },
        limit: { type: 'integer', description: 'Número máximo de requisitos a devolver.', minimum: 1, maximum: 50 }
      },
      required: ['projectId']
    }
  },
  {
    name: 'updateRequirement',
    description: 'Actualiza un requisito existente con campos nuevos o corregidos.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID del proyecto.' },
        requirementId: { type: 'string', description: 'ID del requisito a actualizar.' },
        identifier: { type: 'string', description: 'Identificador del requisito.' },
        name: { type: 'string', description: 'Título del requisito.' },
        type: { type: 'string', description: 'Tipo del requisito.' },
        description: { type: 'string', description: 'Descripción del requisito.' },
        basis: { type: 'string', description: 'Base o razón del requisito.' },
        priority: { type: 'string', enum: ['Alta', 'Media', 'Baja'] },
        criticidad: { type: 'string', enum: ['Alta', 'Media', 'Baja'] },
        costoImplementacion: { type: 'string', enum: ['Alto', 'Medio', 'Bajo'] },
        volatilidad: { type: 'string', enum: ['Alta', 'Media', 'Baja'] },
        factibilidad: { type: 'string', enum: ['Alta', 'Media', 'Baja'] },
        riesgo: { type: 'string', enum: ['Alto', 'Medio', 'Bajo'] },
        status: { type: 'string', description: 'Estado del requisito.' }
      },
      required: ['projectId', 'requirementId']
    }
  },
  {
    name: 'deleteRequirement',
    description: 'Elimina un requisito existente del proyecto.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID del proyecto.' },
        requirementId: { type: 'string', description: 'ID del requisito a eliminar.' }
      },
      required: ['projectId', 'requirementId']
    }
  },
  {
    name: 'listScenarios',
    description: 'Lista los escenarios existentes del proyecto.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID del proyecto.' }
      },
      required: ['projectId']
    }
  },
  {
    name: 'createScenario',
    description: 'Crea un nuevo escenario dentro del proyecto.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID del proyecto donde se crea el escenario.' },
        type: { type: 'string', description: 'Tipo del escenario.' },
        title: { type: 'string', description: 'Título del escenario.' },
        objective: { type: 'string', description: 'Objetivo del escenario.' },
        locationTemporal: { type: 'string', description: 'Ubicación temporal del escenario.' },
        locationGeographic: { type: 'string', description: 'Ubicación geográfica del escenario.' },
        preconditions: { type: 'string', description: 'Precondiciones del escenario.' },
        actors: { type: 'string', description: 'Actores del escenario.' },
        resources: { type: 'string', description: 'Recursos del escenario.' },
        episodes: { type: 'string', description: 'Episodios del escenario.' },
        exceptions: { type: 'string', description: 'Excepciones del escenario.' },
        order: { type: 'string', description: 'Orden del escenario.' }
      },
      required: ['projectId', 'type', 'title']
    }
  },
  {
    name: 'updateScenario',
    description: 'Actualiza campos de un escenario existente.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID del proyecto.' },
        scenarioId: { type: 'string', description: 'ID del escenario a actualizar.' },
        type: { type: 'string', description: 'Tipo del escenario.' },
        title: { type: 'string', description: 'Título del escenario.' },
        objective: { type: 'string', description: 'Objetivo del escenario.' },
        locationTemporal: { type: 'string', description: 'Ubicación temporal del escenario.' },
        locationGeographic: { type: 'string', description: 'Ubicación geográfica del escenario.' },
        preconditions: { type: 'string', description: 'Precondiciones del escenario.' },
        actors: { type: 'string', description: 'Actores del escenario.' },
        resources: { type: 'string', description: 'Recursos del escenario.' },
        episodes: { type: 'string', description: 'Episodios del escenario.' },
        exceptions: { type: 'string', description: 'Excepciones del escenario.' },
        order: { type: 'string', description: 'Orden del escenario.' }
      },
      required: ['projectId', 'scenarioId']
    }
  },
  {
    name: 'deleteScenario',
    description: 'Elimina un escenario existente del proyecto.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID del proyecto.' },
        scenarioId: { type: 'string', description: 'ID del escenario a eliminar.' }
      },
      required: ['projectId', 'scenarioId']
    }
  },
  {
    name: 'createInspection',
    description: 'Crea una nueva inspección dentro del proyecto.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID del proyecto donde se crea la inspección.' },
        targetType: { type: 'string', description: 'Tipo de objetivo de la inspección (symbol, scenario, etc.).' },
        targetId: { type: 'string', description: 'ID del objetivo de la inspección.' },
        targetLabel: { type: 'string', description: 'Etiqueta o nombre del objetivo.' },
        aspect: { type: 'string', description: 'Aspecto que se inspecciona.' },
        description: { type: 'string', description: 'Descripción de la inspección.' }
      },
      required: ['projectId', 'targetType', 'targetId', 'aspect', 'description']
    }
  },
  {
    name: 'updateInspection',
    description: 'Actualiza una inspección existente del proyecto.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID del proyecto.' },
        inspectionId: { type: 'string', description: 'ID de la inspección a actualizar.' },
        targetType: { type: 'string', description: 'Tipo de objetivo de la inspección.' },
        targetId: { type: 'string', description: 'ID del objetivo de la inspección.' },
        targetLabel: { type: 'string', description: 'Etiqueta o nombre del objetivo.' },
        aspect: { type: 'string', description: 'Aspecto que se inspecciona.' },
        description: { type: 'string', description: 'Descripción de la inspección.' }
      },
      required: ['projectId', 'inspectionId']
    }
  },
  {
    name: 'deleteInspection',
    description: 'Elimina una inspección existente del proyecto.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID del proyecto.' },
        inspectionId: { type: 'string', description: 'ID de la inspección a eliminar.' }
      },
      required: ['projectId', 'inspectionId']
    }
  },
  {
    name: 'createResolveNote',
    description: 'Crea una nueva nota A Resolver dentro del proyecto.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID del proyecto donde se crea la nota.' },
        text: { type: 'string', description: 'Texto de la nota A Resolver.' }
      },
      required: ['projectId', 'text']
    }
  },
  {
    name: 'updateResolveNote',
    description: 'Actualiza una nota A Resolver existente del proyecto.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID del proyecto.' },
        noteId: { type: 'string', description: 'ID de la nota A Resolver a actualizar.' },
        text: { type: 'string', description: 'Texto actualizado de la nota.' }
      },
      required: ['projectId', 'noteId', 'text']
    }
  },
  {
    name: 'deleteResolveNote',
    description: 'Elimina una nota A Resolver existente del proyecto.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID del proyecto.' },
        noteId: { type: 'string', description: 'ID de la nota A Resolver a eliminar.' }
      },
      required: ['projectId', 'noteId']
    }
  },
  {
    name: 'listInspections',
    description: 'Lista las inspecciones existentes del proyecto.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID del proyecto.' }
      },
      required: ['projectId']
    }
  },
  {
    name: 'listResolveNotes',
    description: 'Lista las notas A Resolver del proyecto.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID del proyecto.' }
      },
      required: ['projectId']
    }
  },
  {
    name: 'semanticSearch',
    description: 'Realiza una búsqueda semántica básica en requisitos y símbolos del proyecto.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID del proyecto.' },
        query: { type: 'string', description: 'Término de búsqueda.' }
      },
      required: ['projectId', 'query']
    }
  },
  {
    name: 'searchDocuments',
    description: 'Busca documentos relevantes en el proyecto usando búsqueda semántica basada en embeddings.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID del proyecto.' },
        query: { type: 'string', description: 'Consulta de búsqueda para encontrar documentos relevantes.' }
      },
      required: ['projectId', 'query']
    }
  },
  {
    name: 'saveMemory',
    description: 'Guarda información de memoria relevante para el usuario y el proyecto.',
    parameters: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'ID del usuario asociado a la memoria.' },
        projectId: { type: 'string', description: 'ID del proyecto relacionado.' },
        type: { type: 'string', description: 'Tipo de memoria (insight, task, conclusion, request, etc.).' },
        content: { type: 'string', description: 'Contenido de la memoria a guardar.' },
        source: { type: 'string', description: 'Origen de la memoria (por ejemplo, agent, user).' }
      },
      required: ['userId', 'type', 'content']
    }
  },
  {
    name: 'analyzeRequirement',
    description: 'Analiza la calidad de un requisito específico, detectando problemas de ambigüedad, inconsistencias y riesgos.',
    parameters: {
      type: 'object',
      properties: {
        requirementId: { type: 'string', description: 'ID del requisito a analizar.' },
        projectId: { type: 'string', description: 'ID del proyecto.' }
      },
      required: ['requirementId', 'projectId']
    }
  },
  {
    name: 'getImpactGraph',
    description: 'Obtiene el grafo de dependencias y relaciones de una entidad para análisis de impacto. Usa entityId y entityType para devolver relaciones directas e indirectas.',
    parameters: {
      type: 'object',
      properties: {
        entityId: { type: 'string', description: 'ID de la entidad a analizar.' },
        entityType: { type: 'string', description: 'Tipo de entidad (requirement, symbol, scenario, task, inspection).' },
        projectId: { type: 'string', description: 'ID del proyecto.' }
      },
      required: ['entityId', 'entityType', 'projectId']
    }
  },
  {
    name: 'getEntityGraph',
    description: 'Obtiene el grafo de la entidad indicada. Permite usar entityName para buscar una entidad por nombre y devolver sus relaciones.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID del proyecto.' },
        entityType: { type: 'string', description: 'Tipo de la entidad (requirement, symbol, scenario, task, inspection).' },
        entityId: { type: 'string', description: 'ID de la entidad a analizar.' },
        entityName: { type: 'string', description: 'Nombre de la entidad a resolver si no se conoce su ID.' }
      },
      required: ['projectId']
    }
  },
  {
    name: 'findEntityByName',
    description: 'Resuelve el ID y tipo de entidad a partir de un nombre, para poder consultar dependencias y grafo.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID del proyecto.' },
        entityType: { type: 'string', description: 'Tipo de entidad a buscar (requirement, symbol, scenario, task, inspection). Opcional.' },
        name: { type: 'string', description: 'Nombre de la entidad.' }
      },
      required: ['projectId', 'name']
    }
  },
  {
    name: 'createRelation',
    description: 'Crea una relación entre dos entidades del proyecto.',
    parameters: {
      type: 'object',
      properties: {
        fromType: { type: 'string', description: 'Tipo de la entidad origen.' },
        fromId: { type: 'string', description: 'ID de la entidad origen.' },
        toType: { type: 'string', description: 'Tipo de la entidad destino.' },
        toId: { type: 'string', description: 'ID de la entidad destino.' },
        type: { type: 'string', description: 'Tipo de relación (depends_on, implements, related_to, blocks, affects, references).' },
        projectId: { type: 'string', description: 'ID del proyecto.' },
        strength: { type: 'number', description: 'Fuerza de la relación (1-10).' }
      },
      required: ['fromType', 'fromId', 'toType', 'toId', 'type', 'projectId']
    }
  },
  {
    name: 'analyzeImpact',
    description: 'Analiza el impacto de una entidad en el proyecto usando el grafo de relaciones.',
    parameters: {
      type: 'object',
      properties: {
        entityId: { type: 'string', description: 'ID de la entidad a analizar.' },
        entityType: { type: 'string', description: 'Tipo de entidad (requirement, symbol, scenario, task, inspection).' },
        projectId: { type: 'string', description: 'ID del proyecto.' }
      },
      required: ['entityId', 'entityType', 'projectId']
    }
  },
  {
    name: 'getProjectGraph',
    description: 'Obtiene el grafo completo del proyecto con nodos y relaciones para análisis visual y estructural.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID del proyecto.' }
      },
      required: ['projectId']
    }
  },
  {
    name: 'getProjectSummary',
    description: 'Obtiene un resumen del proyecto con estadísticas de símbolos, requisitos, escenarios, inspecciones, tareas y relaciones.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID del proyecto.' }
      },
      required: ['projectId']
    }
  },
  {
    name: 'generateGraphRelations',
    description: 'Genera automáticamente relaciones entre entidades del proyecto usando análisis de similitud de embeddings. Crea relaciones basadas en la semántica de símbolos y requisitos.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID del proyecto.' },
        threshold: { type: 'number', description: 'Umbral de similitud (0-1) para crear relaciones. Default: 0.65.' }
      },
      required: ['projectId']
    }
  },
  {
    name: 'suggestEntityRelations',
    description: 'Sugiere relaciones potenciales para una entidad específica basadas en similitud semántica. No crea relaciones, solo sugiere.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID del proyecto.' },
        entityId: { type: 'string', description: 'ID de la entidad.' },
        entityType: { type: 'string', description: 'Tipo de la entidad (symbol, requirement, scenario, task, inspection).' },
        threshold: { type: 'number', description: 'Umbral de similitud (0-1). Default: 0.65.' }
      },
      required: ['projectId', 'entityId', 'entityType']
    }
  },
  {
    name: 'optimizeProject',
    description: 'Analiza y propone optimizaciones estructurales para el proyecto completo.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID del proyecto.' }
      },
      required: ['projectId']
    }
  }
];

export const toolImplementations = {
  createRequirement,
  getRequirements,
  getRequirement,
  updateRequirement,
  deleteRequirement,
  createSymbol,
  listSymbols,
  getSymbol,
  updateSymbol,
  deleteSymbol,
  createScenario,
  getScenario,
  updateScenario,
  deleteScenario,
  listScenarios,
  createInspection,
  getInspection,
  listInspections,
  updateInspection,
  deleteInspection,
  createResolveNote,
  getResolveNote,
  listResolveNotes,
  updateResolveNote,
  deleteResolveNote,
  getProject,
  semanticSearch,
  searchDocuments,
  saveMemory,
  analyzeRequirement,
  getImpactGraph,
  getProjectGraph,
  getProjectSummary,
  getEntityGraph,
  findEntityByName,
  createRelation,
  deleteRelation,
  generateGraphRelations,
  suggestEntityRelations,
  analyzeImpact,
  optimizeProject
};
