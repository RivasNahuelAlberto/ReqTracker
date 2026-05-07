import { callGemini as providerCallGemini, streamGemini } from './gemini.provider.js';
import { SYSTEM_PROMPT } from './prompts/system.prompt.js';

async function callGemini({ messages }) {
  try {
    return await providerCallGemini(messages);
  } catch (error) {
    if (!process.env.OPENROUTER_API_KEY && !process.env.OPENAI_API_KEY) {
      return 'Esta es una respuesta de prueba. Para usar IA real, configura OPENROUTER_API_KEY o OPENAI_API_KEY con una clave válida.';
    }
    throw error;
  }
}

async function streamChat({ provider = 'gemini', messages, context = {}, onChunk }) {
  const fullMessages = [
    {
      role: 'system',
      content: SYSTEM_PROMPT
    },
    {
      role: 'system',
      content: `Contexto actual:\nProyecto: ${context.projectId || 'N/A'}`
    },
    ...messages
  ];

  return await streamGemini(fullMessages, onChunk);
}

export { streamChat };
