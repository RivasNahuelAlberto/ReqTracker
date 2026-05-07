import mongoose from 'mongoose';

const MemorySchema = new mongoose.Schema({
  userId: { type: String, required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: false },
  type: { type: String, required: true },
  content: { type: String, required: true },
  source: { type: String, default: 'agent' },
  embedding: { type: [Number], required: false },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Memory', MemorySchema);
