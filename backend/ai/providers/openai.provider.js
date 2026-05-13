import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
});

const PROVIDER_MODELS = {
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo'
  ]
};

export async function generate({ model, prompt, context = {} }) {
  if (!PROVIDER_MODELS.openai.includes(model)) {
    throw new Error(`Model ${model} is invalid for OpenAI provider. Valid models: ${PROVIDER_MODELS.openai.join(', ')}`);
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
  if (!PROVIDER_MODELS.openai.includes(model)) {
    throw new Error(`Model ${model} is invalid for OpenAI provider. Valid models: ${PROVIDER_MODELS.openai.join(', ')}`);
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