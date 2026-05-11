import Project from '../../models/Project.js';
import { emitProjectDataChanged } from '../../socket.js';

export async function createResolveNote({ projectId, text }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para crear una nota A Resolver.');
  }
  if (!text || !text.toString().trim()) {
    throw new Error('El texto de la nota es obligatorio.');
  }

  const project = await Project.findById(projectId);
  if (!project) {
    throw new Error('Proyecto no encontrado.');
  }

  project.resolveNotes = project.resolveNotes || [];
  project.resolveNotes.push({ text: text.toString().trim() });
  await project.save();

  emitProjectDataChanged(projectId, 'El asistente agregó una nota A Resolver al proyecto. Haz clic para recargar.');

  const created = project.resolveNotes.at(-1);
  return {
    id: created._id.toString(),
    text: created.text,
    createdAt: created.createdAt
  };
}

export async function getResolveNote({ projectId, noteId }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para obtener una nota A Resolver.');
  }
  if (!noteId) {
    throw new Error('noteId es obligatorio para obtener una nota A Resolver.');
  }

  const project = await Project.findById(projectId).lean();
  if (!project) {
    throw new Error('Proyecto no encontrado.');
  }

  const note = (project.resolveNotes || []).find((item) => item._id?.toString() === noteId);
  if (!note) {
    throw new Error('Nota A Resolver no encontrada.');
  }

  return {
    id: note._id.toString(),
    text: note.text,
    createdAt: note.createdAt
  };
}

export async function listResolveNotes({ projectId }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para listar notas A Resolver.');
  }

  const project = await Project.findById(projectId).lean();
  if (!project) {
    throw new Error('Proyecto no encontrado.');
  }

  return (project.resolveNotes || []).map((note) => ({
    id: note._id.toString(),
    text: note.text,
    createdAt: note.createdAt
  }));
}

export async function updateResolveNote({ projectId, noteId, text }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para actualizar una nota A Resolver.');
  }
  if (!noteId) {
    throw new Error('noteId es obligatorio para actualizar una nota A Resolver.');
  }
  if (!text || !text.toString().trim()) {
    throw new Error('El texto de la nota es obligatorio.');
  }

  const project = await Project.findById(projectId);
  if (!project) {
    throw new Error('Proyecto no encontrado.');
  }

  const note = project.resolveNotes.id(noteId);
  if (!note) {
    throw new Error('Nota A Resolver no encontrada.');
  }

  note.text = text.toString().trim();
  await project.save();
  emitProjectDataChanged(projectId, 'El asistente actualizó una nota A Resolver del proyecto. Haz clic para recargar.');

  return {
    id: note._id.toString(),
    text: note.text,
    createdAt: note.createdAt
  };
}

export async function deleteResolveNote({ projectId, noteId }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para eliminar una nota A Resolver.');
  }
  if (!noteId) {
    throw new Error('noteId es obligatorio para eliminar una nota A Resolver.');
  }

  const project = await Project.findById(projectId);
  if (!project) {
    throw new Error('Proyecto no encontrado.');
  }

  const noteIndex = project.resolveNotes.findIndex((item) => item._id?.toString() === noteId);
  if (noteIndex === -1) {
    throw new Error('Nota A Resolver no encontrada.');
  }

  project.resolveNotes.splice(noteIndex, 1);
  await project.save();
  emitProjectDataChanged(projectId, 'El asistente eliminó una nota A Resolver del proyecto. Haz clic para recargar.');

  return { message: 'Nota A Resolver eliminada.' };
}
