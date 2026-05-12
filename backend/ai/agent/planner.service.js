import OpenAI from 'openai';

const openaiApiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
const openaiBaseURL = process.env.OPENAI_API_KEY
  ? 'https://api.openai.com/v1'
  : process.env.OPENROUTER_API_BASE_URL || 'https://openrouter.ai/api/v1';

function createOpenAIClient() {
  if (!openaiApiKey) {
    throw new Error('OpenAI o OpenRouter API key es requerida para el agente.');
  }
  return new OpenAI({ apiKey: openaiApiKey, baseURL: openaiBaseURL });
}

export async function createPlan({ goal, snapshot, graph, feedback }) {
  if (!goal || !snapshot || !graph) {
    throw new Error('goal, snapshot y graph son requeridos para crear un plan.');
  }

  const systemPrompt = `Sos un arquitecto de software senior.\n\nTu tarea es dividir objetivos en pasos ejecutables.\n\nCada paso debe:\n- usar una tool posible\n- ser concreto\n- ser secuencial\n`;

  const userPrompt = `OBJETIVO:\n${goal}\n\nPROYECTO:\n${JSON.stringify(snapshot, null, 2)}\n\nGRAFO:\n${JSON.stringify(graph, null, 2)}\n\nSi recibís feedback, consideralo para ajustar el siguiente plan.\n\nRESPUESTA EN FORMATO JSON:\n{\n  "steps": [\n    {"description": "...", "tool": "createRequirement", "args": {"projectId": "...", "name": "..."}}\n  ]\n}\n`;

  const promptMessages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  if (feedback) {
    promptMessages.push({ role: 'assistant', content: `Feedback anterior:\n${feedback}` });
  }

  const client = createOpenAIClient();
  const response = await client.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: promptMessages
  });

  return response?.choices?.[0]?.message?.content?.trim() || '';
}
