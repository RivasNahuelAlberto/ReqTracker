import Task from '../../models/Task.js';
import { getProjectSnapshot } from '../tools/projectSnapshot.tool.js';
import { getProjectGraph } from '../tools/graph.tool.js';
import { createPlan } from './planner.service.js';
import { executePlan } from './executor.service.js';
import { createFailureExplanation } from './failure.service.js';
import { generateAgentContext, formatAnalysisForPrompt } from '../embeddings.utils.js';
import { getCachedAgentContext, cacheAgentContext, invalidateProjectCache } from '../cache/redis.cache.js';
import StructuredLogger from '../logger/structured.logger.js';

const logger = new StructuredLogger('agent-controller');

/**
 * MEJORA 4: Parser robusto de planes
 * Mejora el manejo de JSON malformado o con texto extra
 * 
 * Estrategia:
 * 1. Intentar JSON.parse directo (texto limpio)
 * 2. Buscar bloques JSON entre {} con múltiples estrategias
 * 3. Validar schema básico del plan
 * 4. Retornar errores detallados para debugging
 */
function extractJson(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Input text is not a valid string.');
  }

  const originalText = text;
  const trimmedText = text.trim();

  // Estrategia 1: Intentar JSON.parse directo (si es texto limpio)
  try {
    const parsed = JSON.parse(trimmedText);
    if (parsed && typeof parsed === 'object') {
      logger.debug('JSON parsed successfully on first attempt', {
        textLength: text.length,
        strategy: 'direct_parse'
      });
      return parsed;
    }
  } catch (e) {
    // Continuar a siguiente estrategia
  }

  // Estrategia 2: Buscar JSON entre {} - intenta desde el inicio
  const jsonStartIndex = text.indexOf('{');
  if (jsonStartIndex === -1) {
    throw new Error('No JSON object found in text. Text does not contain opening brace {');
  }

  // Estrategia 3: Encontrar el cierre de JSON válido buscando desde múltiples posiciones
  // Comenzar desde el primer { encontrado
  let jsonText = null;
  let bracketDepth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = jsonStartIndex; i < text.length; i++) {
    const char = text[i];

    // Manejo de escape en strings
    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\' && inString) {
      escapeNext = true;
      continue;
    }

    // Toggle string state
    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }

    // Contar brackets fuera de strings
    if (!inString) {
      if (char === '{') {
        bracketDepth++;
      } else if (char === '}') {
        bracketDepth--;
        if (bracketDepth === 0) {
          // Encontramos el cierre de JSON válido
          jsonText = text.substring(jsonStartIndex, i + 1);
          break;
        }
      }
    }
  }

  if (!jsonText) {
    throw new Error('JSON object found but not properly closed. Missing closing brace }');
  }

  // Estrategia 4: Intentar parsear JSON extraído
  try {
    const parsed = JSON.parse(jsonText);
    if (parsed && typeof parsed === 'object') {
      logger.debug('JSON parsed successfully after extraction', {
        textLength: originalText.length,
        extractedLength: jsonText.length,
        strategy: 'bracket_matching'
      });
      return parsed;
    }
  } catch (parseError) {
    throw new Error(
      `Extracted JSON is invalid: ${parseError.message}. ` +
      `Extracted text: ${jsonText.substring(0, 200)}...`
    );
  }

  throw new Error('Failed to parse JSON: no valid object found');
}

/**
 * Calcula timeout adaptativo basado en tamaño del proyecto
 * MEJORA 6: Timeouts dinámicos para evitar falsos timeouts en proyectos grandes
 * 
 * Fórmula: base (5s) + (requisitos / 200) * 1s, máximo 15s
 * Justificación: Proyectos más grandes necesitan más tiempo
 * 
 * @param {Object} snapshot - Snapshot del proyecto con conteos
 * @returns {number} Timeout en milisegundos
 */
