import mongoose from 'mongoose';

/**
 * ETAPA 6: AnalyticsSnapshot Model
 * Almacena snapshots históricos de análisis del proyecto
 * Permite análisis histórico y detección de tendencias
 */

const analyticsSnapshotSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true
    },
    
    // Contexto del snapshot
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    
    // Cuántos requisitos había en este snapshot
    requirementsCount: {
      type: Number,
      required: true
    },
    
    symbolsCount: {
      type: Number,
      required: true
    },
    
    scenariosCount: {
      type: Number,
      default: 0
    },
    
    // Análisis de calidad
    qualityMetrics: {
      averageQuality: Number,
      lowQualityCount: Number,
      qualityIssues: [
        {
          requirementId: String,
          name: String,
          score: Number,
          problems: [String]
        }
      ]
    },
    
    // Análisis de riesgos
    riskMetrics: {
      totalRiskScore: Number,
      criticalRiskCount: Number,
      mediumRiskCount: Number,
      riskAnalysis: [
        {
          requirementId: String,
          name: String,
          level: String, // 'critical', 'high', 'medium', 'low'
          score: Number,
          factors: [String]
        }
      ]
    },
    
    // Análisis de duplicados
    duplicateMetrics: {
      duplicateCount: Number,
      potentialDuplicates: [
        {
          group: [
            {
              requirementId: String,
              name: String,
              similarity: Number
            }
          ],
          averageSimilarity: Number
        }
      ]
    },
    
    // Análisis de clustering
    clusteringMetrics: {
      clustersFound: Number,
      averageClusterSize: Number,
      clusterCohesion: Number,
      semanticPatterns: [
        {
          clusterId: Number,
          size: Number,
          theme: String,
          coherence: Number,
          members: [
            {
              requirementId: String,
              name: String
            }
          ]
        }
      ]
    },
    
    // Análisis de grafo
    graphMetrics: {
      totalNodes: Number,
      totalEdges: Number,
      density: Number,
      averagePathLength: Number,
      connectedComponents: Number,
      cycleCount: Number
    },
    
    // Resumen ejecutivo
    summary: {
      overallHealthScore: Number,
      criticalIssuesCount: Number,
      recommendations: [String],
      snapshot: String // Texto descriptivo del estado del proyecto
    },
    
    // Control de TTL: eliminar automáticamente después de 90 días
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 días
      index: { expireAfterSeconds: 0 }
    }
  },
  { timestamps: true }
);

// Índice compuesto para queries típicas
analyticsSnapshotSchema.index({ projectId: 1, timestamp: -1 });
analyticsSnapshotSchema.index({ projectId: 1, createdAt: -1 });

// Índice para TTL
analyticsSnapshotSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('AnalyticsSnapshot', analyticsSnapshotSchema);
