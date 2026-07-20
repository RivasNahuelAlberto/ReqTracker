import mongoose from 'mongoose';

/**
 * ETAPA 4 & 6: PredictionLog Model
 * Registra predicciones generadas por el motor de análisis
 * Permite evaluar precisión de predicciones y mejorar modelos
 */

const predictionLogSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true
    },
    
    // Tipo de predicción
    predictionType: {
      type: String,
      enum: [
        'requirement_risk',      // Riesgo de requisito
        'missing_requirement',   // Requisito faltante predicho
        'inconsistency_warning', // Inconsistencia predicha
        'quality_improvement',   // Sugerencia de mejora
        'duplicate_detection',   // Duplicado potencial
        'architecture_impact',   // Impacto en arquitectura
        'performance_risk'       // Riesgo de performance
      ],
      required: true,
      index: true
    },
    
    // Timestamp de predicción
    predictedAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    
    // Qué se predijo
    prediction: {
      subject: String,           // ¿Sobre qué es?
      description: String,       // Descripción de la predicción
      confidence: {
        type: Number,
        min: 0,
        max: 1,
        required: true           // 0-1: confianza en la predicción
      },
      severity: {
        type: String,
        enum: ['critical', 'high', 'medium', 'low'],
        default: 'medium'
      },
      recommendedAction: String  // ¿Qué hacer al respecto?
    },
    
    // Entidades involucradas
    entities: {
      requirementIds: [mongoose.Schema.Types.ObjectId],
      symbolIds: [mongoose.Schema.Types.ObjectId],
      scenarioIds: [mongoose.Schema.Types.ObjectId]
    },
    
    // Features que influenciaron la predicción
    features: {
      type: Map,
      of: Number  // Map<string, number> para feature importance
    },
    
    // Validación posterior (cuando sepamos si la predicción fue correcta)
    validation: {
      validated: { type: Boolean, default: false },
      validatedAt: Date,
      wasCorrect: Boolean,      // true = predicción correcta, false = falsa alarma
      notes: String,
      validatedBy: mongoose.Schema.Types.ObjectId  // User ID
    },
    
    // Métricas para evaluar modelo
    metrics: {
      processingTimeMs: Number,
      modelVersion: String,
      additionalContext: mongoose.Schema.Types.Mixed
    },
    
    // Control de TTL: mantener predicciones por 30 días
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
      index: { expireAfterSeconds: 0 }
    }
  },
  { timestamps: true }
);

// Índices para queries
predictionLogSchema.index({ projectId: 1, predictedAt: -1 });
predictionLogSchema.index({ projectId: 1, predictionType: 1, validated: 1 });
predictionLogSchema.index({ 'validation.wasCorrect': 1 }); // Para evaluar accuracy
predictionLogSchema.index({ 'prediction.severity': 1 });
predictionLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('PredictionLog', predictionLogSchema);
