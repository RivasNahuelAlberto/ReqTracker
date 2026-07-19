import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

async function createConversation(userId, projectId, title = '') {
  await Conversation.updateMany({ userId, projectId, isActive: true }, { isActive: false });

  const effectiveTitle = title && title.trim()
    ? title.trim()
    : `Conversación ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;

  return Conversation.create({
    userId,
    projectId,
    title: effectiveTitle,
    isActive: true
  });
}

async function getActiveConversation(userId, projectId) {
  return Conversation.findOne({
    userId,
    projectId,
    isActive: true
  }).sort({ createdAt: -1 });
}

async function getUserConversations(userId, projectId) {
  return Conversation
    .find({ userId, projectId, isActive: true })
    .sort({ createdAt: -1 })
    .populate('projectId', 'name')
    .lean();
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

async function updateConversationTitle(conversationId, title) {
  return Conversation.findByIdAndUpdate(conversationId, { title }, { new: true });
}

async function deactivateConversation(conversationId) {
  return Conversation.findByIdAndUpdate(conversationId, { isActive: false }, { new: true });
}

export {
  createConversation,
  getActiveConversation,
  getUserConversations,
  saveMessage,
  getConversationMessages,
  updateConversationTitle,
  deactivateConversation
};
