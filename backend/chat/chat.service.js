const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

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

module.exports = {
  createConversation,
  saveMessage,
  getConversationMessages
};
