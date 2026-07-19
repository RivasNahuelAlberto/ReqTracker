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
      text,
      status: 'pending'
    });

    return {
      id: created._id.toString(),
      text: created.text,
      status: created.status,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt
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
      status: note.status,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt
    };
  }

  async function listResolveNotes(projectId) {
    await ensureProject(projectId);
    const notes = await ResolveNoteModel.find({ project: projectId }).sort({ createdAt: 1 });
    return notes.map((note) => ({
      id: note._id.toString(),
      text: note.text,
      status: note.status,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt
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
      status: updated.status,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt
    };
  }

  async function resolveResolveNote(projectId, noteId) {
    await ensureProject(projectId);
    const updated = await ResolveNoteModel.findOneAndUpdate(
      { _id: noteId, project: projectId },
      { status: 'resolved' },
      { new: true }
    );
    if (!updated) {
      throw new Error('Nota A Resolver no encontrada.');
    }
    return {
      id: updated._id.toString(),
      text: updated.text,
      status: updated.status,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt
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
    resolveResolveNote,
    deleteResolveNote
  };
}
