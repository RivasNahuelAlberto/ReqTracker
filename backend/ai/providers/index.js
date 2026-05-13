import * as googleProvider from './google.provider.js';
import * as openrouterProvider from './openrouter.provider.js';
import * as openaiProvider from './openai.provider.js';

// Provider configuration with fallback chain
const PROVIDER_CHAIN = [
  {
    name: 'google',
    provider: googleProvider,
    defaultModel: 'gemini-1.5-pro'
  },
  {
    name: 'openrouter',
    provider: openrouterProvider,
    defaultModel: 'openai/gpt-4o-mini'
  },
  {
    name: 'openai',
    provider: openaiProvider,
    defaultModel: 'gpt-4o-mini'
  }
];

export async function generate({ provider, model, prompt, context = {} }) {
  // If no provider specified, try the chain
  if (!provider) {
    for (const providerOption of PROVIDER_CHAIN) {
      try {
        const result = await providerOption.provider.generate({
          model: model || providerOption.defaultModel,
          prompt,
          context
        });
        return result;
      } catch (error) {
        console.warn(`Provider ${providerOption.name} failed:`, error.message);
        continue;
      }
    }
    throw new Error('All providers failed');
  }

  // Use specific provider
  const providerConfig = PROVIDER_CHAIN.find(p => p.name === provider);
  if (!providerConfig) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  return await providerConfig.provider.generate({
    model: model || providerConfig.defaultModel,
    prompt,
    context
  });
}

// Normalize Gemini response to OpenAI format
function normalizeGeminiResponse(result, providerName) {
  if (providerName !== 'google') return result;

  // Gemini response structure
  if (result.response) {
    const geminiResponse = result.response;
    const candidates = geminiResponse.candidates || [];

    if (candidates.length > 0) {
      const candidate = candidates[0];
      const content = candidate.content || {};

      // Convert to OpenAI-style response
      const openaiResponse = {
        choices: [{
          message: {
            role: 'assistant',
            content: ''
          },
          finish_reason: candidate.finishReason || 'stop'
        }]
      };

      // Handle text content
      if (content.parts) {
        const textParts = content.parts.filter(part => part.text);
        if (textParts.length > 0) {
          openaiResponse.choices[0].message.content = textParts.map(part => part.text).join('');
        }
      }

      // Handle function calls
      const functionCallParts = content.parts?.filter(part => part.functionCall);
      if (functionCallParts && functionCallParts.length > 0) {
        const functionCall = functionCallParts[0].functionCall;
        openaiResponse.choices[0].message.tool_calls = [{
          id: `call_${Date.now()}`,
          function: {
            name: functionCall.name,
            arguments: JSON.stringify(functionCall.args || {})
          }
        }];
        openaiResponse.choices[0].message.content = null;
      }

      return openaiResponse;
    }
  }

  // Fallback
  return {
    choices: [{
      message: {
        role: 'assistant',
        content: 'Error: Could not parse Gemini response'
      }
    }]
  };
}

export async function generateWithTools({ provider, model, messages, tools, context = {} }) {
  // If no provider specified, try the chain
  if (!provider) {
    for (const providerOption of PROVIDER_CHAIN) {
      try {
        const result = await providerOption.provider.generateWithTools({
          model: model || providerOption.defaultModel,
          messages,
          tools,
          context
        });
        return normalizeGeminiResponse(result, providerOption.name);
      } catch (error) {
        console.warn(`Provider ${providerOption.name} failed:`, error.message);
        continue;
      }
    }
    throw new Error('All providers failed');
  }

  // Use specific provider
  const providerConfig = PROVIDER_CHAIN.find(p => p.name === provider);
  if (!providerConfig) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  const result = await providerConfig.provider.generateWithTools({
    model: model || providerConfig.defaultModel,
    messages,
    tools,
    context
  });

  return normalizeGeminiResponse(result, provider);
}