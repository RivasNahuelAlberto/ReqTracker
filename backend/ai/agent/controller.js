import Task from '../../models/Task.js';
import { getProjectSnapshot } from '../tools/projectSnapshot.tool.js';
import { getProjectGraph } from '../tools/graph.tool.js';
import { createPlan } from './planner.service.js';
import { executePlan } from './executor.service.js';
import { createFailureExplanation } from './failure.service.js';

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
      return res.status(400).json({ error: 'projectId y goal son requeridos.' });
    }

    const snapshot = await getProjectSnapshot({ projectId });
    const graph = await getProjectGraph({ projectId });

    const planText = await createPlan({ goal, snapshot, graph });
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
    console.error('Agent error:', err);
    res.status(500).json({ error: err.message || 'Agent error' });
  }
}
