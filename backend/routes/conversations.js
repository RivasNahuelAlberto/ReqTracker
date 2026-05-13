import express from 'express';
import {
  createConversation,
  getActiveConversation,
  getUserConversations,
  getConversationMessages,
  updateConversationTitle,
  deactivateConversation
} from '../chat/chat.service.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Obtener conversaciones del usuario para un proyecto específico
router.get('/:projectId', async (req, res) => {
  try {
    const conversations = await getUserConversations(req.user._id, req.params.projectId);
    res.json(conversations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al recuperar las conversaciones.' });
  }
});

// Crear nueva conversación
router.post('/:projectId', async (req, res) => {
  try {
    const { title } = req.body;
    const conversation = await createConversation(req.user._id, req.params.projectId, title);
    res.status(201).json(conversation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al crear la conversación.' });
  }
});

// Obtener conversación activa para un proyecto
router.get('/:projectId/active', async (req, res) => {
  try {
    const conversation = await getActiveConversation(req.user._id, req.params.projectId);
    res.json(conversation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al recuperar la conversación activa.' });
  }
});

// Actualizar título de conversación
router.put('/:conversationId/title', async (req, res) => {
  try {
    const { title } = req.body;
    const conversation = await updateConversationTitle(req.params.conversationId, title);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversación no encontrada.' });
    }
    res.json(conversation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al actualizar el título de la conversación.' });
  }
});

// Desactivar conversación
router.put('/:conversationId/deactivate', async (req, res) => {
  try {
    const conversation = await deactivateConversation(req.params.conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversación no encontrada.' });
    }
    res.json(conversation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al desactivar la conversación.' });
  }
});

// Obtener mensajes de una conversación
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
