import Task from '../models/Task.js';
import Project from '../models/Project.js';

function toTaskPayload(item) {
  const id = item?._id?.toString?.() || item?.id?.toString?.() || '';
  return {
    _id: id,
    id,
    number: item.number,
    priority: item.priority,
    description: item.description,
    targetType: item.targetType,
    targetId: item.targetId?.toString ? item.targetId.toString() : item.targetId,
    targetLabel: item.targetLabel,
    createdAt: item.createdAt
  };
}

async function listTasks(TaskModel, projectId) {
  const query = TaskModel.find({ project: projectId });

  if (query && typeof query.lean === 'function') {
    return query.sort({ createdAt: 1 }).lean();
  }

  if (query && typeof query.sort === 'function') {
    return query.sort({ createdAt: 1 });
  }

  return query;
}

export function createProjectTasksService({ ProjectModel = Project, TaskModel = Task } = {}) {
  async function ensureProject(projectId) {
    const project = await ProjectModel.findById(projectId);
    if (!project) {
      throw new Error('Proyecto no encontrado.');
    }
    return project;
  }

  async function createTask(projectId, payload = {}) {
    const project = await ensureProject(projectId);
    const normalizedPayload = payload || {};
    const description = normalizedPayload.description?.toString().trim() || '';

    const existingTasks = await listTasks(TaskModel, project._id);
    const normalizedTasks = Array.isArray(existingTasks) ? existingTasks : [];
    const nextNumber = normalizedTasks.reduce((max, item) => Math.max(max, item.number || 0), 0) + 1;
    const priorityValue = Number(normalizedPayload.priority);
    const created = await TaskModel.create({
      project: project._id,
      number: nextNumber,
      priority: Number.isFinite(priorityValue) ? priorityValue : 3,
      description,
      targetType: normalizedPayload.targetType?.toString().trim() || 'scenario',
      targetId: normalizedPayload.targetId?.toString() || '',
      targetLabel: normalizedPayload.targetLabel?.toString().trim() || '',
      createdAt: new Date()
    });

    return toTaskPayload(created);
  }

  async function getProjectTasks(projectId) {
    await ensureProject(projectId);
    const tasks = await listTasks(TaskModel, projectId);
    return (Array.isArray(tasks) ? tasks : []).map((item) => toTaskPayload(item));
  }

  async function getTask(projectId, taskId) {
    await ensureProject(projectId);
    const task = await TaskModel.findOne({ _id: taskId, project: projectId });
    if (!task) {
      throw new Error('Tarea no encontrada.');
    }
    return toTaskPayload(task);
  }

  async function updateTask(projectId, taskId, payload) {
    await ensureProject(projectId);
    const existing = await TaskModel.findOne({ _id: taskId, project: projectId });
    if (!existing) {
      throw new Error('Tarea no encontrada.');
    }

    const updated = await TaskModel.findByIdAndUpdate(taskId, {
      ...(payload.description !== undefined ? { description: payload.description?.toString().trim() || existing.description } : {}),
      ...(payload.priority !== undefined ? { priority: Number(payload.priority) || existing.priority } : {}),
      ...(payload.targetType !== undefined ? { targetType: payload.targetType?.toString().trim() || existing.targetType } : {}),
      ...(payload.targetId !== undefined ? { targetId: payload.targetId?.toString() || '' } : {}),
      ...(payload.targetLabel !== undefined ? { targetLabel: payload.targetLabel?.toString().trim() || '' } : {})
    }, { new: true });

    return toTaskPayload(updated);
  }

  async function deleteTask(projectId, taskId) {
    await ensureProject(projectId);
    const deleted = await TaskModel.deleteOne({ _id: taskId, project: projectId });
    return { deleted: deleted.deletedCount > 0 };
  }

  return {
    createTask,
    getProjectTasks,
    getTask,
    updateTask,
    deleteTask
  };
}
