import OpenAI from 'openai';

const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001';
const openRouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: process.env.OPENROUTER_API_BASE_URL || 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://reqtracker.example.com',
    'X-Title': process.env.APP_TITLE || 'ReqTracker'
  },
  timeout: 30000
});

function joinMessages(messages) {
  return messages.map(m => `${m.role}: ${m.content}`).join('\n');
}

export async function callGemini(messages) {
  const response = await openRouter.chat.completions.create({
    model: OPENROUTER_MODEL,
    messages,
    max_tokens: 512,
    temperature: 0.7
  });

  return response.choices?.[0]?.message?.content || '';
}

export async function streamGemini(messages, onChunk) {
  const response = await callGemini(messages);
  if (onChunk) onChunk(response);
  return response;
}

