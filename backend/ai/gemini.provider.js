import OpenAI from 'openai';
import { tools, toolImplementations } from './tools/index.js';
import AIActionLog from '../models/AIActionLog.js';

// Configuration
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const AI_MAX_TOKENS = parseInt(process.env.AI_MAX_TOKENS || '1024', 10);
const AI_CONTINUATION_MAX_CYCLES = parseInt(process.env.AI_CONTINUATION_MAX_CYCLES || '2', 10);

// Validate configuration
if (!OPENROUTER_KEY && !OPENAI_KEY) {
  console.error('⚠️  AI: No API keys configured. Set OPENROUTER_API_KEY or OPENAI_API_KEY.');
}

// Primary provider: OpenRouter
const openRouterClient = OPENROUTER_KEY ? new OpenAI({
  apiKey: OPENROUTER_KEY,
  baseURL: process.env.OPENROUTER_API_BASE_URL || 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://reqtracker.example.com',
    'X-Title': process.env.APP_TITLE || 'ReqTracker'
  },
  timeout: 30000
}) : null;

// Fallback provider: OpenAI
const openAIClient = OPENAI_KEY ? new OpenAI({
  apiKey: OPENAI_KEY,
  baseURL: 'https://api.openai.com/v1',
  timeout: 30000
}) : null;

// Circuit breaker state
const circuitBreakerState = {
  openRouter: { failures: 0, lastFailure: null, isOpen: false },
  openAI: { failures: 0, lastFailure: null, isOpen: false }
};

const CIRCUIT_BREAKER_THRESHOLD = parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '3', 10);
const CIRCUIT_BREAKER_RESET_MS = parseInt(process.env.CIRCUIT_BREAKER_RESET_MS || '60000', 10); // 1 minute

// Track provider usage statistics
const providerStats = {
  openRouter: { successCount: 0, failureCount: 0, totalMs: 0 },
  openAI: { successCount: 0, failureCount: 0, totalMs: 0 }
};

function resetCircuitBreakerIfReady(provider) {
  const state = circuitBreakerState[provider];
  if (state.isOpen && state.lastFailure) {
    const timeSinceFailure = Date.now() - state.lastFailure;
    if (timeSinceFailure > CIRCUIT_BREAKER_RESET_MS) {
      console.log(`🔄 Circuit breaker reset for ${provider}`);
      state.isOpen = false;
      state.failures = 0;
      state.lastFailure = null;
    }
  }
}

function recordProviderFailure(provider) {
  const state = circuitBreakerState[provider];
  state.failures += 1;
  state.lastFailure = Date.now();
  providerStats[provider].failureCount += 1;

  if (state.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    state.isOpen = true;
    console.log(`🔴 Circuit breaker OPEN for ${provider} after ${state.failures} failures`);
  }
}

function recordProviderSuccess(provider, durationMs) {
  const state = circuitBreakerState[provider];
  state.failures = 0;
  state.lastFailure = null;
  state.isOpen = false;
  providerStats[provider].successCount += 1;
  providerStats[provider].totalMs += durationMs;
}

function getProviderStats() {
  return {
    openRouter: {
      ...providerStats.openRouter,
      avgMs: providerStats.openRouter.successCount > 0 
        ? Math.round(providerStats.openRouter.totalMs / providerStats.openRouter.successCount) 
        : 0
    },
    openAI: {
      ...providerStats.openAI,
      avgMs: providerStats.openAI.successCount > 0 
        ? Math.round(providerStats.openAI.totalMs / providerStats.openAI.successCount) 
        : 0
    }
  };
}

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

/**
 * Call AI provider with automatic fallback
 * Priority: OpenRouter (primary) → OpenAI (fallback)
 * Retry strategy: 3 attempts per provider with exponential backoff
 */