function calculateAdaptiveTimeout(snapshot) {
  const baseTimeoutMs = 5000;           // 5 segundos base
  const maxTimeoutMs = 15000;           // Máximo 15 segundos
  const timePerReq = 5;                 // 5ms por requisito
  
  // Contar requisitos totales
  const requirementCount = snapshot?.counts?.requirements || 0;
  
  // Calcular timeout adicional
  const additionalMs = (requirementCount / 200) * 1000;  // (reqs/200) * 1s
  
  // Calcular timeout total pero sin exceder máximo
  const totalTimeoutMs = Math.min(baseTimeoutMs + additionalMs, maxTimeoutMs);
  
  logger.debug('Adaptive timeout calculated', {
    baseMs: baseTimeoutMs,
    requirementCount,
    additionalMs,
    totalMs: totalTimeoutMs,
    maxMs: maxTimeoutMs
  });
  
  return Math.round(totalTimeoutMs);
}

/**
 * Validación de plan schema
 * MEJORA 4: Validación robusta de estructura de planes
 */
function validatePlanSchema(plan) {
  if (!plan || typeof plan !== 'object') {
    throw new Error('Plan is not a valid object');
  }

  // Validación básica - debe tener estos campos
  if (!('mode' in plan)) {
    throw new Error('Plan missing required field: mode');
  }

  // Si mode es "tools", debe tener steps
  if (plan.mode === 'tools') {
    if (!Array.isArray(plan.steps)) {
      throw new Error('Plan with mode "tools" must have a steps array');
    }
    if (plan.steps.length === 0) {
      throw new Error('Plan with mode "tools" must have at least one step');
    }
    
    // Validar cada step
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      if (!step.tool) {
        throw new Error(`Step ${i} missing required field: tool`);
      }
      if (!step.args || typeof step.args !== 'object') {
        throw new Error(`Step ${i} missing or invalid args field`);
      }
    }
  }

  // Si mode es "chat_only", steps debe estar vacío o no existir
  if (plan.mode === 'chat_only') {
    if (Array.isArray(plan.steps) && plan.steps.length > 0) {
      logger.warn('Plan in chat_only mode has steps, which will be ignored');
    }
  }

  return true;
}

