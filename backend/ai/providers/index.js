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

  return await providerConfig.provider.generateWithTools({
    model: model || providerConfig.defaultModel,
    messages,
    tools,
    context
  });
}