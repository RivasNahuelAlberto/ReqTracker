import Task from '../models/Task.js';
import Project from '../models/Project.js';

function toTaskPayload(item) {
  return {
    id: item._id?.toString(),
    number: item.number,
    priority: item.priority,
    description: item.description,
    targetType: item.targetType,
    targetId: item.targetId?.toString ? item.targetId.toString() : item.targetId,
    targetLabel: item.targetLabel,
    createdAt: item.createdAt
  };
}

export function createProjectTasksService({ ProjectModel = Project, TaskModel = Task } = {}) {
  async function ensureProject(projectId) {
    const project = await ProjectModel.findById(projectId);
    if (!project) {
      throw new Error('Proyecto no encontrado.');
    }
    return project;
  }

  async function syncTaskToProject(project, taskDoc) {
    const payload = toTaskPayload({ _id: taskDoc._id, ...(taskDoc.toObject ? taskDoc.toObject() : taskDoc) });
    const tasks = Array.isArray(project.tasks) ? project.tasks : [];
    const index = tasks.findIndex((item) => item._id?.toString() === payload.id);

    if (index >= 0) {
      tasks[index] = { ...tasks[index], ...payload };
    } else {
      tasks.push({ ...payload, createdAt: taskDoc.createdAt || new Date() });
    }

    project.tasks = tasks;
    if (typeof project.save === 'function') {
      await project.save();
    }
  }

  async function removeTaskFromProject(project, taskId) {
    const tasks = Array.isArray(project.tasks) ? project.tasks : [];
    project.tasks = tasks.filter((item) => item._id?.toString() !== taskId);
    if (typeof project.save === 'function') {
      await project.save();
    }
  }

  async function createTask(projectId, payload) {
    const project = await ensureProject(projectId);
    const description = payload.description?.toString().trim() || '';
    if (!description) {
      throw new Error('La descripción de la tarea es obligatoria.');
    }

    const nextNumber = (Array.isArray(project.tasks) ? project.tasks : []).reduce((max, item) => Math.max(max, item.number || 0), 0) + 1;
    const created = await TaskModel.create({
      project: project._id,
      number: nextNumber,
      priority: Number(payload.priority) || 3,
      description,
      targetType: payload.targetType?.toString().trim() || 'scenario',
      targetId: payload.targetId?.toString() || '',
      targetLabel: payload.targetLabel?.toString().trim() || '',
      createdAt: new Date()
    });

    await syncTaskToProject(project, created);

    return toTaskPayload(created);
  }

  async function getProjectTasks(projectId) {
    await ensureProject(projectId);
    const tasks = await TaskModel.find({ project: projectId }).sort({ createdAt: 1 });
    return tasks.map((item) => toTaskPayload(item));
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
    const project = await ensureProject(projectId);
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

    await syncTaskToProject(project, updated);

    return toTaskPayload(updated);
  }

  async function deleteTask(projectId, taskId) {
    const project = await ensureProject(projectId);
    const deleted = await TaskModel.deleteOne({ _id: taskId, project: projectId });
    if (deleted.deletedCount > 0) {
      await removeTaskFromProject(project, taskId);
    }
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
