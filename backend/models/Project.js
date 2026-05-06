const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  securityCode: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  documents: { type: Array, default: [] },
  scenarios: [{
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    objective: { type: String, default: '' },
    locationTemporal: { type: String, default: '' },
    locationGeographic: { type: String, default: '' },
    preconditions: { type: String, default: '' },
    actors: { type: String, default: '' },
    resources: { type: String, default: '' },
    episodes: { type: String, default: '' },
    exceptions: { type: String, default: '' },
    order: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
  }],
  about: {
    intro: { type: String, default: '' },
    items: { type: [String], default: [] }
  },
  tasks: [{
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    number: { type: Number, required: true },
    priority: { type: Number, min: 1, max: 5, default: 3 },
    description: { type: String, required: true },
    targetType: { type: String, enum: ['symbol', 'scenario'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    targetLabel: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
  }],
  inspections: [{
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    targetType: { type: String, enum: ['symbol', 'scenario'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    targetLabel: { type: String, default: '' },
    aspect: { type: String, required: true },
    description: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  locks: [{
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    targetType: { type: String, required: true },
    targetId: { type: String, required: true },
    sessionId: { type: String, required: true },
    lockedBy: { type: String, default: 'Usuario' },
    lockedAt: { type: Date, default: Date.now }
  }],
  resolveNotes: [{
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  assistantConfig: {
    provider: { type: String, default: '' },
    connected: { type: Boolean, default: false }
  },
  symbols: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Symbol' }]
});

module.exports = mongoose.model('Project', ProjectSchema);
