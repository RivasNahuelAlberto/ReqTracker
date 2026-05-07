import OpenAI from 'openai';
import { toolDefinitions, toolImplementations } from './tools/index.js';
import AIActionLog from '../models/AIActionLog.js';

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const aiApiKey = OPENROUTER_KEY || OPENAI_KEY;
const aiBaseURL = OPENROUTER_KEY
  ? process.env.OPENROUTER_API_BASE_URL || 'https://openrouter.ai/api/v1'
  : 'https://api.openai.com/v1';

const aiModel = OPENROUTER_KEY ? OPENROUTER_MODEL : OPENAI_MODEL;

if (!aiApiKey) {
  console.error('AI API key is not configured. Set OPENROUTER_API_KEY or OPENAI_API_KEY.');
}

const openRouter = new OpenAI({
  apiKey: aiApiKey,
  baseURL: aiBaseURL,
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
  if (!aiApiKey) {
    throw new Error('AI provider API key not configured. Set OPENROUTER_API_KEY or OPENAI_API_KEY.');
  }

  const response = await openRouter.chat.completions.create({
    model: aiModel,
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
      model: aiModel,
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

