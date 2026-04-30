const mongoose = require('mongoose');

const SymbolSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, default: 'General' },
  isSeed: { type: Boolean, default: false },
  notion: { type: String, default: '' },
  impact: { type: String, default: '' },
  status: { type: String, enum: ['incomplete', 'complete'], default: 'incomplete' },
  parentSymbol: { type: mongoose.Schema.Types.ObjectId, ref: 'Symbol', default: null },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Symbol', SymbolSchema);
