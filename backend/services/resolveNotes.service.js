import ResolveNote from '../models/ResolveNote.js';
import Project from '../models/Project.js';

export function createResolveNotesService({ ProjectModel = Project, ResolveNoteModel = ResolveNote } = {}) {
  async function ensureProject(projectId) {
    const project = await ProjectModel.findById(projectId);
    if (!project) {
      throw new Error('Proyecto no encontrado.');
    }
    return project;
  }

  async function createResolveNote(projectId, payload = {}) {
    await ensureProject(projectId);
    const text = payload.text?.toString().trim() || '';
    if (!text) {
      throw new Error('El texto de la nota es obligatorio.');
    }

    const created = await ResolveNoteModel.create({
      project: projectId,
      text
    });

    return {
      id: created._id.toString(),
      text: created.text,
      createdAt: created.createdAt
    };
  }

  async function getResolveNote(projectId, noteId) {
    await ensureProject(projectId);
    const note = await ResolveNoteModel.findOne({ _id: noteId, project: projectId });
    if (!note) {
      throw new Error('Nota A Resolver no encontrada.');
    }
    return {
      id: note._id.toString(),
      text: note.text,
      createdAt: note.createdAt
    };
  }

  async function listResolveNotes(projectId) {
    await ensureProject(projectId);
    const notes = await ResolveNoteModel.find({ project: projectId }).sort({ createdAt: 1 });
    return notes.map((note) => ({
      id: note._id.toString(),
      text: note.text,
      createdAt: note.createdAt
    }));
  }

  async function updateResolveNote(projectId, noteId, payload = {}) {
    await ensureProject(projectId);
    const existing = await ResolveNoteModel.findOne({ _id: noteId, project: projectId });
    if (!existing) {
      throw new Error('Nota A Resolver no encontrada.');
    }

    const text = payload.text?.toString().trim() || '';
    if (!text) {
      throw new Error('El texto de la nota es obligatorio.');
    }

    const updated = await ResolveNoteModel.findByIdAndUpdate(noteId, { text }, { new: true });
    return {
      id: updated._id.toString(),
      text: updated.text,
      createdAt: updated.createdAt
    };
  }

  async function deleteResolveNote(projectId, noteId) {
    await ensureProject(projectId);
    const deleted = await ResolveNoteModel.deleteOne({ _id: noteId, project: projectId });
    return { deleted: deleted.deletedCount > 0 };
  }

  return {
    createResolveNote,
    getResolveNote,
    listResolveNotes,
    updateResolveNote,
    deleteResolveNote
  };
}
