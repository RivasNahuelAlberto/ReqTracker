import OpenAI from 'openai';
import { tools, toolImplementations } from './tools/index.js';
import AIActionLog from '../models/AIActionLog.js';

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const aiApiKey = OPENAI_KEY || OPENROUTER_KEY;
const aiBaseURL = OPENAI_KEY
  ? 'https://api.openai.com/v1'
  : (OPENROUTER_KEY ? process.env.OPENROUTER_API_BASE_URL || 'https://openrouter.ai/api/v1' : null);

const aiModel = OPENAI_KEY ? OPENAI_MODEL : (OPENROUTER_KEY ? OPENROUTER_MODEL : null);
const AI_MAX_TOKENS = parseInt(process.env.AI_MAX_TOKENS || '1024', 10);
const AI_CONTINUATION_MAX_CYCLES = parseInt(process.env.AI_CONTINUATION_MAX_CYCLES || '2', 10);

if (!aiApiKey) {
  console.error('AI API key is not configured. Set OPENROUTER_API_KEY or OPENAI_API_KEY.');
}

const openRouter = new OpenAI({
  apiKey: aiApiKey,
  baseURL: aiBaseURL,
  defaultHeaders: OPENROUTER_KEY ? {
    'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://reqtracker.example.com',
    'X-Title': process.env.APP_TITLE || 'ReqTracker'
  } : {},
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

function normalizeToolArguments(functionName, args, context) {
  const normalized = { ...args };
  if (!normalized.userId && context.userId) {
    normalized.userId = context.userId;
  }
  if (!normalized.projectId && context.projectId) {
    normalized.projectId = context.projectId;
  }
  return normalized;
}

function parseJsonStructuredOutput(content) {
  if (!content || typeof content !== 'string') {
    return null;
  }

  const trimmed = content.trim();
  const candidates = [];
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    candidates.push(trimmed);
  }

  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    candidates.push(jsonMatch[0]);
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && ('action' in parsed || 'args' in parsed)) {
        return parsed;
      }
    } catch (e) {
      // ignore
    }
  }

  return null;
}