async function callAIWithFallback(params) {
  const maxRetries = 3;
  const providers = [];

  // Determine which providers are available and not circuit-broken
  if (openRouterClient) {
    resetCircuitBreakerIfReady('openRouter');
    if (!circuitBreakerState.openRouter.isOpen) {
      providers.push({ name: 'openRouter', client: openRouterClient, model: OPENROUTER_MODEL });
    } else {
      console.log('⏸️  openRouter circuit breaker is OPEN, skipping');
    }
  } else {
    console.log('⚠️  openRouter client not configured');
  }

  if (openAIClient) {
    resetCircuitBreakerIfReady('openAI');
    if (!circuitBreakerState.openAI.isOpen) {
      providers.push({ name: 'openAI', client: openAIClient, model: OPENAI_MODEL });
    } else {
      console.log('⏸️  openAI circuit breaker is OPEN, skipping');
    }
  } else {
    console.log('⚠️  openAI client not configured');
  }

  if (providers.length === 0) {
    throw new Error('❌ AI: No providers available (all circuit breakers open or no API keys configured)');
  }

  console.log(`📡 AI: ${providers.length} providers available:`, providers.map(p => p.name).join(', '));

  let lastError = null;
  let attemptedProviders = [];

  for (const provider of providers) {
    attemptedProviders.push(provider.name);
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        const startTime = Date.now();
        const attemptLabel = `${provider.name} (attempt ${retryCount + 1}/${maxRetries})`;
        console.log(`📡 AI: Attempting ${attemptLabel} with model ${provider.model}`);

        const response = await provider.client.chat.completions.create({
          ...params,
          model: provider.model
        });

        const duration = Date.now() - startTime;
        recordProviderSuccess(provider.name, duration);
        console.log(`✅ AI: ${provider.name} succeeded in ${duration}ms`);

        // Log provider usage
        if (params.messages && params.messages.length > 0) {
          await logAIAction(`AI_PROVIDER_${provider.name.toUpperCase()}`, 
            { model: provider.model, messageCount: params.messages.length }, 
            { success: true, durationMs: duration, stats: getProviderStats() },
            params.context?.projectId
          );
        }

        return { response, provider: provider.name };
      } catch (error) {
        lastError = error;
        const isRetryable = error.status === 429 || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED';
        const errorDetails = {
          status: error.status,
          code: error.code,
          message: error.message,
          type: error.constructor.name,
          isRetryable
        };

        console.error(`❌ AI: ${provider.name} failed (attempt ${retryCount + 1}/${maxRetries}):`, errorDetails);

        if (isRetryable && retryCount < maxRetries - 1) {
          // Retry this provider
          retryCount += 1;
          const delay = Math.pow(2, retryCount) * 1000;
          console.log(`⏳ AI: Retrying ${provider.name} in ${delay}ms (${retryCount}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue; // Retry this provider
        } else {
          // Don't retry this provider, move to next
          if (!isRetryable) {
            console.log(`⚠️  AI: ${provider.name} error is not retryable (${error.status}), trying next provider...`);
          } else {
            console.log(`⚠️  AI: ${provider.name} max retries reached, trying next provider...`);
            recordProviderFailure(provider.name);
          }
          break; // Try next provider
        }
      }
    }
  }

  // All providers and retries exhausted
  const errorMessage = [
    '❌ AI: All providers exhausted.',
    `Attempted: ${attemptedProviders.join(', ')}`,
    `Last error (${lastError?.status || 'unknown'}): ${lastError?.message || 'Unknown'}`,
    `Provider stats: ${JSON.stringify(getProviderStats())}`
  ].join(' ');

  console.error(errorMessage);
  throw new Error(errorMessage);
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

function formatJsonResponseAsText(jsonResponse) {
  if (!jsonResponse || typeof jsonResponse !== 'object') {
    return jsonResponse;
  }

  try {
    let text = '';

    // Handle analysis structure
    if (jsonResponse.analysis) {
      const analysis = jsonResponse.analysis;
      if (analysis.observation) {
        text += `**Observación:** ${analysis.observation}\n\n`;
      }
      if (analysis.issues_identified && Array.isArray(analysis.issues_identified)) {
        text += '**Problemas identificados:**\n';
        analysis.issues_identified.forEach((issue, index) => {
          text += `${index + 1}. ${issue}\n`;
        });
        text += '\n';
      }
    }

    // Handle proposed_resolution structure
    if (jsonResponse.proposed_resolution) {
      const resolution = jsonResponse.proposed_resolution;
      text += '**Resolución propuesta:**\n\n';

      if (resolution.steps && Array.isArray(resolution.steps)) {
        text += '**Pasos a seguir:**\n';
        resolution.steps.forEach((step, index) => {
          text += `${index + 1}. **${step.action}**\n`;
          if (step.description) {
            text += `   ${step.description}\n`;
          }
          text += '\n';
        });
      }

      if (resolution.expected_outcomes && Array.isArray(resolution.expected_outcomes)) {
        text += '**Resultados esperados:**\n';
        resolution.expected_outcomes.forEach((outcome, index) => {
          text += `• ${outcome}\n`;
        });
        text += '\n';
      }
    }

    // Handle architectural analysis structure
    if (jsonResponse.inconsistencies || jsonResponse.redundancies || jsonResponse.risks ||
        jsonResponse.entities_centrales || jsonResponse.simbolos_debiles ||
        jsonResponse.relaciones_faltantes || jsonResponse.refactorizaciones_posibles ||
        jsonResponse.mejoras_estructurales) {

      if (jsonResponse.inconsistencies && Array.isArray(jsonResponse.inconsistencies)) {
        text += '**🔍 Inconsistencias identificadas:**\n';
        jsonResponse.inconsistencies.forEach((item, index) => {
          text += `${index + 1}. ${item}\n`;
        });
        text += '\n';
      }

      if (jsonResponse.redundancies && Array.isArray(jsonResponse.redundancies)) {
        text += '**🔄 Redundancias:**\n';
        jsonResponse.redundancies.forEach((item, index) => {
          text += `${index + 1}. ${item}\n`;
        });
        text += '\n';
      }

      if (jsonResponse.risks && Array.isArray(jsonResponse.risks)) {
        text += '**⚠️ Riesgos identificados:**\n';
        jsonResponse.risks.forEach((item, index) => {
          text += `${index + 1}. ${item}\n`;
        });
        text += '\n';
      }

      if (jsonResponse.entities_centrales && Array.isArray(jsonResponse.entities_centrales)) {
        text += '**🎯 Entidades centrales:**\n';
        jsonResponse.entities_centrales.forEach((item, index) => {
          text += `${index + 1}. ${item}\n`;
        });
        text += '\n';
      }

      if (jsonResponse.simbolos_debiles && Array.isArray(jsonResponse.simbolos_debiles)) {
        text += '**📉 Símbolos débiles:**\n';
        jsonResponse.simbolos_debiles.forEach((item, index) => {
          text += `${index + 1}. ${item}\n`;
        });
        text += '\n';
      }

      if (jsonResponse.relaciones_faltantes && Array.isArray(jsonResponse.relaciones_faltantes)) {
        text += '**🔗 Relaciones faltantes:**\n';
        jsonResponse.relaciones_faltantes.forEach((item, index) => {
          text += `${index + 1}. ${item}\n`;
        });
        text += '\n';
      }

      if (jsonResponse.refactorizaciones_posibles && Array.isArray(jsonResponse.refactorizaciones_posibles)) {
        text += '**🔧 Posibles refactorizaciones:**\n';
        jsonResponse.refactorizaciones_posibles.forEach((item, index) => {
          text += `${index + 1}. ${item}\n`;
        });
        text += '\n';
      }

      if (jsonResponse.mejoras_estructurales && Array.isArray(jsonResponse.mejoras_estructurales)) {
        text += '**✨ Mejoras estructurales:**\n';
        jsonResponse.mejoras_estructurales.forEach((item, index) => {
          text += `${index + 1}. ${item}\n`;
        });
        text += '\n';
      }
    }

    // Handle other common structures
    if (jsonResponse.inconsistencies && Array.isArray(jsonResponse.inconsistencies)) {
      text += '**Inconsistencias identificadas:**\n';
      jsonResponse.inconsistencies.forEach((item, index) => {
        text += `${index + 1}. ${item}\n`;
      });
      text += '\n';
    }

    if (jsonResponse.redundancies && Array.isArray(jsonResponse.redundancies)) {
      text += '**Redundancias:**\n';
      jsonResponse.redundancies.forEach((item, index) => {
        text += `${index + 1}. ${item}\n`;
      });
      text += '\n';
    }

    if (jsonResponse.risks && Array.isArray(jsonResponse.risks)) {
      text += '**Riesgos:**\n';
      jsonResponse.risks.forEach((item, index) => {
        text += `${index + 1}. ${item}\n`;
      });
      text += '\n';
    }

    if (jsonResponse.recommendations && Array.isArray(jsonResponse.recommendations)) {
      text += '**Recomendaciones:**\n';
      jsonResponse.recommendations.forEach((item, index) => {
        text += `${index + 1}. ${item}\n`;
      });
      text += '\n';
    }

    // If no specific structure matched, try to format as generic JSON
    if (!text) {
      text = formatGenericJsonAsText(jsonResponse);
    }

    return text.trim();
  } catch (error) {
    console.error('Error formatting JSON response as text:', error);
    return JSON.stringify(jsonResponse, null, 2);
  }
}

function formatGenericJsonAsText(obj, indent = '') {
  let text = '';

  for (const [key, value] of Object.entries(obj)) {
    const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

    if (Array.isArray(value)) {
      text += `${indent}**${formattedKey}:**\n`;
      value.forEach((item, index) => {
        if (typeof item === 'object') {
          text += `${indent}  ${index + 1}. ${formatGenericJsonAsText(item, indent + '    ')}\n`;
        } else {
          text += `${indent}  ${index + 1}. ${item}\n`;
        }
      });
      text += '\n';
    } else if (typeof value === 'object' && value !== null) {
      text += `${indent}**${formattedKey}:**\n${formatGenericJsonAsText(value, indent + '  ')}\n`;
    } else {
      text += `${indent}**${formattedKey}:** ${value}\n`;
    }
  }

  return text.trim();
}

export async function callGemini(messages, context = {}) {
  if (!openRouterClient && !openAIClient) {
    throw new Error('❌ AI: No API keys configured. Set OPENROUTER_API_KEY or OPENAI_API_KEY.');
  }

  console.log('🤖 AI: Starting callGemini with providers:', {
    openRouter: !!openRouterClient,
    openAI: !!openAIClient,
    context: { projectId: context.projectId, userId: context.userId }
  });

  let conversationMessages = [...messages];
  const maxToolCycles = 4;
  let lastToolResult = null;

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
      const { response, provider } = await callAIWithFallback({
        model: 'placeholder', // Will be overridden by provider
        messages: conversationMessages,
        max_tokens: AI_MAX_TOKENS,
        temperature: 0.7,
        tools: formattedTools,
        tool_choice: 'auto',
        context
      });

      console.log(`📬 AI: Response from ${provider}:`, JSON.stringify(response, null, 2));

      const choice = response.choices?.[0];
      if (choice?.error) {
        throw new Error(`AI error: ${choice.error.message}`);
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

        // Check if the response is JSON and format it as natural text
        let finalContent = message.content;
        if (typeof finalContent === 'string') {
          // Try to parse as JSON first
          try {
            const jsonContent = JSON.parse(finalContent.trim());
            if (jsonContent && typeof jsonContent === 'object') {
              finalContent = formatJsonResponseAsText(jsonContent);
            }
          } catch (e) {
            // Not JSON, check for JSON within the text
            const jsonMatch = finalContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                const jsonContent = JSON.parse(jsonMatch[0]);
                if (jsonContent && typeof jsonContent === 'object') {
                  finalContent = finalContent.replace(jsonMatch[0], formatJsonResponseAsText(jsonContent));
                }
              } catch (e2) {
                // Keep original content
              }
            }
          }
        }

        return finalContent;
      }
    } catch (error) {
      console.error(`❌ AI: Error in callGemini cycle ${cycle}:`, error.message);
      throw error;
    }
  }

  if (lastToolResult !== null) {
    return JSON.stringify(lastToolResult);
  }

  return 'No se pudo obtener respuesta del modelo.';
}

async function streamGeminiProvider(messages, onChunk, context = {}, remainingContinuations = AI_CONTINUATION_MAX_CYCLES) {
  if (!openRouterClient && !openAIClient) {
    throw new Error('❌ AI: No API keys configured. Set OPENROUTER_API_KEY or OPENAI_API_KEY.');
  }

  let conversationMessages = [...messages];

  console.log('🔄 AI: Starting stream with messages count:', conversationMessages.length);

  // Determine which providers are available
  const providers = [];
  if (openRouterClient) {
    resetCircuitBreakerIfReady('openRouter');
    if (!circuitBreakerState.openRouter.isOpen) {
      providers.push({ name: 'openRouter', client: openRouterClient, model: OPENROUTER_MODEL });
    } else {
      console.log('⏸️  openRouter circuit breaker is OPEN, skipping');
    }
  } else {
    console.log('⚠️  openRouter client not configured');
  }

  if (openAIClient) {
    resetCircuitBreakerIfReady('openAI');
    if (!circuitBreakerState.openAI.isOpen) {
      providers.push({ name: 'openAI', client: openAIClient, model: OPENAI_MODEL });
    } else {
      console.log('⏸️  openAI circuit breaker is OPEN, skipping');
    }
  } else {
    console.log('⚠️  openAI client not configured');
  }

  if (providers.length === 0) {
    throw new Error('❌ AI: No providers available (all circuit breakers open or no API keys configured)');
  }

  console.log(`📡 AI: ${providers.length} providers available:`, providers.map(p => p.name).join(', '));

  let lastError = null;
  let attemptedProviders = [];

  for (const provider of providers) {
    attemptedProviders.push(provider.name);
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        const startTime = Date.now();
        const attemptLabel = `${provider.name} (attempt ${retryCount + 1}/${maxRetries})`;
        console.log(`📡 AI Stream: Attempting ${attemptLabel} with model ${provider.model}`);

        const response = await provider.client.chat.completions.create({
          model: provider.model,
          messages: conversationMessages,
          max_tokens: AI_MAX_TOKENS,
          temperature: 0.7,
          stream: true
        });

        console.log(`✅ AI Stream: Got response stream from ${provider.name}`);

        let assistantResponse = '';
        let finishReason = null;

        try {
          for await (const chunk of response) {
            const delta = chunk.choices?.[0]?.delta;
            if (!delta) continue;

            // Handle content
            if (delta.content) {
              assistantResponse += delta.content;
              if (onChunk) {
                onChunk(delta.content);
              }
            }

            // Check finish reason
            if (chunk.choices?.[0]?.finish_reason) {
              finishReason = chunk.choices[0].finish_reason;
            }
          }
        } catch (streamError) {
          // Error during streaming - treat as provider failure
          throw streamError;
        }

        const duration = Date.now() - startTime;
        recordProviderSuccess(provider.name, duration);
        console.log(`✅ AI Stream: ${provider.name} completed successfully in ${duration}ms`);

        // Format JSON responses as natural text
        if (assistantResponse) {
          try {
            const jsonContent = JSON.parse(assistantResponse.trim());
            if (jsonContent && typeof jsonContent === 'object' && !jsonContent.action) {
              assistantResponse = formatJsonResponseAsText(jsonContent);
            }
          } catch (e) {
            const jsonMatch = assistantResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                const jsonContent = JSON.parse(jsonMatch[0]);
                if (jsonContent && typeof jsonContent === 'object' && !jsonContent.action) {
                  assistantResponse = assistantResponse.replace(jsonMatch[0], formatJsonResponseAsText(jsonContent));
                }
              } catch (e2) {
                // Keep original content
              }
            }
          }
        }

        return assistantResponse;
      } catch (error) {
        lastError = error;
        const isRetryable = error.status === 429 || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED';
        const errorDetails = {
          status: error.status,
          code: error.code,
          message: error.message,
          type: error.constructor.name
        };

        console.error(`❌ AI Stream: ${provider.name} failed (attempt ${retryCount + 1}/${maxRetries}):`, errorDetails);

        if (isRetryable && retryCount < maxRetries - 1) {
          // Retry this provider
          retryCount += 1;
          const delay = Math.pow(2, retryCount) * 1000;
          console.log(`⏳ AI Stream: Retrying ${provider.name} in ${delay}ms (${retryCount}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue; // Retry this provider
        } else {
          // Don't retry this provider, move to next
          if (!isRetryable) {
            console.log(`⚠️  AI Stream: ${provider.name} error is not retryable (${error.status}), trying next provider...`);
          } else {
            console.log(`⚠️  AI Stream: ${provider.name} max retries reached, trying next provider...`);
            recordProviderFailure(provider.name);
          }
          break; // Try next provider
        }
      }
    }
  }

  // All providers and retries exhausted
  const errorMessage = [
    '❌ AI Stream: All providers exhausted.',
    `Attempted: ${attemptedProviders.join(', ')}`,
    `Last error: ${lastError?.message || 'Unknown'}`,
    `Provider stats: ${JSON.stringify(getProviderStats())}`
  ].join(' ');

  console.error(errorMessage);
  throw new Error(errorMessage);
}

export async function streamGemini(messages, onChunk, context = {}) {
  return streamGeminiProvider(messages, onChunk, context);
}

export { logAIAction, formatJsonResponseAsText, getProviderStats };

