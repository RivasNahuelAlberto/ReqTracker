import mongoose from 'mongoose';

const HealthIssueSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  type: {
    type: String,
    enum: ['duplicate', 'ambiguity', 'inconsistency', 'architecture_issue', 'unused_entity'],
    default: 'architecture_issue'
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  description: { type: String, required: true },
  suggestedFix: { type: String, default: '' },
  status: {
    type: String,
    enum: ['open', 'resolved', 'ignored'],
    default: 'open'
  }
}, {
  timestamps: true
});

export default mongoose.model('HealthIssue', HealthIssueSchema);
