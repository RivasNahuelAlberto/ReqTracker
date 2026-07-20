import mongoose from 'mongoose';

/**
 * ETAPA 3 & 6: GraphMetrics Model
 * Almacena métricas de grafo de requisitos
 * Permite análisis de evolución de arquitectura y relaciones
 */

const graphMetricsSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true
    },
    
    // Timestamp de cálculo
    computedAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    
    // Métricas globales del grafo
    globalMetrics: {
      totalNodes: {
        type: Number,
        required: true
      },
      totalEdges: {
        type: Number,
        required: true
      },
      density: {
        type: Number,
        min: 0,
        max: 1
      },
      averagePathLength: Number,
      averageClusteringCoefficient: Number,
      diameterMeasure: Number,
      connectedComponents: Number,
      stronglyConnectedComponents: Number,
      cycleCount: Number,
      isDAG: Boolean
    },
    
    // Centralidad (qué nodos son más importantes)
    centrality: {
      betweenness: [
        {
          nodeId: mongoose.Schema.Types.ObjectId,
          nodeName: String,
          score: Number
        }
      ],
      closeness: [
        {
          nodeId: mongoose.Schema.Types.ObjectId,
          nodeName: String,
          score: Number
        }
      ],
      pagerank: [
        {
          nodeId: mongoose.Schema.Types.ObjectId,
          nodeName: String,
          score: Number
        }
      ],
      degree: [
        {
          nodeId: mongoose.Schema.Types.ObjectId,
          nodeName: String,
          inDegree: Number,
          outDegree: Number,
          totalDegree: Number
        }
      ]
    },
    
    // Comunidades detectadas (clustering)
    communities: {
      algorithm: String,        // 'louvain', 'label_propagation', etc.
      communityCount: Number,
      modularity: Number,
      communities: [
        {
          communityId: Number,
          size: Number,
          members: [
            {
              nodeId: mongoose.Schema.Types.ObjectId,
              nodeName: String
            }
          ],
          internalEdges: Number,
          externalEdges: Number
        }
      ]
    },
    
    // Análisis de impacto y propagación
    impactAnalysis: {
      propagationPaths: [
        {
          sourceId: mongoose.Schema.Types.ObjectId,
          targetId: mongoose.Schema.Types.ObjectId,
          pathLength: Number,
          criticalityScore: Number
        }
      ],
      bottlenecks: [
        {
          nodeId: mongoose.Schema.Types.ObjectId,
          nodeName: String,
          betweenness: Number,
          importance: String // 'critical', 'high', 'medium', 'low'
        }
      ],
      vulnerabilities: [
        {
          description: String,
          affectedNodes: Number,
          riskLevel: String
        }
      ]
    },
    
    // Análisis de ciclos (para detectar dependencias circulares)
    cycleAnalysis: {
      hasCycles: Boolean,
      cycleCount: Number,
      stronglyConnectedComponents: [
        {
          componentId: Number,
          size: Number,
          members: [
            {
              nodeId: mongoose.Schema.Types.ObjectId,
              nodeName: String
            }
          ],
          cycleLength: Number
        }
      ]
    },
    
    // Comparación con snapshot anterior
    trend: {
      previousSnapshotId: mongoose.Schema.Types.ObjectId,
      nodesAdded: Number,
      nodesRemoved: Number,
      edgesAdded: Number,
      edgesRemoved: Number,
      densityChange: Number,
      centralityShift: {
        nodesMostImportant: [String],
        nodesLeastImportant: [String]
      }
    },
    
    // Calidad del grafo
    quality: {
      redundancyScore: Number,
      fragmentationScore: Number,
      complexityScore: Number,
      overallHealthScore: Number,
      recommendations: [String]
    },
    
    // Control de TTL: mantener por 90 días
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      index: { expireAfterSeconds: 0 }
    }
  },
  { timestamps: true }
);

// Índices
graphMetricsSchema.index({ projectId: 1, computedAt: -1 });
graphMetricsSchema.index({ projectId: 1, createdAt: -1 });
graphMetricsSchema.index({ 'quality.overallHealthScore': 1 });
graphMetricsSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('GraphMetrics', graphMetricsSchema);
