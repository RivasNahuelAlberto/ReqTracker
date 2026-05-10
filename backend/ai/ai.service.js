import { streamGemini } from './gemini.provider.js';
import { SYSTEM_PROMPT } from './prompts/system.prompt.js';
import { getRecentMemory } from './memory.service.js';

async function buildMemoryMessages({ userId, projectId }) {
  if (!userId) {
    return [];
  }

  const memories = await getRecentMemory({ userId, projectId, limit: 5 });
  if (!memories.length) {
    return [];
  }

  const memorySummary = memories
    .map((memory, index) => `${index + 1}. [${memory.type}] ${memory.content}`)
    .join('\n');

  return [
    {
      role: 'system',
      content: `Memoria relevante disponible para este usuario y proyecto:\n${memorySummary}`
    }
  ];
}

async function streamChat({ provider = 'gemini', messages, context = {}, onChunk }) {
  const fullMessages = [
    {
      role: 'system',
      content: SYSTEM_PROMPT
    },
    {
      role: 'system',
      content: `Contexto del proyecto: ${context.projectId || 'sin proyecto'}`
    },
    {
      role: 'system',
      content: `Usuario autenticado: ${context.userId || 'desconocido'}, Rol global: ${context.userRole || 'desconocido'}, Rol en proyecto: ${context.projectRole || 'invitado'}`
    },
    ...await buildMemoryMessages(context),
    ...messages
  ];

  return await streamGemini(fullMessages, onChunk, context);
}

export { streamChat };
