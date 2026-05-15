/**
 * ETAPA 9: Agent Analytics Client
 * 
 * Cliente para consumir análisis específico de agentes IA
 * desde el microservicio Python Analytics.
 * 
 * Expone métodos para:
 * - Analizar eficiencia de herramientas
 * - Puntuar confianza del planificador
 * - Trazar razonamiento del agente
 * - Detectar contaminación de contexto
 * - Estimar riesgo de alucinaciones
 */

import StructuredLogger from './logger/structured.logger.js';

const logger = new StructuredLogger('agent-analytics-client');

/**
 * Agent Analytics Client
 */
export class AgentAnalyticsClient {
  constructor(backendBaseUrl = null) {
    this.backendBaseUrl = backendBaseUrl || 'http://localhost:3000';
  }
  
  /**
   * Analiza eficiencia de herramientas del agente
   * 
   * @param {string} projectId - ID del proyecto
   * @param {Array} toolLogs - Logs de ejecución de herramientas
   * @returns {Promise<Object>} Análisis de eficiencia
   */
  async analyzeToolEfficiency(projectId, toolLogs = null) {
    try {
      logger.info('Analyzing tool efficiency', { projectId, toolCount: toolLogs?.length || 0 });
      
      const response = await fetch(`${this.backendBaseUrl}/api/agent/tool-efficiency`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          tool_logs: toolLogs
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`Tool efficiency analysis failed: ${data.error || response.statusText}`);
      }
      
      logger.info('Tool efficiency analysis completed', {
        projectId,
        overallEfficiency: data.overall_efficiency
      });
      
      return data;
    } catch (error) {
      logger.error('Error analyzing tool efficiency', { projectId, error: error.message });
      throw error;
    }
  }
  
  /**
   * Calcula puntuación de confianza del planificador
   * 
   * @param {string} projectId - ID del proyecto
   * @param {Object} planData - Datos del plan
   * @returns {Promise<Object>} Puntuación de confianza
   */
  async scorePlannerConfidence(projectId, planData = null) {
    try {
      logger.info('Scoring planner confidence', { projectId });
      
      const response = await fetch(`${this.backendBaseUrl}/api/agent/planner-confidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          plan_data: planData
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`Planner confidence scoring failed: ${data.error || response.statusText}`);
      }
      
      logger.info('Planner confidence scored', {
        projectId,
        overallScore: data.overall_score
      });
      
      return data;
    } catch (error) {
      logger.error('Error scoring planner confidence', { projectId, error: error.message });
      throw error;
    }
  }
  
  /**
   * Traza el razonamiento del agente
   * 
   * @param {string} executionId - ID de la ejecución
   * @param {Array} reasoningSteps - Pasos del razonamiento
   * @param {string} projectId - ID del proyecto (para broadcasting)
   * @returns {Promise<Object>} Razonamiento trazado
   */
  async traceReasoning(executionId, reasoningSteps = null, projectId = null) {
    try {
      logger.info('Tracing agent reasoning', { executionId, projectId, stepCount: reasoningSteps?.length || 0 });
      
      const response = await fetch(`${this.backendBaseUrl}/api/agent/reasoning-trace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          execution_id: executionId,
          reasoning_steps: reasoningSteps,
          project_id: projectId
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`Reasoning trace failed: ${data.error || response.statusText}`);
      }
      
      logger.info('Agent reasoning traced', {
        executionId,
        stepCount: data.reasoning_path?.length || 0
      });
      
      return data;
    } catch (error) {
      logger.error('Error tracing reasoning', { executionId, error: error.message });
      throw error;
    }
  }
  
  /**
   * Detecta contaminación de contexto
   * 
   * @param {string} query - Query del usuario
   * @param {Array} contextChunks - Chunks de contexto
   * @param {string} projectId - ID del proyecto
   * @returns {Promise<Object>} Análisis de contaminación
   */
  async detectContextPollution(query, contextChunks = null, projectId = null) {
    try {
      logger.info('Detecting context pollution', { projectId, chunkCount: contextChunks?.length || 0 });
      
      const response = await fetch(`${this.backendBaseUrl}/api/agent/context-pollution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          context_chunks: contextChunks,
          project_id: projectId
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`Context pollution detection failed: ${data.error || response.statusText}`);
      }
      
      if (data.pollution_detected) {
        logger.warn('Context pollution detected', {
          projectId,
          pollutionRatio: data.pollution_ratio
        });
      }
      
      return data;
    } catch (error) {
      logger.error('Error detecting context pollution', { projectId, error: error.message });
      throw error;
    }
  }
  
  /**
   * Estima riesgo de alucinaciones
   * 
   * @param {string} prompt - Prompt del usuario
   * @param {Array} context - Contexto recuperado
   * @param {Array} retrievalResults - Resultados de retrieval
   * @param {string} projectId - ID del proyecto
   * @returns {Promise<Object>} Estimación de riesgo
   */
  async estimateHallucinationRisk(prompt, context = null, retrievalResults = null, projectId = null) {
    try {
      logger.info('Estimating hallucination risk', { projectId });
      
      const response = await fetch(`${this.backendBaseUrl}/api/agent/hallucination-risk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          context,
          retrieval_results: retrievalResults,
          project_id: projectId
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`Hallucination risk estimation failed: ${data.error || response.statusText}`);
      }
      
      if (data.risk_level === 'risky') {
        logger.error('High hallucination risk detected', {
          projectId,
          riskScore: data.risk_score
        });
      }
      
      return data;
    } catch (error) {
      logger.error('Error estimating hallucination risk', { projectId, error: error.message });
      throw error;
    }
  }
  
  /**
   * Ejecuta múltiples análisis en batch (optimizado)
   * 
   * @param {string} projectId - ID del proyecto
   * @param {Object} analysisConfig - Configuración de análisis
   * @returns {Promise<Object>} Resultados de todos los análisis
   */
  async batchAnalysis(projectId, analysisConfig = {}) {
    try {
      logger.info('Executing batch agent analysis', {
        projectId,
        analysesCount: Object.keys(analysisConfig).filter(k => analysisConfig[k]).length
      });
      
      const response = await fetch(`${this.backendBaseUrl}/api/agent/batch-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          ...analysisConfig
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`Batch analysis failed: ${data.error || response.statusText}`);
      }
      
      logger.info('Batch analysis completed', {
        projectId,
        analysesCount: Object.keys(data.analyses || {}).length
      });
      
      return data;
    } catch (error) {
      logger.error('Error executing batch analysis', { projectId, error: error.message });
      throw error;
    }
  }
}

/**
 * Factory para obtener cliente singleton
 */
let clientInstance = null;

export function getAgentAnalyticsClient(backendBaseUrl = null) {
  if (!clientInstance) {
    clientInstance = new AgentAnalyticsClient(backendBaseUrl);
  }
  return clientInstance;
}

/**
 * Reset singleton (para testing)
 */
export function resetAgentAnalyticsClient() {
  clientInstance = null;
}

export default AgentAnalyticsClient;
