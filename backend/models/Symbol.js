import mongoose from 'mongoose';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const SymbolSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, default: 'General' },
  isSeed: { type: Boolean, default: false },
  order: { type: String, default: '' },
  notion: { type: String, default: '' },
  impact: { type: String, default: '' },
  reviewNotes: { type: String, default: '' },
  status: { type: String, enum: ['incomplete', 'review', 'complete'], default: 'incomplete' },
  parentSymbol: { type: mongoose.Schema.Types.ObjectId, ref: 'Symbol', default: null },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  embedding: { type: [Number], default: [] }, // Vector de embedding para búsqueda semántica
  createdAt: { type: Date, default: Date.now }
});

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
