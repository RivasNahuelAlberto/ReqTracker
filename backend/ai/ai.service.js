const { SYSTEM_PROMPT } = require('./prompts/system.prompt');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-mini';
const GEMINI_API_URL = process.env.GEMINI_API_URL || `https://generativelanguage.googleapis.com/v1beta2/models/${GEMINI_MODEL}:generateText`;

function joinGeminiPrompt(messages) {
  return messages
    .map((message) => {
      if (message.role === 'assistant') {
        return `Asistente: ${message.content}`;
      }
      if (message.role === 'system') {
        return `Sistema: ${message.content}`;
      }
      return `Usuario: ${message.content}`;
    })
    .join('\n');
}

async function callGemini({ messages }) {
  const promptText = joinGeminiPrompt(messages);
  if (!GEMINI_API_KEY) {
    const err = new Error('Missing Gemini API key. Set GEMINI_API_KEY or GOOGLE_API_KEY in the backend environment.');
    err.status = 500;
    throw err;
  }

  const body = {
    prompt: {
      text: promptText
    },
    temperature: 0.2,
    maxOutputTokens: 1024
  };

  const isBearerToken = /^ya29\./.test(GEMINI_API_KEY);
  const headers = {
    'Content-Type': 'application/json'
  };

  let url = GEMINI_API_URL;
  if (isBearerToken) {
    headers.Authorization = `Bearer ${GEMINI_API_KEY}`;
  } else {
    headers['x-goog-api-key'] = GEMINI_API_KEY;
    url = `${GEMINI_API_URL}?key=${encodeURIComponent(GEMINI_API_KEY)}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  const contentType = response.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    const text = await response.text();
    const err = new Error(`Unexpected Gemini response: ${text.slice(0, 500)}`);
    err.status = response.status;
    err.response = text;
    throw err;
  }

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
    err.response = data;
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
