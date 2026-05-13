import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const PROVIDER_MODELS = {
  google: [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-2.0-flash'
  ]
};

export async function generate({ model, prompt, context = {} }) {
  if (!PROVIDER_MODELS.google.includes(model)) {
    throw new Error(`Model ${model} is invalid for Google provider. Valid models: ${PROVIDER_MODELS.google.join(', ')}`);
  }

  const generativeModel = genAI.getGenerativeModel({ model });

  const result = await generativeModel.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  return text;
}

export async function generateWithTools({ model, messages, tools, context = {} }) {
  if (!PROVIDER_MODELS.google.includes(model)) {
    throw new Error(`Model ${model} is invalid for Google provider. Valid models: ${PROVIDER_MODELS.google.join(', ')}`);
  }

  const generativeModel = genAI.getGenerativeModel({
    model,
    tools: tools ? [tools] : undefined
  });

  const result = await generativeModel.generateContent({
    contents: messages
  });

  return result;
}