export async function runAgent(req, res) {
  // MEJORA 7: Colección de métricas durante ejecución
  const executionStartTime = Date.now();
  const metrics = {
    projectId: req.body?.projectId,
    goal: req.body?.goal?.substring(0, 100),
    startTime: new Date().toISOString(),
    stages: {},
    success: false,
    error: null
  };

  try {
    const { goal, projectId } = req.body;
    if (!goal || !projectId) {
      logger.warn('Invalid request parameters', { goal, projectId });
      return res.status(400).json({ error: 'projectId y goal son requeridos.' });
    }

    logger.info('Starting agent execution', { goal, projectId });

    const snapshot = await getProjectSnapshot({ projectId });
    metrics.stages.snapshot = { duration: Date.now() - executionStartTime };
    
    const rawGraph = await getProjectGraph({ projectId });
    metrics.stages.graph = { duration: Date.now() - executionStartTime - (metrics.stages.snapshot?.duration || 0) };

    // GRAPH CONTRACT NORMALIZATION
    let graph = [];
    if (rawGraph && typeof rawGraph === 'object') {
      if (Array.isArray(rawGraph)) {
        graph = rawGraph;
      } else if (Array.isArray(rawGraph.relations)) {
        graph = rawGraph.relations;
      } else if (Array.isArray(rawGraph.nodes)) {
        graph = rawGraph.nodes;
      }
    }

    // Enrich snapshot with analytics context (with caching)
    let analyticsContext = '';
    const analyticsStartTime = Date.now();
    
    // MEJORA 6: Usar timeout adaptativo para analytics
    const analyticsTimeoutMs = calculateAdaptiveTimeout(snapshot);
    
    try {
      // Try to get from cache first
      let analysis = await getCachedAgentContext(projectId);
      let cacheHit = !!analysis;
      
      if (!analysis) {
        // Set adaptive timeout for analytics
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Analytics context generation timeout (${analyticsTimeoutMs}ms)`)), analyticsTimeoutMs)
        );
        
        analysis = await Promise.race([
          generateAgentContext(snapshot),
          timeoutPromise
        ]);
        
        // Cache the result for future use
        await cacheAgentContext(projectId, analysis, 3600); // 1 hour TTL
      }
      
      analyticsContext = formatAnalysisForPrompt(analysis);
      const analyticsDuration = Date.now() - analyticsStartTime;
      logger.logAgentContext(projectId, analyticsDuration, cacheHit);
      
      // MEJORA 7: Registrar métricas de analytics
      metrics.stages.analytics = {
        duration: analyticsDuration,
        cacheHit,
        timeout: analyticsTimeoutMs
      };
    } catch (error) {
      const analyticsDuration = Date.now() - analyticsStartTime;
      logger.warn(`Analytics context failed (${analyticsDuration}ms)`, { 
        projectId, 
        error: error.message 
      });
      // Continue without context (graceful degradation)
    }

    const planText = await createPlan({ goal, snapshot, graph, analyticsContext });
    metrics.stages.planning = { 
      duration: Date.now() - executionStartTime - (Object.values(metrics.stages).reduce((sum, s) => sum + (s.duration || 0), 0))
    };
    
    let parsedPlan;
    try {
      // MEJORA 4: Usar parser robusto y validar schema
      parsedPlan = extractJson(planText);
      validatePlanSchema(parsedPlan); // Validar estructura del plan
      
      logger.info('Plan parsed and validated successfully', {
        projectId,
        mode: parsedPlan.mode,
        stepsCount: Array.isArray(parsedPlan.steps) ? parsedPlan.steps.length : 0
      });
    } catch (parseError) {
      logger.error('Plan parsing or validation failed', {
        projectId,
        error: parseError.message
      });
      
      const failureExplanation = await createFailureExplanation({
        goal,
        planText,
        failureStage: 'plan parsing',
        error: parseError.message
      });
      return res.status(500).json({
        error: 'El plan generado no pudo ser interpretado: ' + parseError.message,
        failureExplanation
      });
    }

    // Validación adicional - el plan debe tener contenido válido
    if (!parsedPlan || typeof parsedPlan !== 'object') {
      const failureExplanation = await createFailureExplanation({
        goal,
        planText,
        failureStage: 'plan validation',
        error: 'El plan no es un objeto válido.'
      });
      return res.status(500).json({
        error: 'El plan generado no es válido.',
        failureExplanation
      });
    }

    const task = await Task.create({
      projectId,
      goal,
      status: 'pending',
      steps: parsedPlan.steps.map((step) => ({
        description: step.description || 'Paso sin descripción',
        tool: step.tool || 'unknown',
        args: step.args || {},
        status: 'pending'
      }))
    });

    const executedTask = await executePlan(task);

    let failureExplanation = '';
    if (executedTask.status === 'failed' || executedTask.steps.some((step) => step.status === 'failed')) {
      failureExplanation = await createFailureExplanation({
        goal,
        planText,
        task: executedTask,
        failureStage: 'execution'
      });
      executedTask.explanation = failureExplanation;
      await executedTask.save();
    }

    // MEJORA 7: Registrar métricas de ejecución
    const totalDuration = Date.now() - executionStartTime;
    metrics.stages.execution = {
      duration: totalDuration - Object.values(metrics.stages).reduce((sum, s) => sum + (s.duration || 0), 0),
      stepsTotal: executedTask.steps?.length || 0,
      stepsCompleted: executedTask.steps?.filter(s => s.status === 'done').length || 0,
      stepsFailed: executedTask.steps?.filter(s => s.status === 'failed').length || 0
    };

    metrics.totalDuration = totalDuration;
    metrics.success = executedTask.status === 'done';
    metrics.endTime = new Date().toISOString();

    // MEJORA 7: Log detallado de métricas
    logger.info('Agent execution completed with metrics', {
      metrics: {
        projectId: metrics.projectId,
        totalDuration: metrics.totalDuration,
        success: metrics.success,
        stages: metrics.stages,
        taskStatus: executedTask.status,
        stepStats: metrics.stages.execution
      }
    });

    res.json({ task: executedTask, planText, failureExplanation, metrics });
  } catch (err) {
    const totalDuration = Date.now() - executionStartTime;
    
    // MEJORA 7: Log de error con métricas
    metrics.success = false;
    metrics.error = err.message;
    metrics.totalDuration = totalDuration;
    metrics.endTime = new Date().toISOString();
    
    logger.error('Agent execution failed', { 
      projectId: metrics.projectId,
      goal: metrics.goal,
      error: err.message,
      duration: totalDuration,
      metrics
    });
    res.status(500).json({ error: err.message || 'Agent error', metrics });
  }
}
