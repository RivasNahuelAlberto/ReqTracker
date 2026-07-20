export function createProjectDocumentsService({ ProjectModel, DocumentModel }) {
  async function ensureProject(projectId) {
    const project = await ProjectModel.findById(projectId);
    if (!project) {
      throw new Error('Proyecto no encontrado.');
    }
    return project;
  }

  async function createDocument(projectId, payload) {
    const project = await ensureProject(projectId);
    const created = await DocumentModel.create({
      project: project._id,
      name: payload.name || '',
      type: payload.type || 'texto',
      description: payload.description || '',
      fileName: payload.fileName || '',
      extension: payload.extension || '',
      content: payload.content || '',
      embedding: payload.embedding || [],
      createdAt: new Date()
    });

    return {
      id: created._id.toString(),
      name: created.name,
      type: created.type,
      description: created.description,
      fileName: created.fileName,
      extension: created.extension,
      content: created.content,
      embedding: created.embedding || []
    };
  }

  async function getProjectDocuments(projectId) {
    await ensureProject(projectId);
    const documents = await DocumentModel.find({ project: projectId }).sort({ createdAt: 1 });
    return documents.map((item) => ({
      id: item._id.toString(),
      name: item.name,
      type: item.type,
      description: item.description,
      fileName: item.fileName,
      extension: item.extension,
      content: item.content,
      embedding: item.embedding || []
    }));
  }

  async function updateDocument(projectId, documentId, payload) {
    await ensureProject(projectId);
    const existing = await DocumentModel.findOne({ _id: documentId, project: projectId });
    if (!existing) {
      throw new Error('Documento no encontrado.');
    }

    const updated = await DocumentModel.findByIdAndUpdate(documentId, {
      ...(payload.name !== undefined ? { name: payload.name?.toString().trim() || existing.name } : {}),
      ...(payload.type !== undefined ? { type: payload.type?.toString().trim() || existing.type } : {}),
      ...(payload.description !== undefined ? { description: payload.description?.toString().trim() || existing.description } : {}),
      ...(payload.fileName !== undefined ? { fileName: payload.fileName?.toString().trim() || existing.fileName } : {}),
      ...(payload.extension !== undefined ? { extension: payload.extension?.toString().trim() || existing.extension } : {}),
      ...(payload.content !== undefined ? { content: payload.content?.toString() || existing.content } : {}),
      ...(payload.embedding !== undefined ? { embedding: payload.embedding || [] } : {})
    }, { new: true });

    return {
      id: updated._id.toString(),
      name: updated.name,
      type: updated.type,
      description: updated.description,
      fileName: updated.fileName,
      extension: updated.extension,
      content: updated.content,
      embedding: updated.embedding || []
    };
  }

  async function deleteDocument(projectId, documentId) {
    await ensureProject(projectId);
    const deleted = await DocumentModel.deleteOne({ _id: documentId, project: projectId });
    return { deleted: deleted.deletedCount > 0 };
  }

  return {
    createDocument,
    getProjectDocuments,
    updateDocument,
    deleteDocument
  };
}
