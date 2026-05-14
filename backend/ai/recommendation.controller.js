import OpenAI from 'openai';
import { getProjectSnapshot } from './tools/projectSnapshot.tool.js';
import { getProjectGraph } from './tools/graph.tool.js';
import { compileContext } from './context-compiler.js';
import StructuredLogger from './logger/structured.logger.js';

const logger = new StructuredLogger('recommendation-controller');

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
    const rawGraph = await getProjectGraph({ projectId });

    // GRAPH CONTRACT NORMALIZATION
    let graph = [];
    if (rawGraph && typeof rawGraph === 'object') {
      if (Array.isArray(rawGraph)) {
        graph = rawGraph;
      } else if (Array.isArray(rawGraph.relations)) {
        graph = rawGraph.relations;
      } else if (Array.isArray(rawGraph.nodes)) {
        graph = rawGraph.nodes;
      }
    }

    let compressedContext = 'No hay relaciones disponibles';
    if (Array.isArray(graph) && graph.length > 0) {
      try {
        const contextPack = await compileContext({ projectId, goal: activeEntityId || contextText || 'recomendaciones', graph, maxContextNodes: 15 });
        compressedContext = contextPack.summary || JSON.stringify(contextPack.relations.slice(0, 10), null, 2);
      } catch (e) {
        compressedContext = JSON.stringify(graph.slice(0, 5), null, 2);
      }
    }

    const prompt = `Sos un copiloto de ingeniería de requisitos en tiempo real.\n\nTu tarea:\nDar sugerencias inmediatas mientras el usuario actúa dentro del proyecto.\n\nTIPOS DE ALERTAS:\n- ambiguidad\n- duplicados\n- mejoras de redacción\n- riesgos técnicos\n- inconsistencias con el sistema\n\nRESPUESTA:\n- lista de recomendaciones cortas\n- con severidad (low, medium, high)\n- accionables\n`;

    const client = createOpenAIClient();
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt },
        {
          role: 'user',
          content: `CONTEXTO ACTIVO:\n${contextText.slice(0, 500)}\n\nENTIDAD ACTIVA:\n${activeEntityId.slice(0, 200)}\n\nPROYECTO:\n${JSON.stringify({symbols: snapshot.counts?.symbols, requirements: snapshot.counts?.requirements}, null, 2)}\n\nRELACIONES:\n${compressedContext}`
        }
      ],
      temperature: 0.3,
      max_tokens: 1500
    });

    const recommendations = response?.choices?.[0]?.message?.content?.trim() || '';
    res.json({ recommendations });
  } catch (err) {
    if (err.status === 402) {
      return res.json({ recommendations: 'Sistema de recomendaciones no disponible.', fallback: true });
    }
    res.status(500).json({ error: err.message || 'Error en recomendaciones' });
  }
}
