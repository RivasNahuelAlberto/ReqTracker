import mongoose from 'mongoose';

const ProjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  projectHash: { type: String, unique: true, sparse: true }, // Código hash para invitar usuarios
  securityCode: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  documents: [{
    id: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['texto', 'archivo'], default: 'texto' },
    description: { type: String, default: '' },
    fileName: { type: String, default: '' },
    extension: { type: String, default: '' },
    content: { type: String, default: '' },
    embedding: { type: [Number], default: [] }
  }],
  about: {
    intro: { type: String, default: '' },
    items: { type: [String], default: [] }
  },
  locks: [{
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    targetType: { type: String, required: true },
    targetId: { type: String, required: true },
    sessionId: { type: String, required: true },
    lockedBy: { type: String, default: 'Usuario' },
    lockedAt: { type: Date, default: Date.now }
  }],
  assistantConfig: {
    provider: { type: String, default: '' },
    connected: { type: Boolean, default: false }
  },
  symbols: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Symbol' }]
});

export default mongoose.model('Project', ProjectSchema);
