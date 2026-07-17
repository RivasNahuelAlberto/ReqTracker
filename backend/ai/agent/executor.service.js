import Task from '../../models/Task.js';
import { toolImplementations } from './toolImplementations.js';
import { normalizeToolArgs } from './tool-args-normalizer.js';
import StructuredLogger from '../logger/structured.logger.js';

const logger = new StructuredLogger('agent-executor');

function extractResolvedEntity(result, normalizedArgs = {}) {
  const candidates = [
    result?.sourceSymbol,
    result?.symbol?.name,
    result?.entity?.name,
    result?.analysis?.sourceSymbol,
    result?.result?.sourceSymbol,
    result?.result?.symbol?.name,
    result?.result?.entity?.name,
    normalizedArgs?.symbolName,
    normalizedArgs?.entityName,
    normalizedArgs?.requirementText,
    normalizedArgs?.requirement,
    normalizedArgs?.name
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return { name: candidate.trim(), type: 'unknown', id: null };
    }
  }

  if (result?.entity?.type || result?.symbol?.type) {
    return {
      name: result?.entity?.name || result?.symbol?.name || '',
      type: result?.entity?.type || result?.symbol?.type || 'unknown',
      id: result?.entity?.id || result?.symbol?.id || null
    };
  }

  return null;
}

export async function executePlan(task) {
  if (!task) {
    throw new Error('Tarea inválida para ejecutar.');
  }

  logger.info('Starting plan execution', {
    taskId: task._id?.toString(),
    stepCount: task.steps?.length || 0,
    timestamp: new Date().toISOString()
  });

  task.status = 'running';
  const executionStartTime = Date.now();
  let completedSteps = 0;
  let failedSteps = 0;
  let sharedEntityContext = null;

  for (let stepIndex = 0; stepIndex < task.steps.length; stepIndex++) {
    const step = task.steps[stepIndex];
    
    if (step.status === 'done') {
      logger.debug(`Step already completed, skipping`, {
        stepIndex,
        tool: step.tool
      });
      completedSteps++;
      continue;
    }

    const stepStartTime = Date.now();
    
    try {
      logger.info(`Executing tool`, {
        stepIndex,
        tool: step.tool,
        args: step.args
      });

      const tool = toolImplementations[step.tool];
      if (!tool) {
        throw new Error(`Tool no implementada: ${step.tool}`);
      }

      const rawArgs = typeof step.args === 'object' && step.args !== null ? step.args : {};
      const previousStepResults = task.steps
        .slice(0, stepIndex)
        .map((previousStep) => previousStep.result)
        .filter(Boolean);

      const normalizedArgs = await normalizeToolArgs(step.tool, rawArgs, {
        projectId: task.projectId?.toString?.() || task.projectId,
        projectSnapshot: task.projectSnapshot || {},
        previousStepResults,
        resolvedEntity: sharedEntityContext,
        entityContext: sharedEntityContext
      });
      const result = await tool(normalizedArgs);
      
      const stepDuration = Date.now() - stepStartTime;
      
      step.status = 'done';
      step.result = result;
      step.executionTime = stepDuration;

      const extractedEntity = extractResolvedEntity(result, normalizedArgs);
      if (extractedEntity) {
        sharedEntityContext = extractedEntity;
      }
      
      logger.info(`Tool executed successfully`, {
        stepIndex,
        tool: step.tool,
        duration: stepDuration,
        resultType: typeof result,
        hasError: result?.error ? true : false
      });

      completedSteps++;
    } catch (err) {
      const stepDuration = Date.now() - stepStartTime;
      
      step.status = 'failed';
      step.error = err.message || String(err);
      step.executionTime = stepDuration;
      task.status = 'failed';
      failedSteps++;
      
      logger.error(`Tool execution failed`, {
        stepIndex,
        tool: step.tool,
        error: err.message,
        duration: stepDuration
      });
    }
  }

  const totalDuration = Date.now() - executionStartTime;
  
  if (task.steps.every((step) => step.status === 'done')) {
    task.status = 'done';
  }

  logger.info(`Plan execution completed`, {
    taskId: task._id?.toString(),
    totalSteps: task.steps.length,
    completedSteps,
    failedSteps,
    totalDuration,
    finalStatus: task.status,
    timestamp: new Date().toISOString()
  });

  await task.save();
  return task;
}
