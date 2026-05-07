const OpenAI = require('openai');
const { SYSTEM_PROMPT } = require('./prompts/system.prompt');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-fake-key-for-development'
});

async function callGemini({ messages }) {
  // Temporary fallback to OpenAI while Gemini API access is resolved
  const messagesForOpenAI = messages.map(msg => ({
    role: msg.role === 'system' ? 'system' : msg.role === 'assistant' ? 'assistant' : 'user',
    content: msg.content
  }));

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messagesForOpenAI
      ],
      max_tokens: 1024,
      temperature: 0.2
    });

    return completion.choices[0]?.message?.content || 'No response generated';
  } catch (error) {
    if (error.message?.includes('fake-key') || error.status === 401) {
      // Return a mock response for development
      return 'Esta es una respuesta de prueba. Para usar IA real, configura OPENAI_API_KEY con una clave válida de OpenAI.';
    }
    throw error;
  }
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
