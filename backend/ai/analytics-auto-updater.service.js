/**
 * ETAPA 8: Analytics Auto-Updater Service
 * 
 * Responsabilidades:
 * 1. Detectar cambios significativos en requisitos y símbolos
 * 2. Llamar a analytics service para re-análisis
 * 3. Emitir eventos socket cuando hay cambios importantes
 * 4. Mantener cache de últimas análisis
 * 
 * CRÍTICO: Non-blocking - no debe afectar performance de CRUD
 */

import StructuredLogger from './logger/structured.logger.js';
import { AnalyticsClient } from './analytics.client.js';
import {
  emitProjectAnalyticsUpdated,
  emitProjectGraphRecomputed,
  emitProjectSemanticDrift,
  emitProjectRiskDetected
} from '../socket.js';

const logger = new StructuredLogger('analytics-auto-updater');

/**
 * Umbral de cambio significativo para triggear re-análisis
 * Si alguno de estos % cambia, se considera significativo
 */
const SIGNIFICANCE_THRESHOLDS = {
  textChange: 0.15,      // 15% diferencia en texto
  qualityChange: 0.10,   // 10 puntos de calidad
  statusChange: true,    // Cualquier cambio de estado
  typeChange: true,      // Cualquier cambio de tipo
  basisChange: 0.20      // 20% diferencia en basis
};

/**
 * Analytics Auto-Updater Service
 */
export class AnalyticsAutoUpdater {
  constructor(analyticsClient = null) {
    this.analyticsClient = analyticsClient || new AnalyticsClient();
    this.isUpdating = new Map(); // projectId -> boolean (para evitar concurrent updates)
    this.logger = logger;
  }

