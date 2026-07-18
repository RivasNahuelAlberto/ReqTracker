import mongoose from 'mongoose';

const StepSchema = new mongoose.Schema({
  description: { type: String, required: true },
  tool: { type: String, required: true },
  args: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: {
    type: String,
    enum: ['pending', 'done', 'failed'],
    default: 'pending'
  },
  result: { type: mongoose.Schema.Types.Mixed, default: null },
  error: { type: String, default: '' }
});

const TaskSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  goal: { type: String, default: '' },
  number: { type: Number, default: 0 },
  priority: { type: Number, default: 3 },
  description: { type: String, default: '' },
  targetType: { type: String, default: 'scenario' },
  targetId: { type: String, default: '' },
  targetLabel: { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending', 'running', 'done', 'failed'],
    default: 'pending'
  },
  explanation: { type: String, default: '' },
  steps: [StepSchema]
}, {
  timestamps: true
});

export default mongoose.model('Task', TaskSchema);
