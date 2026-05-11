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
  const roleDescriptions = {
    'super_admin': 'Super Administrator (full access to all features)',
    'admin': 'Project Administrator (full access to all project features)',
    'usuario': 'Regular User (can create/edit symbols, scenarios, requirements, inspections, resolve notes; can only mark tasks completed)',
    'invitado': 'Guest/Contributor (read-only access to all sections)'
  };

  const fullMessages = [
    {
      role: 'system',
      content: SYSTEM_PROMPT
    },
    {
      role: 'system',
      content: `Project Context: ${context.projectId || 'No project selected'}`
    },
    {
      role: 'system',
      content: `Current User: ID=${context.userId || 'unknown'} | Global Role: ${context.userRole || 'unknown'} (${roleDescriptions[context.userRole] || 'unknown'}) | Project Role: ${context.projectRole || 'invitado'} (${roleDescriptions[context.projectRole] || 'unknown'})`
    },
    ...await buildMemoryMessages(context),
    ...messages
  ];

  return await streamGemini(fullMessages, onChunk, context);
}

export { streamChat };
