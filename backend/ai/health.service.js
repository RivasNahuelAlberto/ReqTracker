import OpenAI from 'openai';

const openaiApiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
const openaiBaseURL = process.env.OPENAI_API_KEY
  ? 'https://api.openai.com/v1'
  : process.env.OPENROUTER_API_BASE_URL || 'https://openrouter.ai/api/v1';

function createOpenAIClient() {
  if (!openaiApiKey) {
    throw new Error('OpenAI o OpenRouter API key es requerida para análisis de salud.');
  }
  return new OpenAI({ apiKey: openaiApiKey, baseURL: openaiBaseURL });
}

export async function analyzeHealth({ snapshot, graph }) {
  if (!snapshot || !graph) {
    throw new Error('Snapshot y grafo son requeridos para analizar la salud.');
  }

  const client = createOpenAIClient();
  const response = await client.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [
      {
        role: 'system',
        content: `Sos un sistema de monitoreo de salud de software. Detectás problemas estructurales automáticamente.\n\nTIPOS:\n- duplicación\n- ambigüedad\n- inconsistencias\n- deuda técnica\n- sobreingeniería\n\nRESPUESTA:\nLista de problemas con sugerencias concretas.`
      },
      {
        role: 'user',
        content: `SNAPSHOT:\n${JSON.stringify(snapshot, null, 2)}\n\nGRAFO:\n${JSON.stringify(graph, null, 2)}`
      }
    ]
  });

  return response?.choices?.[0]?.message?.content?.trim() || '';
}
