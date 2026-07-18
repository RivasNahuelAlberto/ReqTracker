import mongoose from 'mongoose';

const ResolveNoteSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

ResolveNoteSchema.index({ project: 1, createdAt: 1 });

export default mongoose.model('ResolveNote', ResolveNoteSchema);