export async function callGemini(messages, context = {}) {
  if (!aiApiKey) {
    throw new Error('AI provider API key not configured. Set OPENROUTER_API_KEY or OPENAI_API_KEY.');
  }

  console.log('Using AI provider:', { model: aiModel, baseURL: aiBaseURL, hasOpenAI: !!OPENAI_KEY, hasOpenRouter: !!OPENROUTER_KEY });

  let conversationMessages = [...messages];
  const maxToolCycles = 4;
  let lastToolResult = null;
  let retryCount = 0;
  const maxRetries = 3;

  const formattedTools = tools.map((tool) => {
    if (tool.type === 'function') {
      return tool;
    }

    const { name, description, parameters, ...rest } = tool;
    return {
      type: 'function',
      function: {
        name,
        description,
        parameters,
        ...rest
      }
    };
  });

  console.log('Formatted tools:', JSON.stringify(formattedTools, null, 2));

  for (let cycle = 0; cycle < maxToolCycles; cycle += 1) {
    try {
      const response = await openRouter.chat.completions.create({
        model: aiModel,
        messages: conversationMessages,
        max_tokens: AI_MAX_TOKENS,
        temperature: 0.7,
        tools: formattedTools,
        tool_choice: 'auto'
      });

      console.log('AI response:', JSON.stringify(response, null, 2));

      const choice = response.choices?.[0];
      if (choice?.error) {
        console.error('AI response error:', choice.error);
        if (choice.error.code === 429) {
          if (retryCount < maxRetries) {
            retryCount += 1;
            const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
            console.log(`Rate limit exceeded, retrying in ${delay}ms (attempt ${retryCount}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          } else {
            throw new Error('Rate limit exceeded, max retries reached');
          }
        } else {
          throw new Error(`AI error: ${choice.error.message}`);
        }
      }

      const message = choice?.message;
      if (!message) {
        break;
      }

      const toolCalls = message.tool_calls || [];
      if (toolCalls.length) {
        const toolCall = toolCalls[0];
        const toolCallId = toolCall.id || toolCall.tool_call_id || toolCall.tool_call_id || toolCall.tool?.id || toolCall.tool?.tool_call_id;
        const functionName = toolCall.function?.name || toolCall.name || toolCall.tool?.name;
        let functionArgs = {};

        try {
          functionArgs = JSON.parse(toolCall.function?.arguments || '{}');
        } catch (error) {
          throw new Error('No se pudieron parsear los argumentos de la función.');
        }

        if (!toolCallId) {
          throw new Error('Tool call no proporcionó un tool_call_id válido.');
        }

        console.log('AI requested tool call:', { functionName, functionArgs, toolCallId, projectId: context.projectId, userId: context.userId });
        functionArgs = normalizeToolArguments(functionName, functionArgs, context);
        const tool = toolImplementations[functionName];
        if (!tool) {
          throw new Error(`Tool no encontrada: ${functionName}`);
        }

        let toolResult;
        try {
          toolResult = await tool(functionArgs);
        } catch (error) {
          console.error('Tool execution failed:', error);
          toolResult = {
            error: error.message || 'Error interno en la herramienta',
            functionName,
            functionArgs
          };
        }

        console.log('Tool executed successfully:', { functionName, functionArgs, toolResult });
        lastToolResult = toolResult;
        await logAIAction(functionName, functionArgs, toolResult, functionArgs.projectId || context.projectId);

        conversationMessages.push(message);
        conversationMessages.push({
          role: 'tool',
          name: functionName,
          tool_call_id: toolCallId,
          content: JSON.stringify(toolResult)
        });
        continue;
      }

      if (message.function_call) {
        const functionName = message.function_call.name;
        let functionArgs = {};

        try {
          functionArgs = JSON.parse(message.function_call.arguments || '{}');
        } catch (error) {
          throw new Error('No se pudieron parsear los argumentos de la función.');
        }

        console.log('AI requested fallback function_call:', { functionName, functionArgs, projectId: context.projectId, userId: context.userId });
        functionArgs = normalizeToolArguments(functionName, functionArgs, context);
        const tool = toolImplementations[functionName];
        if (!tool) {
          throw new Error(`Tool no encontrada: ${functionName}`);
        }

        let toolResult;
        try {
          toolResult = await tool(functionArgs);
        } catch (error) {
          console.error('Fallback tool execution failed:', error);
          toolResult = {
            error: error.message || 'Error interno en la herramienta',
            functionName,
            functionArgs
          };
        }

        console.log('Tool executed successfully (fallback):', { functionName, functionArgs, toolResult });
        lastToolResult = toolResult;
        await logAIAction(functionName, functionArgs, toolResult, functionArgs.projectId || context.projectId);

        conversationMessages.push(message);
        conversationMessages.push({
          role: 'function',
          name: functionName,
          content: JSON.stringify(toolResult)
        });
        continue;
      }

      const finishedByLength = choice.finish_reason === 'length';
      console.log('No tool calls in response, message content:', message.content, { finishedByLength, finish_reason: choice.finish_reason });
      if (message.content) {
        if (finishedByLength) {
          conversationMessages.push(message);
          conversationMessages.push({
            role: 'user',
            content: 'Continúa la respuesta anterior desde donde quedó, sin repetir lo ya dicho.'
          });
          console.log('AI response truncated by token limit, requesting continuation...');
          continue;
        }

        const structured = parseJsonStructuredOutput(message.content);
        if (structured && structured.action) {
          const functionName = structured.action;
          const functionArgs = normalizeToolArguments(functionName, structured.args || {}, context);
          console.log('Detected structured JSON action:', { functionName, functionArgs, projectId: context.projectId, userId: context.userId });

          const tool = toolImplementations[functionName];
          if (tool) {
            const toolResult = await tool(functionArgs);
            console.log('Tool executed successfully (structured JSON):', { functionName, functionArgs, toolResult });
            lastToolResult = toolResult;
            await logAIAction(functionName, functionArgs, toolResult, functionArgs.projectId || context.projectId);
            return JSON.stringify(toolResult);
          }

          console.error(`Structured action tool not found: ${functionName}`);
        }

        // Fallback: try to parse text-based tool calls (for models that don't support structured tool_calls)
        const toolPatterns = [
          { regex: /createRequirement\s*\(([^)]+)\)/, name: 'createRequirement' },
          { regex: /createSymbol\s*\(([^)]+)\)/, name: 'createSymbol' },
          { regex: /createScenario\s*\(([^)]+)\)/, name: 'createScenario' },
          { regex: /updateRequirement\s*\(([^)]+)\)/, name: 'updateRequirement' },
          { regex: /updateSymbol\s*\(([^)]+)\)/, name: 'updateSymbol' },
          { regex: /updateScenario\s*\(([^)]+)\)/, name: 'updateScenario' },
          { regex: /deleteRequirement\s*\(([^)]+)\)/, name: 'deleteRequirement' },
          { regex: /deleteSymbol\s*\(([^)]+)\)/, name: 'deleteSymbol' },
          { regex: /deleteScenario\s*\(([^)]+)\)/, name: 'deleteScenario' }
        ];

        for (const pattern of toolPatterns) {
          const match = message.content.match(pattern.regex);
          if (match) {
            console.log(`Detected text-based tool call for ${pattern.name}, parsing manually...`);
            const argsString = match[1];
            const functionName = pattern.name;
            let functionArgs = {};

            try {
              const args = {};
              const pairs = argsString.split(',').map(s => s.trim());
              for (const pair of pairs) {
                const [key, value] = pair.split('=');
                if (key && value) {
                  const cleanKey = key.trim();
                  let cleanValue = value.trim().replace(/^['"]|['"]$/g, '');
                  if (cleanValue.startsWith('{') || cleanValue.startsWith('[')) {
                    try {
                      cleanValue = JSON.parse(cleanValue);
                    } catch (e) {
                      // Keep as string if parsing fails
                    }
                  }
                  args[cleanKey] = cleanValue;
                }
              }
              functionArgs = args;
            } catch (error) {
              console.error('Failed to parse text-based tool call:', error);
              continue;
            }

            console.log('Parsed text-based tool call:', { functionName, functionArgs, projectId: context.projectId, userId: context.userId });
            functionArgs = normalizeToolArguments(functionName, functionArgs, context);
            const tool = toolImplementations[functionName];
            if (!tool) {
              console.error(`Tool no encontrada: ${functionName}`);
              continue;
            }

            const toolResult = await tool(functionArgs);
            console.log('Tool executed successfully (text-based):', { functionName, functionArgs, toolResult });
            lastToolResult = toolResult;
            await logAIAction(functionName, functionArgs, toolResult, functionArgs.projectId || context.projectId);
            return JSON.stringify(toolResult);
          }
        }

        return message.content;
      }
    } catch (error) {
      console.error('Error calling AI:', error);
      if (error.status === 429 && retryCount < maxRetries) {
        retryCount += 1;
        const delay = Math.pow(2, retryCount) * 1000;
        console.log(`Rate limit error, retrying in ${delay}ms (attempt ${retryCount}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      } else {
        throw error;
      }
    }
  }

  if (lastToolResult !== null) {
    return JSON.stringify(lastToolResult);
  }

  return 'No se pudo obtener respuesta del modelo.';
}

async function streamGeminiProvider(messages, onChunk, context = {}, remainingContinuations = AI_CONTINUATION_MAX_CYCLES) {
  if (!aiApiKey) {
    throw new Error('AI provider API key not configured. Set OPENROUTER_API_KEY or OPENAI_API_KEY.');
  }

  let conversationMessages = [...messages];
  const formattedTools = tools.map((tool) => {
    if (tool.type === 'function') {
      return tool;
    }

    const { name, description, parameters, ...rest } = tool;
    return {
      type: 'function',
      function: {
        name,
        description,
        parameters,
        ...rest
      }
    };
  });

  const response = await openRouter.chat.completions.create({
    model: aiModel,
    messages: conversationMessages,
    max_tokens: AI_MAX_TOKENS,
    temperature: 0.7,
    tools: formattedTools,
    tool_choice: 'auto',
    stream: true
  });

  let assistantResponse = '';
  let currentToolCall = null;
  let currentToolMessage = '';
  const toolCalls = [];
  let finishReason = null;

  for await (const event of response) {
    if (event.type === 'response.delta') {
      const delta = event.delta;

      if (delta.type === 'tool_call') {
        currentToolCall = {
          id: delta.tool_call_id,
          name: delta.name,
          arguments: delta.arguments
        };
        currentToolMessage = '';
        toolCalls.push(currentToolCall);
        continue;
      }

      if (delta.type === 'tool_message' && currentToolCall) {
        currentToolMessage += delta.content || '';
        continue;
      }

      if (delta.content) {
        assistantResponse += delta.content;
        if (onChunk) {
          onChunk(delta.content);
        }
      }

      if (delta.finish_reason) {
        finishReason = delta.finish_reason;
      }
    }

    if (event.type === 'response.completed') {
      finishReason = event.finish_reason || event.response?.finish_reason || finishReason;
      break;
    }

    if (event.type === 'response.error') {
      throw new Error(event.error?.message || 'AI stream error');
    }
  }

  const truncatedReasons = ['length', 'max_tokens', 'token_limit', 'early_stop'];
  const wasTruncated = finishReason && truncatedReasons.includes(finishReason);

  if (toolCalls.length && currentToolCall) {
    const toolCall = currentToolCall;
    let functionArgs = {};
    try {
      functionArgs = JSON.parse(toolCall.arguments || '{}');
    } catch (error) {
      throw new Error('No se pudieron parsear los argumentos de la llamada a la herramienta desde el stream.');
    }

    functionArgs = normalizeToolArguments(toolCall.name, functionArgs, context);
    const tool = toolImplementations[toolCall.name];
    if (!tool) {
      throw new Error(`Tool no encontrada: ${toolCall.name}`);
    }

    const toolResult = await tool(functionArgs);
    await logAIAction(toolCall.name, functionArgs, toolResult, functionArgs.projectId || context.projectId);

    conversationMessages.push({ role: 'assistant', content: assistantResponse });
    conversationMessages.push({
      role: 'tool',
      name: toolCall.name,
      tool_call_id: toolCall.id,
      content: JSON.stringify(toolResult)
    });

    return streamGeminiProvider(conversationMessages, onChunk, context, remainingContinuations);
  }

  if (wasTruncated && remainingContinuations > 0) {
    console.log('AI response was truncated by finish_reason:', finishReason, 'continuing response...');
    conversationMessages.push({ role: 'assistant', content: assistantResponse });
    conversationMessages.push({
      role: 'user',
      content: 'Continúa la respuesta anterior desde donde quedó, sin repetir lo ya dicho. Completa el análisis con el contexto anterior.'
    });
    return streamGeminiProvider(conversationMessages, onChunk, context, remainingContinuations - 1);
  }

  if (wasTruncated) {
    console.warn('AI response was truncated and continuation limit reached:', finishReason);
  }

  return assistantResponse;
}

export async function streamGemini(messages, onChunk, context = {}) {
  return streamGeminiProvider(messages, onChunk, context);
}

