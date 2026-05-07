import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

async function createConversation(projectId) {
  return Conversation.create({ projectId });
}

async function saveMessage({ conversationId, role, content, metadata = {} }) {
  return Message.create({
    conversationId,
    role,
    content,
    metadata
  });
}

async function getConversationMessages(conversationId) {
  return Message
    .find({ conversationId })
    .sort({ createdAt: 1 })
    .lean();
}

export {
  createConversation,
  saveMessage,
  getConversationMessages
};
