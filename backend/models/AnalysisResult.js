import mongoose from 'mongoose';

const AnalysisResultSchema = new mongoose.Schema({
  // Tipo de análisis realizado
  analysisType: {
    type: String,
    required: true,
    enum: ['compare-entities', 'analyze-text', 'generate-embeddings', 'compare-requirements']
  },

  // Datos de entrada del análisis
  input: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },

  // Resultados del análisis
  output: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },

  // Metadata del análisis
  metadata: {
    // Tiempo de procesamiento en ms
    processingTime: {
      type: Number,
      required: true
    },

    // Timestamp del análisis
    timestamp: {
      type: Date,
      default: Date.now
    },

    // Usuario que realizó el análisis (si está autenticado)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false
    },

    // Proyecto relacionado (opcional)
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: false
    },

    // Versión del modelo utilizado
    modelVersion: {
      type: String,
      default: '1.0.0'
    },

    // Estado del análisis
    status: {
      type: String,
      enum: ['success', 'error', 'partial'],
      default: 'success'
    },

    // Error message si falló
    errorMessage: {
      type: String,
      required: false
    }
  },

  // Embeddings generados (solo para generate-embeddings)
  embeddings: [{
    text: String,
    vector: [Number],
    model: String
  }],

  // Entidades extraídas (solo para analyze-text)
  entities: [{
    text: String,
    label: String,
    confidence: Number,
    start: Number,
    end: Number
  }],

  // Keywords extraídas (solo para analyze-text)
  keywords: [{
    word: String,
    score: Number
  }],

  // Análisis de sentimiento (solo para analyze-text)
  sentiment: {
    label: String,
    score: Number,
    confidence: Number
  },

  // Similitud calculada (para compare-entities y compare-requirements)
  similarity: {
    score: Number,
    method: String,
    interpretation: String
  },

  // Cache para evitar re-análisis
  cache: {
    key: String,
    expiresAt: Date
  }
}, {
  timestamps: true
});

// Índices para optimización
AnalysisResultSchema.index({ 'metadata.timestamp': -1 });
AnalysisResultSchema.index({ 'metadata.userId': 1 });
AnalysisResultSchema.index({ 'metadata.projectId': 1 });
AnalysisResultSchema.index({ analysisType: 1 });
AnalysisResultSchema.index({ 'cache.key': 1 });
AnalysisResultSchema.index({ 'cache.expiresAt': 1 });

// Método para verificar si un resultado está en cache y es válido
AnalysisResultSchema.methods.isCacheValid = function() {
  return this.cache.expiresAt && this.cache.expiresAt > new Date();
};

// Método estático para buscar en cache
AnalysisResultSchema.statics.findInCache = function(cacheKey) {
  return this.findOne({
    'cache.key': cacheKey,
    'cache.expiresAt': { $gt: new Date() }
  });
};

// Método para limpiar cache expirado (útil para mantenimiento)
AnalysisResultSchema.statics.cleanExpiredCache = function() {
  return this.deleteMany({
    'cache.expiresAt': { $lte: new Date() }
  });
};

const AnalysisResult = mongoose.model('AnalysisResult', AnalysisResultSchema);

export default AnalysisResult;