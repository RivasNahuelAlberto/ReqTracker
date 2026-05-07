import express from 'express';
import Conversation from '../models/Conversation.js';
import { getConversationMessages } from '../chat/chat.service.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const conversations = await Conversation.find().sort({ createdAt: -1 }).lean();
    res.json(conversations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al recuperar las conversaciones.' });
  }
});

router.get('/:conversationId/messages', async (req, res) => {
  try {
    const messages = await getConversationMessages(req.params.conversationId);
    res.json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al recuperar los mensajes de la conversación.' });
  }
});

export default router;
