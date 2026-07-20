import mongoose from 'mongoose';

const RelationSchema = new mongoose.Schema({
  fromType: {
    type: String,
    enum: ['requirement', 'symbol', 'scenario', 'task', 'inspection'],
    required: true
  },
  fromId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  toType: {
    type: String,
    enum: ['requirement', 'symbol', 'scenario', 'task', 'inspection'],
    required: true
  },
  toId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  type: {
    type: String,
    enum: ['depends_on', 'implements', 'related_to', 'blocks', 'affects', 'references'],
    required: true
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  strength: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  }
}, {
  timestamps: true
});

// Índices para búsquedas eficientes
RelationSchema.index({ projectId: 1, fromId: 1, toId: 1 });
RelationSchema.index({ projectId: 1, fromType: 1 });
RelationSchema.index({ projectId: 1, toType: 1 });

export default mongoose.model('Relation', RelationSchema);