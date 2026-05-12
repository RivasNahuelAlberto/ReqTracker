import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  actor: {
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true }
  },
  action: { type: String, required: true },
  targetType: { type: String, enum: ['task', 'inspection', 'resolve_note', 'project', 'graph'], required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  targetLabel: { type: String, default: '' },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

export default mongoose.model('Notification', NotificationSchema);