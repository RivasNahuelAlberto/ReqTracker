import Task from '../../models/Task.js';
import { toolImplementations } from './toolImplementations.js';

export async function executePlan(task) {
  if (!task) {
    throw new Error('Tarea inválida para ejecutar.');
  }

  task.status = 'running';

  for (const step of task.steps) {
    if (step.status === 'done') {
      continue;
    }

    try {
      const tool = toolImplementations[step.tool];
      if (!tool) {
        throw new Error(`Tool no implementada: ${step.tool}`);
      }

      const args = typeof step.args === 'object' && step.args !== null ? step.args : {};
      const result = await tool(args);
      step.status = 'done';
      step.result = result;
    } catch (err) {
      step.status = 'failed';
      step.error = err.message || String(err);
      task.status = 'failed';
    }
  }

  if (task.steps.every((step) => step.status === 'done')) {
    task.status = 'done';
  }

  await task.save();
  return task;
}
