import { streamChat } from './ai.service.js';
import {
  createConversation,
  getActiveConversation
} from '../chat/chat.service.js';

async function stream(req, res) {
  console.log('REQUEST START', { timestamp: Date.now(), url: req.url, method: req.method });

  req.on('close', () => {
    console.log('REQUEST CLOSED', { timestamp: Date.now(), url: req.url, method: req.method });
  });

  res.on('close', () => {
    console.log('RESPONSE CLOSED', { timestamp: Date.now(), url: req.url, method: req.method });
  });

  try {
    const {
      message,
      conversationId,
      context = {},
      provider
    } = req.body;

    // Check project permissions if projectId is provided
    if (context.projectId) {
      if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
        const projectRole = req.user.projectRoles?.find(pr => pr.project?._id?.toString() === context.projectId?.toString());
        if (!projectRole || projectRole.role !== 'usuario') {
          return res.status(403).json({ message: 'No tienes permisos para interactuar con este proyecto.' });
        }
      }
    }

    context.userId = req.user?.userId || null;
    context.userRole = req.user?.role || null;

    // Determine project role
    let determinedProjectRole = 'invitado';
    if (context.projectId) {
      if (req.user?.role === 'super_admin' || req.user?.role === 'admin') {
        determinedProjectRole = 'admin';
      } else if (req.user?.role === 'usuario') {
        const projectRoleObj = req.user.projectRoles?.find(pr => {
          const prProjectId = pr.project?._id?.toString() || pr.project?.toString();
          const contextProjectId = context.projectId.toString();
          return prProjectId === contextProjectId;
        });
        if (projectRoleObj && ['usuario', 'admin'].includes(projectRoleObj.role)) {
          determinedProjectRole = projectRoleObj.role;
        }
      }
    }
    context.projectRole = determinedProjectRole;

    console.log('AI stream - Determined project role:', {
      userId: context.userId,
      projectId: context.projectId,
      userGlobalRole: context.userRole,
      userProjectRoles: req.user?.projectRoles,
      determinedProjectRole: context.projectRole
    });

    const llmProvider = provider || process.env.AI_PROVIDER || 'gemini';

    console.log('AI stream request:', {
      message: message?.toString?.(),
      conversationId,
      context,
      provider: llmProvider
    });

    if (!message || !message.toString().trim()) {
      return res.status(400).json({ message: 'El mensaje es obligatorio.' });
    }

    let conversation = conversationId;

    // Si no hay conversationId, buscar conversación activa o crear nueva
    if (!conversation && context.userId && context.projectId) {
      const activeConversation = await getActiveConversation(context.userId, context.projectId);
      if (activeConversation) {
        conversation = activeConversation._id.toString();
      } else {
        const newConversation = await createConversation(context.userId, context.projectId);
        conversation = newConversation._id.toString();
      }
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    await streamChat({
      provider: llmProvider,
      messages: [
        {
          role: 'user',
          content: message.toString().trim()
        }
      ],
      context,
      conversationId: conversation,
      onChunk(chunk) => {
        res.write(`data: ${JSON.stringify({ content: chunk, conversationId: conversation })}\n\n`);
      }
    });

    console.log('AI stream completed:', {
      conversationId: conversation
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error('AI stream error:', err);
    if (err.response) {
      console.error('AI service response:', {
        status: err.response.status,
        data: err.response.data
      });
    }

    const statusCode = err.status || (err.response && err.response.status) || 500;
    const openAIMessage = err.error?.message || (err.response && err.response.data?.error?.message);
    const errorMessage = openAIMessage || 'Error interno del servidor de IA.';

    if (!res.headersSent) {
      res.status(statusCode).json({ message: errorMessage });
    } else {
      res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
      res.end();
    }
  }
}

export { stream };
