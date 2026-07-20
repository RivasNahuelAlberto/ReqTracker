import mongoose from 'mongoose';

const DocumentSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['texto', 'archivo'], default: 'texto' },
  description: { type: String, default: '' },
  fileName: { type: String, default: '' },
  extension: { type: String, default: '' },
  content: { type: String, default: '' },
  embedding: { type: [Number], default: [] },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Document', DocumentSchema);
