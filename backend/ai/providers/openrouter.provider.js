import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENROUTER_API_BASE_URL || 'https://openrouter.ai/api/v1'
});

const PROVIDER_MODELS = {
  openrouter: [
    'openai/gpt-4o',
    'openai/gpt-4o-mini',
    'anthropic/claude-3-opus',
    'anthropic/claude-3-sonnet',
    'anthropic/claude-3-haiku',
    'meta-llama/llama-3-70b-instruct',
    'meta-llama/llama-3-8b-instruct',
    'google/gemini-pro',
    'google/gemini-flash'
  ]
};

export async function generate({ model, prompt, context = {} }) {
  if (!PROVIDER_MODELS.openrouter.includes(model)) {
    throw new Error(`Model ${model} is invalid for OpenRouter provider. Valid models: ${PROVIDER_MODELS.openrouter.join(', ')}`);
  }

  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.7,
    max_tokens: 1024
  });

  return completion.choices[0].message.content;
}

export async function generateWithTools({ model, messages, tools, context = {} }) {
  if (!PROVIDER_MODELS.openrouter.includes(model)) {
    throw new Error(`Model ${model} is invalid for OpenRouter provider. Valid models: ${PROVIDER_MODELS.openrouter.join(', ')}`);
  }

  const completion = await client.chat.completions.create({
    model,
    messages,
    tools,
    temperature: 0.7,
    max_tokens: 1024
  });

  return completion;
}