import { createRequirement, getRequirements, getRequirement, updateRequirement, deleteRequirement } from './requirements.tool.js';
import { createSymbol, listSymbols, getSymbol, updateSymbol, deleteSymbol } from './symbols.tool.js';
import { createScenario, getScenario, updateScenario, deleteScenario, listScenarios } from './scenarios.tool.js';
import { getProject } from './project.tool.js';
import { semanticSearch } from './semantic.tool.js';
import { saveMemory } from './memory.tool.js';

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
  getProject,
  semanticSearch,
  searchDocuments,
  saveMemory
};