  /**
   * Detecta si un cambio en requisito es significativo
   * @param {Object} oldRequirement - Requisito anterior
   * @param {Object} newData - Datos nuevos (parcial)
   * @returns {boolean} True si el cambio es significativo
   */
  isSignificantRequirementChange(oldRequirement, newData) {
    if (!oldRequirement) return true; // Nuevo requisito = significativo

    // Cambio de tipo
    if (newData.type !== undefined && newData.type !== oldRequirement.type) {
      return true;
    }

    // Cambio de estado
    if (newData.status !== undefined && newData.status !== oldRequirement.status) {
      return true;
    }

    // Cambio de nombre
    if (newData.name !== undefined && newData.name !== oldRequirement.name) {
      const similarity = this.calculateStringSimilarity(oldRequirement.name, newData.name);
      if (similarity < (1 - SIGNIFICANCE_THRESHOLDS.textChange)) {
        return true;
      }
    }

    // Cambio de descripción
    if (newData.description !== undefined && newData.description !== oldRequirement.description) {
      const similarity = this.calculateStringSimilarity(
        oldRequirement.description || '',
        newData.description || ''
      );
      if (similarity < (1 - SIGNIFICANCE_THRESHOLDS.textChange)) {
        return true;
      }
    }

    // Cambio de basis
    if (newData.basis !== undefined && newData.basis !== oldRequirement.basis) {
      const similarity = this.calculateStringSimilarity(
        oldRequirement.basis || '',
        newData.basis || ''
      );
      if (similarity < (1 - SIGNIFICANCE_THRESHOLDS.basisChange)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Detecta si un cambio en símbolo es significativo
   * @param {Object} oldSymbol - Símbolo anterior
   * @param {Object} newData - Datos nuevos (parcial)
   * @returns {boolean} True si el cambio es significativo
   */
  isSignificantSymbolChange(oldSymbol, newData) {
    if (!oldSymbol) return true; // Nuevo símbolo = significativo

    // Cambio de tipo
    if (newData.type !== undefined && newData.type !== oldSymbol.type) {
      return true;
    }

    // Cambio de nombre
    if (newData.name !== undefined && newData.name !== oldSymbol.name) {
      return true;
    }

    // Cambio de notion
    if (newData.notion !== undefined && newData.notion !== oldSymbol.notion) {
      const similarity = this.calculateStringSimilarity(
        oldSymbol.notion || '',
        newData.notion || ''
      );
      if (similarity < (1 - SIGNIFICANCE_THRESHOLDS.textChange)) {
        return true;
      }
    }

    // Cambio de impact
    if (newData.impact !== undefined && newData.impact !== oldSymbol.impact) {
      const similarity = this.calculateStringSimilarity(
        oldSymbol.impact || '',
        newData.impact || ''
      );
      if (similarity < (1 - SIGNIFICANCE_THRESHOLDS.textChange)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calcula similaridad de strings (0-1)
   * @param {string} str1
   * @param {string} str2
   * @returns {number} Similaridad de 0 a 1
   */
  calculateStringSimilarity(str1, str2) {
    if (!str1 || !str2) return str1 === str2 ? 1 : 0;

    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    // Lenvenshtein distance simplificado
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Distancia de Levenshtein
   */
  levenshteinDistance(s1, s2) {
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  }

  /**
   * Procesa cambio de requisito y dispara análisis si es significativo
   * @param {string} projectId
   * @param {Object} oldRequirement - Requisito anterior (completo)
   * @param {Object} newData - Datos nuevos (parcial o completo)
   * @returns {Promise<Object|null>} Análisis si se ejecutó, null si no
   */
  async processRequirementChange(projectId, oldRequirement, newData) {
    // Evitar concurrent updates
    if (this.isUpdating.get(projectId)) {
      this.logger.debug('Skipping requirement update - already updating', { projectId });
      return null;
    }

    // Detectar si cambio es significativo
    if (!this.isSignificantRequirementChange(oldRequirement, newData)) {
      this.logger.debug('Insignificant requirement change, skipping analytics', {
        projectId,
        requirementId: oldRequirement?._id
      });
      return null;
    }

    this.isUpdating.set(projectId, true);

    try {
      // Combinar datos antiguos con nuevos para tener la versión completa
      const fullRequirement = { ...oldRequirement, ...newData };

      this.logger.info('Processing significant requirement change', {
        projectId,
        requirementId: fullRequirement._id,
        changes: newData
      });

      // Llamar analytics para re-análisis (sin bloquear)
      this.callAnalyticsNonBlocking(projectId, fullRequirement, 'requirement');

      return { processed: true, projectId };
    } catch (error) {
      this.logger.error('Error processing requirement change', {
        projectId,
        error: error.message
      });
      return null;
    } finally {
      this.isUpdating.delete(projectId);
    }
  }

  /**
   * Procesa cambio de símbolo y dispara análisis si es significativo
   * @param {string} projectId
   * @param {Object} oldSymbol - Símbolo anterior
   * @param {Object} newData - Datos nuevos (parcial)
   * @returns {Promise<Object|null>} Análisis si se ejecutó, null si no
   */
  async processSymbolChange(projectId, oldSymbol, newData) {
    // Evitar concurrent updates
    if (this.isUpdating.get(`${projectId}-symbol`)) {
      this.logger.debug('Skipping symbol update - already updating', { projectId });
      return null;
    }

    // Detectar si cambio es significativo
    if (!this.isSignificantSymbolChange(oldSymbol, newData)) {
      this.logger.debug('Insignificant symbol change, skipping analytics', {
        projectId,
        symbolId: oldSymbol?._id
      });
      return null;
    }

    this.isUpdating.set(`${projectId}-symbol`, true);

    try {
      // Combinar datos
      const fullSymbol = { ...oldSymbol, ...newData };

      this.logger.info('Processing significant symbol change', {
        projectId,
        symbolId: fullSymbol._id,
        changes: newData
      });

      // Llamar analytics de manera no-blocking
      this.callAnalyticsNonBlocking(projectId, fullSymbol, 'symbol');

      return { processed: true, projectId };
    } catch (error) {
      this.logger.error('Error processing symbol change', {
        projectId,
        error: error.message
      });
      return null;
    } finally {
      this.isUpdating.delete(`${projectId}-symbol`);
    }
  }

  /**
   * Llama a analytics de manera no-blocking (fire-and-forget)
   * @private
   */
  callAnalyticsNonBlocking(projectId, entity, entityType) {
    // Ejecutar en background sin await
    setImmediate(async () => {
      try {
        const text = entity.name || entity.text || '';
        const description = entity.description || entity.notion || '';

        // Llamar /semantic/health endpoint
        const analysis = await this.analyticsClient.callAnalytics(
          '/semantic/health',
          {
            requirement: `${text}. ${description}`.trim(),
            context: [text],
            projectId
          }
        );

        // Emitir evento socket con resultado
        if (analysis) {
          const severity = analysis.verdict === 'low_quality' ? 'high' : 'medium';

          emitProjectAnalyticsUpdated(projectId, {
            endpoint: 'auto-analysis',
            entityType,
            entityId: entity._id,
            severity,
            analysis: {
              overall_score: analysis.overall_score,
              issues: analysis.issues,
              recommendations: analysis.recommendations
            }
          });

          // Si hay riesgo crítico, emitir evento especial
          if (severity === 'high') {
            emitProjectRiskDetected(projectId, {
              entityType,
              entityId: entity._id,
              riskScore: 100 - analysis.overall_score,
              message: `Riesgo detectado en ${entityType}: ${analysis.verdict}`
            });
          }

          this.logger.info('Analytics auto-update completed', {
            projectId,
            entityType,
            score: analysis.overall_score
          });
        }
      } catch (error) {
        // Silenciosamente fallar en background - no interrumpir CRUD
        this.logger.warn('Analytics auto-update failed', {
          projectId,
          entityType,
          error: error.message
        });
      }
    });
  }
}

/**
 * Singleton instance
 */
let instance = null;

export function getAnalyticsAutoUpdater(analyticsClient = null) {
  if (!instance) {
    instance = new AnalyticsAutoUpdater(analyticsClient);
  }
  return instance;
}

export default AnalyticsAutoUpdater;
