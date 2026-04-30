const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  securityCode: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  documents: { type: Array, default: [] },
  scenarios: { type: Array, default: [] },
  symbols: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Symbol' }]
});

module.exports = mongoose.model('Project', ProjectSchema);
