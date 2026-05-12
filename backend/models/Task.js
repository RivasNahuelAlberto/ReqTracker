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
  goal: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'running', 'done', 'failed'],
    default: 'pending'
  },
  steps: [StepSchema]
}, {
  timestamps: true
});

export default mongoose.model('Task', TaskSchema);
