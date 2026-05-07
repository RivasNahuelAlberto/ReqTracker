const { GoogleGenerativeAI } = require('@google/generative-ai');
const { SYSTEM_PROMPT } = require('./prompts/system.prompt');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-mini';

const geminiClient = GEMINI_API_KEY
  ? new GoogleGenerativeAI(GEMINI_API_KEY)
  : null;

function joinMessages(messages) {
  return messages
    .map((message) => {
      const role = message.role === 'assistant' ? 'Asistente' : message.role === 'user' ? 'Usuario' : 'Sistema';
      return `${role}: ${message.content}`;
    })
    .join('\n');
}

async function callGemini({ messages }) {
  if (!geminiClient) {
    const err = new Error('Missing Gemini API key. Set GEMINI_API_KEY or GOOGLE_API_KEY in the backend environment.');
    err.status = 500;
    throw err;
  }

  const prompt = joinMessages(messages);
  const model = geminiClient.getGenerativeModel({ model: GEMINI_MODEL });
  const result = await model.generateContent(prompt);

  let text = '';
  if (result?.response?.text) {
    text = typeof result.response.text === 'function'
      ? await result.response.text()
      : result.response.text;
  } else if (result?.output?.[0]?.content?.[0]?.text) {
    text = result.output[0].content[0].text;
  }

  if (!text) {
    const err = new Error('Gemini returned an empty response.');
    err.status = 500;
    throw err;
  }

  return text;
}

const providers = {
  gemini: callGemini
};

async function streamChat({ provider = 'gemini', messages, context = {}, onChunk }) {
  const llmProvider = providers[provider] ? provider : 'gemini';
  const fullMessages = [
    {
      role: 'system',
      content: SYSTEM_PROMPT
    },
    {
      role: 'system',
      content: `Contexto actual:\nProyecto: ${context.projectId || 'N/A'}`
    },
    ...messages
  ];

  const responseText = await providers[llmProvider]({ messages: fullMessages });
  onChunk(responseText);
  return responseText;
}

module.exports = {
  streamChat
};
