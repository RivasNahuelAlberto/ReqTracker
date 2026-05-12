import OpenAI from 'openai';
import { getProjectSnapshot } from './tools/projectSnapshot.tool.js';
import { getProjectGraph } from './tools/graph.tool.js';

const openaiApiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
const openaiBaseURL = process.env.OPENAI_API_KEY
  ? 'https://api.openai.com/v1'
  : process.env.OPENROUTER_API_BASE_URL || 'https://openrouter.ai/api/v1';

function createOpenAIClient() {
  if (!openaiApiKey) {
    throw new Error('OpenAI o OpenRouter API key es requerida para recomendaciones.');
  }
  return new OpenAI({ apiKey: openaiApiKey, baseURL: openaiBaseURL });
}

export async function getRecommendations(req, res) {
  try {
    const { projectId, contextText = '', activeEntityId = '' } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId es requerido.' });
    }

    const snapshot = await getProjectSnapshot({ projectId });
    const graph = await getProjectGraph({ projectId });

    const prompt = `Sos un copiloto de ingeniería de requisitos en tiempo real.\n\nTu tarea:\nDar sugerencias inmediatas mientras el usuario actúa dentro del proyecto.\n\nTIPOS DE ALERTAS:\n- ambiguidad\n- duplicados\n- mejoras de redacción\n- riesgos técnicos\n- inconsistencias con el sistema\n\nRESPUESTA:\n- lista de recomendaciones cortas\n- con severidad (low, medium, high)\n- accionables\n`;

    const client = createOpenAIClient();
    const response = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: prompt },
        {
          role: 'user',
          content: `CONTEXTO ACTIVO:\n${contextText}\n\nENTIDAD ACTIVA:\n${activeEntityId}\n\nPROYECTO:\n${JSON.stringify(snapshot, null, 2)}\n\nRELACIONES:\n${JSON.stringify(graph, null, 2)}`
        }
      ]
    });

    const recommendations = response?.choices?.[0]?.message?.content?.trim() || '';
    res.json({ recommendations });
  } catch (err) {
    console.error('Error en recomendaciones:', err);
    res.status(500).json({ error: err.message || 'Error en recomendaciones' });
  }
}
