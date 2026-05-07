import mongoose from 'mongoose';

const ConversationSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: false },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Conversation', ConversationSchema);
