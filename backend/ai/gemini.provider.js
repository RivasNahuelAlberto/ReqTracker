import OpenAI from 'openai';
import { toolDefinitions, toolImplementations } from './tools/index.js';
import AIActionLog from '../models/AIActionLog.js';

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

async function logAIAction(actionName, input, output, projectId = null) {
  try {
    await AIActionLog.create({
      projectId,
      actionName,
      input,
      output
    });
  } catch (err) {
    console.error('Error guardando AI action log:', err);
  }
}

export async function callGemini(messages) {
  const response = await openRouter.chat.completions.create({
    model: OPENROUTER_MODEL,
    messages,
    max_tokens: 512,
    temperature: 0.7,
    functions: toolDefinitions,
    function_call: 'auto'
  });

  const choice = response.choices?.[0];
  const message = choice?.message;

  if (message?.function_call) {
    const functionName = message.function_call.name;
    let functionArgs = {};

    try {
      functionArgs = JSON.parse(message.function_call.arguments || '{}');
    } catch (error) {
      throw new Error('No se pudieron parsear los argumentos de la función.');
    }

    const tool = toolImplementations[functionName];
    if (!tool) {
      throw new Error(`Tool no encontrada: ${functionName}`);
    }

    const toolResult = await tool(functionArgs);
    await logAIAction(functionName, functionArgs, toolResult, functionArgs.projectId);

    const followUp = await openRouter.chat.completions.create({
      model: OPENROUTER_MODEL,
      messages: [
        ...messages,
        message,
        {
          role: 'function',
          name: functionName,
          content: JSON.stringify(toolResult)
        }
      ],
      max_tokens: 512,
      temperature: 0.7
    });

    return followUp.choices?.[0]?.message?.content || JSON.stringify(toolResult);
  }

  return message?.content || '';
}

export async function streamGemini(messages, onChunk) {
  const responseText = await callGemini(messages);
  if (onChunk) onChunk(responseText);
  return responseText;
}

