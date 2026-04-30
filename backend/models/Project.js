const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  securityCode: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  documents: { type: Array, default: [] },
  scenarios: { type: Array, default: [] },
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
