import OpenAI from 'openai';

const openaiApiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
const openaiBaseURL = process.env.OPENAI_API_KEY
  ? 'https://api.openai.com/v1'
  : process.env.OPENROUTER_API_BASE_URL || 'https://openrouter.ai/api/v1';

function createOpenAIClient() {
  if (!openaiApiKey) {
    throw new Error('OpenAI o OpenRouter API key es requerida para crear explicaciones de fallo.');
  }
  return new OpenAI({ apiKey: openaiApiKey, baseURL: openaiBaseURL });
}

function formatTaskSteps(task) {
  if (!task?.steps || !Array.isArray(task.steps)) return 'No hay pasos disponibles.';
  return task.steps
    .map((step, index) => {
      const details = [`${index + 1}. ${step.description}`];
      details.push(`tool=${step.tool}`);
      details.push(`status=${step.status}`);
      if (step.error) {
        details.push(`error=${step.error}`);
      }
      return details.join(' | ');
    })
    .join('\n');
}

export async function createFailureExplanation({ goal, planText, task, failureStage = 'execution', error }) {
  const client = createOpenAIClient();
  const systemPrompt = `Eres un asistente de ingeniería de software que explica por qué un agente autónomo no pudo completar un pedido. Usa un lenguaje claro y enfocado en la corrección de la solicitud.`;
  const userPrompt = `Objetivo:
${goal}

Etapa de fallo: ${failureStage}

Plan generado:
${planText || 'No disponible'}

${task ? `Resultado de ejecución:\n${formatTaskSteps(task)}` : ''}

${error ? `Error técnico:
${error}` : ''}

Explica:
1) Qué falló.
2) Por qué falló.
3) Qué debe corregirse o cuál es la causa principal para que el agente tenga éxito la próxima vez.

Responde en un párrafo claro y directo.`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });

    return response?.choices?.[0]?.message?.content?.trim() || 'No se pudo generar una explicación de fallo.';
  } catch (err) {
    console.error('Error generating failure explanation:', err);
    return 'No se pudo crear una explicación detallada por un error interno del agente.';
  }
}
