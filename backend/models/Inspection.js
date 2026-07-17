import mongoose from 'mongoose';

const inspectionSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  targetType: { type: String, required: true },
  targetId: { type: String, required: true },
  targetLabel: { type: String, default: '' },
  aspect: { type: String, required: true },
  description: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

inspectionSchema.index({ project: 1, aspect: 1 });

export default mongoose.model('Inspection', inspectionSchema);
