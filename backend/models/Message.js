import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  role: { type: String, required: true, enum: ['user', 'assistant', 'system'], default: 'user' },
  content: { type: String, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Message', MessageSchema);
