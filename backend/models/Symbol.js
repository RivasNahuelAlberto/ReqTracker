import mongoose from 'mongoose';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const SymbolSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  type: { type: String, default: 'General', trim: true },
  isSeed: { type: Boolean, default: false },
  order: { type: String, default: '', trim: true },
  notion: { type: String, default: '', trim: true },
  impact: { type: String, default: '', trim: true },
  reviewNotes: { type: String, default: '', trim: true },
  status: { type: String, enum: ['incomplete', 'review', 'complete'], default: 'incomplete' },
  parentSymbol: { type: mongoose.Schema.Types.ObjectId, ref: 'Symbol', default: null },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  embedding: { type: [Number], default: [] }, // Vector de embedding para búsqueda semántica
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

SymbolSchema.index({ project: 1, type: 1, name: 1 });

SymbolSchema.statics.isDuplicateNameForType = async function(projectId, name, type, excludeId = null) {
  const query = {
    project: projectId,
    type,
    name: { $regex: `^${escapeRegExp(name.trim())}$`, $options: 'i' }
  };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  return this.exists(query);
};

export default mongoose.model('Symbol', SymbolSchema);
