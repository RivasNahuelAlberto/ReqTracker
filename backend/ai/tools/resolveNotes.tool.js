import Project from '../../models/Project.js';
import ResolveNote from '../../models/ResolveNote.js';
import { createResolveNotesService } from '../../services/resolveNotes.service.js';
import { emitProjectDataChanged } from '../../socket.js';

const resolveNotesService = createResolveNotesService({
  ProjectModel: Project,
  ResolveNoteModel: ResolveNote
});

export async function createResolveNote({ projectId, text }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para crear una nota A Resolver.');
  }
  if (!text || !text.toString().trim()) {
    throw new Error('El texto de la nota es obligatorio.');
  }

  const created = await resolveNotesService.createResolveNote(projectId, { text });

  emitProjectDataChanged(projectId, 'El asistente agregó una nota A Resolver al proyecto. Haz clic para recargar.');

  return created;
}

export async function getResolveNote({ projectId, noteId }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para obtener una nota A Resolver.');
  }
  if (!noteId) {
    throw new Error('noteId es obligatorio para obtener una nota A Resolver.');
  }

  return resolveNotesService.getResolveNote(projectId, noteId);
}

export async function listResolveNotes({ projectId }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para listar notas A Resolver.');
  }

  return resolveNotesService.listResolveNotes(projectId);
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

  const updated = await resolveNotesService.updateResolveNote(projectId, noteId, { text });
  emitProjectDataChanged(projectId, 'El asistente actualizó una nota A Resolver del proyecto. Haz clic para recargar.');

  return updated;
}

export async function deleteResolveNote({ projectId, noteId }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para eliminar una nota A Resolver.');
  }
  if (!noteId) {
    throw new Error('noteId es obligatorio para eliminar una nota A Resolver.');
  }

  const deleted = await resolveNotesService.deleteResolveNote(projectId, noteId);
  if (!deleted.deleted) {
    throw new Error('Nota A Resolver no encontrada.');
  }
  emitProjectDataChanged(projectId, 'El asistente eliminó una nota A Resolver del proyecto. Haz clic para recargar.');

  return { message: 'Nota A Resolver eliminada.' };
}
