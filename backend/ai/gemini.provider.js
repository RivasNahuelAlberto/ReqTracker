import { generateWithTools } from './providers/index.js';
import { tools, toolImplementations } from './tools/index.js';
import AIActionLog from '../models/AIActionLog.js';

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
      if (analysis.redundancies && Array.isArray(analysis.redundancies)) {
        text += '**🔄 Redundancias:**\n';
        analysis.redundancies.forEach((item, index) => {
          text += `${index + 1}. ${item}\n`;
        });
        text += '\n';
      }

      if (analysis.risks && Array.isArray(analysis.risks)) {
        text += '**⚠️ Riesgos identificados:**\n';
        analysis.risks.forEach((item, index) => {
          text += `${index + 1}. ${item}\n`;
        });
        text += '\n';
      }

      if (analysis.entities_centrales && Array.isArray(analysis.entities_centrales)) {
        text += '**🎯 Entidades centrales:**\n';
        analysis.entities_centrales.forEach((item, index) => {
          text += `${index + 1}. ${item}\n`;
        });
        text += '\n';
      }

      if (analysis.simbolos_debiles && Array.isArray(analysis.simbolos_debiles)) {
        text += '**📉 Símbolos débiles:**\n';
        analysis.simbolos_debiles.forEach((item, index) => {
          text += `${index + 1}. ${item}\n`;
        });
        text += '\n';
      }

      if (analysis.relaciones_faltantes && Array.isArray(analysis.relaciones_faltantes)) {
        text += '**🔗 Relaciones faltantes:**\n';
        analysis.relaciones_faltantes.forEach((item, index) => {
          text += `${index + 1}. ${item}\n`;
        });
        text += '\n';
      }

      if (analysis.refactorizaciones_posibles && Array.isArray(analysis.refactorizaciones_posibles)) {
        text += '**🔧 Posibles refactorizaciones:**\n';
        analysis.refactorizaciones_posibles.forEach((item, index) => {
          text += `${index + 1}. ${item}\n`;
        });
        text += '\n';
      }

      if (analysis.mejoras_estructurales && Array.isArray(analysis.mejoras_estructurales)) {
        text += '**✨ Mejoras estructurales:**\n';
        analysis.mejoras_estructurales.forEach((item, index) => {
          text += `${index + 1}. ${item}\n`;
        });
        text += '\n';
      }
    }

    // Handle generic JSON structure
    if (!text) {
      text = formatGenericJsonAsText(jsonResponse);
    }

    return text.trim();
  } catch (error) {
    console.error('Error formatting JSON response:', error);
    return JSON.stringify(jsonResponse);
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
  console.log('Using AI provider with tool calling');

  try {
    const result = await generateWithTools({
      messages,
      tools,
      context
    });

    // Process tool calls from the result
    if (result.choices && result.choices[0]) {
      const message = result.choices[0].message;
      if (message.tool_calls) {
        for (const toolCall of message.tool_calls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments || '{}');

          console.log('AI requested tool call:', { functionName, functionArgs, projectId: context.projectId, userId: context.userId });
          const normalizedArgs = normalizeToolArguments(functionName, functionArgs, context);
          const tool = toolImplementations[functionName];
          if (!tool) {
            throw new Error(`Tool no encontrada: ${functionName}`);
          }

          let toolResult;
          try {
            toolResult = await tool(normalizedArgs);
          } catch (error) {
            console.error('Tool execution failed:', error);
            toolResult = {
              error: error.message || 'Error interno en la herramienta',
              functionName,
              functionArgs
            };
          }

          console.log('Tool executed successfully:', { functionName, functionArgs, toolResult });
          await logAIAction(functionName, functionArgs, toolResult, normalizedArgs.projectId || context.projectId);

          return JSON.stringify(toolResult);
        }
      }

      return message.content || 'No se pudo obtener respuesta del modelo.';
    }

    return 'No se pudo obtener respuesta del modelo.';
  } catch (error) {
    console.error('Error in callGemini:', error);
    throw error;
  }
}

export async function streamGemini(messages, onChunk, context = {}) {
  // For now, use a simple streaming approach
  // This could be enhanced to use actual streaming from providers
  try {
    const result = await generateWithTools({
      messages,
      tools,
      context
    });

    let response = '';
    if (result.choices && result.choices[0]) {
      const message = result.choices[0].message;
      response = message.content || '';

      // Format JSON responses
      if (response) {
        try {
          const jsonContent = JSON.parse(response.trim());
          if (jsonContent && typeof jsonContent === 'object' && !jsonContent.action) {
            response = formatJsonResponseAsText(jsonContent);
          }
        } catch (e) {
          // Not JSON, keep as is
        }
      }

      // Send the response in chunks
      if (onChunk) {
        const words = response.split(' ');
        for (const word of words) {
          onChunk(word + ' ');
          // Small delay to simulate streaming
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
    }

    return response;
  } catch (error) {
    console.error('Error in streamGemini:', error);
    throw error;
  }
}

export { logAIAction, formatJsonResponseAsText };