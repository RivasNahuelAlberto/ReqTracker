import mongoose from 'mongoose';

const RequirementSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  identifier: { type: String, default: '' },
  name: { type: String, required: true },
  type: { type: String, default: '' },
  description: { type: String, default: '' },
  basis: { type: String, default: '' },
  priority: { type: String, enum: ['Alta', 'Media', 'Baja'], default: 'Media' },
  criticidad: { type: String, enum: ['Alta', 'Media', 'Baja'], default: 'Media' },
  costoImplementacion: { type: String, enum: ['Alto', 'Medio', 'Bajo'], default: 'Medio' },
  volatilidad: { type: String, enum: ['Alta', 'Media', 'Baja'], default: 'Media' },
  factibilidad: { type: String, enum: ['Alta', 'Media', 'Baja'], default: 'Media' },
  riesgo: { type: String, enum: ['Alto', 'Medio', 'Bajo'], default: 'Medio' },
  status: { type: String, default: 'Nuevo' },
  embedding: { type: [Number], default: [] },
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

RequirementSchema.index({ project: 1, name: 1 });

export default mongoose.model('Requirement', RequirementSchema);
