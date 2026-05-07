const { streamChat } = require('./ai.service');
const {
  createConversation,
  saveMessage
} = require('../chat/chat.service');

async function stream(req, res) {
  try {
    const {
      message,
      conversationId,
      context = {}
    } = req.body;

    if (!message || !message.toString().trim()) {
      return res.status(400).json({ message: 'El mensaje es obligatorio.' });
    }

    let conversation = conversationId;

    if (!conversation) {
      const newConversation = await createConversation(context.projectId);
      conversation = newConversation._id.toString();
    }

    await saveMessage({
      conversationId: conversation,
      role: 'user',
      content: message.toString().trim(),
      metadata: {
        projectId: context.projectId || null
      }
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let assistantResponse = '';

    await streamChat({
      messages: [
        {
          role: 'user',
          content: message.toString().trim()
        }
      ],
      context,
      onChunk(chunk) {
        assistantResponse += chunk;
        res.write(`data: ${JSON.stringify({ content: chunk, conversationId: conversation })}\n\n`);
      }
    });

    await saveMessage({
      conversationId: conversation,
      role: 'assistant',
      content: assistantResponse,
      metadata: {
        projectId: context.projectId || null
      }
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error interno del servidor de IA.' });
    } else {
      res.write(`data: ${JSON.stringify({ error: 'Error interno del servidor de IA.' })}\n\n`);
      res.end();
    }
  }
}

module.exports = {
  stream
};
