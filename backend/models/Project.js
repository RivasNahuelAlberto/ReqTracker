import mongoose from 'mongoose';

const ProjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  projectHash: { type: String, unique: true, sparse: true }, // Código hash para invitar usuarios
  securityCode: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  documents: [{
    id: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['texto', 'archivo'], default: 'texto' },
    description: { type: String, default: '' },
    fileName: { type: String, default: '' },
    extension: { type: String, default: '' },
    content: { type: String, default: '' },
    embedding: { type: [Number], default: [] }
  }],
  scenarios: [{
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
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
  }],
  about: {
    intro: { type: String, default: '' },
    items: { type: [String], default: [] }
  },
  tasks: [{
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    number: { type: Number, required: true },
    priority: { type: Number, min: 1, max: 5, default: 3 },
    description: { type: String, required: true },
    targetType: { type: String, enum: ['symbol', 'scenario', 'requirement'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    targetLabel: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
  }],
  inspections: [{
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    targetType: { type: String, enum: ['symbol', 'scenario'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    targetLabel: { type: String, default: '' },
    aspect: { type: String, required: true },
    description: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  requirements: [{
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
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
    embedding: { type: [Number], default: [] }, // Vector de embedding para búsqueda semántica
    createdAt: { type: Date, default: Date.now }
  }],
  locks: [{
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    targetType: { type: String, required: true },
    targetId: { type: String, required: true },
    sessionId: { type: String, required: true },
    lockedBy: { type: String, default: 'Usuario' },
    lockedAt: { type: Date, default: Date.now }
  }],
  assistantConfig: {
    provider: { type: String, default: '' },
    connected: { type: Boolean, default: false }
  },
  symbols: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Symbol' }]
});

export default mongoose.model('Project', ProjectSchema);
