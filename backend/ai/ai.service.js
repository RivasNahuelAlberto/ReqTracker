const { SYSTEM_PROMPT } = require('./prompts/system.prompt');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-mini';
const GEMINI_API_URL = process.env.GEMINI_API_URL || `https://gemini.googleapis.com/v1/models/${GEMINI_MODEL}:generate`;

function formatGeminiMessages(messages) {
  return messages.map((message) => ({
    author: message.role === 'assistant' ? 'bot' : message.role,
    content: [
      {
        type: 'text',
        text: message.content
      }
    ]
  }));
}

async function callGemini({ messages }) {
  if (!GEMINI_API_KEY) {
    const err = new Error('Missing Gemini API key. Set GEMINI_API_KEY or GOOGLE_API_KEY in the backend environment.');
    err.status = 500;
    throw err;
  }

  const body = {
    messages: formatGeminiMessages(messages),
    temperature: 0.2,
    maxOutputTokens: 1024
  };

  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GEMINI_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  if (!response.ok) {
    const err = new Error(data?.error?.message || `Gemini API error: ${response.status}`);
    err.response = data;
    err.status = response.status;
    throw err;
  }

  const text = data?.candidates?.[0]?.content?.[0]?.text || data?.output?.[0]?.content?.[0]?.text || data?.output?.text || '';

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
