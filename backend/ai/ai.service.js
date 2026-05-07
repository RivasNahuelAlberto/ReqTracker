const OpenAI = require('openai');
const { SYSTEM_PROMPT } = require('./prompts/system.prompt');

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function streamChat({ messages, context = {}, onChunk }) {
  const stream = await client.chat.completions.create({
    model: 'gpt-4.1-mini',
    stream: true,
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT
      },
      {
        role: 'system',
        content: `Contexto actual:\nProyecto: ${context.projectId || 'N/A'}`
      },
      ...messages
    ]
  });

  let fullResponse = '';

  for await (const chunk of stream) {
    const content = chunk.choices?.[0]?.delta?.content || '';
    if (!content) continue;
    fullResponse += content;
    onChunk(content);
  }

  return fullResponse;
}

module.exports = {
  streamChat
};
