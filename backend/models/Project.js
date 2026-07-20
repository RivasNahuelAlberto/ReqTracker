import mongoose from 'mongoose';

const ProjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  projectHash: { type: String, unique: true, sparse: true }, // Código hash para invitar usuarios
  securityCode: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
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
  }
});

export default mongoose.model('Project', ProjectSchema);
