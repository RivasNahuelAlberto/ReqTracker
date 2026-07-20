import mongoose from 'mongoose';

const ScenarioSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  type: { type: String, required: true },
  title: { type: String, required: true },
  status: { type: String, default: 'incomplete' },
  objective: { type: String, default: '' },
  locationTemporal: { type: String, default: '' },
  locationGeographic: { type: String, default: '' },
  preconditions: { type: String, default: '' },
  actors: { type: String, default: '' },
  resources: { type: String, default: '' },
  episodes: { type: String, default: '' },
  exceptions: { type: String, default: '' },
  order: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

ScenarioSchema.index({ project: 1, title: 1 });

export default mongoose.model('Scenario', ScenarioSchema);
