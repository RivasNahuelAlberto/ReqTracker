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

function extractJson(text) {
  const jsonMatch = text.match(/\{[\s\S]*\}/m);
  if (!jsonMatch) {
    throw new Error('No se pudo extraer JSON del plan.');
  }
  return JSON.parse(jsonMatch[0]);
}

export async function runAgent(req, res) {
  try {
    const { goal, projectId } = req.body;
    if (!goal || !projectId) {
      logger.warn('Invalid request parameters', { goal, projectId });
      return res.status(400).json({ error: 'projectId y goal son requeridos.' });
    }

    logger.info('Starting agent execution', { goal, projectId });

    const snapshot = await getProjectSnapshot({ projectId });
    const rawGraph = await getProjectGraph({ projectId });

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
    try {
      // Try to get from cache first
      let analysis = await getCachedAgentContext(projectId);
      let cacheHit = !!analysis;
      
      if (!analysis) {
        // Set timeout for analytics (5s max)
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Analytics context generation timeout')), 5000)
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
    } catch (error) {
      const analyticsDuration = Date.now() - analyticsStartTime;
      logger.warn(`Analytics context failed (${analyticsDuration}ms)`, { 
        projectId, 
        error: error.message 
      });
      // Continue without context (graceful degradation)
    }

    const planText = await createPlan({ goal, snapshot, graph, analyticsContext });
    let parsedPlan;
    try {
      parsedPlan = extractJson(planText);
    } catch (parseError) {
      const failureExplanation = await createFailureExplanation({
        goal,
        planText,
        failureStage: 'plan parsing',
        error: parseError.message
      });
      return res.status(500).json({
        error: 'El plan generado no pudo ser interpretado.',
        failureExplanation
      });
    }

    if (!parsedPlan || !Array.isArray(parsedPlan.steps)) {
      const failureExplanation = await createFailureExplanation({
        goal,
        planText,
        failureStage: 'plan validation',
        error: 'El plan no contiene un array de pasos válido.'
      });
      return res.status(500).json({
        error: 'El plan generado no incluye pasos válidos.',
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

    res.json({ task: executedTask, planText, failureExplanation });
  } catch (err) {
    logger.error('Agent execution failed', { 
      projectId: req.body?.projectId,
      goal: req.body?.goal,
      error: err.message,
      stack: err.stack
    });
    res.status(500).json({ error: err.message || 'Agent error' });
  }
}
