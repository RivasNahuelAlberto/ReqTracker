import { createRequirement, getRequirements } from './requirements.tool.js';
import { getProject } from './project.tool.js';
import { listSymbols } from './symbols.tool.js';
import { semanticSearch } from './semantic.tool.js';

export const toolDefinitions = [
  {
    name: 'createRequirement',
    description: 'Crea un nuevo requisito dentro del proyecto.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID del proyecto donde se crea el requisito.' },
        name: { type: 'string', description: 'Título del requisito.' },
        description: { type: 'string', description: 'Descripción del requisito.' },
        type: { type: 'string', description: 'Tipo de requisito.' },
        basis: { type: 'string', description: 'Base o razón del requisito.' },
        priority: { type: 'string', enum: ['Alta', 'Media', 'Baja'] },
        criticidad: { type: 'string', enum: ['Alta', 'Media', 'Baja'] },
        costoImplementacion: { type: 'string', enum: ['Alto', 'Medio', 'Bajo'] },
        volatilidad: { type: 'string', enum: ['Alta', 'Media', 'Baja'] },
        factibilidad: { type: 'string', enum: ['Alta', 'Media', 'Baja'] },
        riesgo: { type: 'string', enum: ['Alto', 'Medio', 'Bajo'] }
      },
      required: ['projectId', 'name', 'description']
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
  }
];

export const toolImplementations = {
  createRequirement,
  getProject,
  listSymbols,
  getRequirements,
  semanticSearch
};
