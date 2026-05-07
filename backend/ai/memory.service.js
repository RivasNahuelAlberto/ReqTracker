import MemoryModel from '../models/Memory.js';
import { generateEmbedding } from './embeddings.js';

export async function saveMemory({ userId, projectId, type, content, source = 'agent' }) {
  if (!userId) {
    throw new Error('userId es obligatorio para guardar memoria.');
  }
  if (!type || !type.toString().trim()) {
    throw new Error('El tipo de memoria es obligatorio.');
  }
  if (!content || !content.toString().trim()) {
    throw new Error('El contenido de la memoria es obligatorio.');
  }

  let embedding = [];
  try {
    embedding = await generateEmbedding(content.toString().trim());
  } catch (error) {
    console.warn('No se pudo generar embedding para la memoria:', error.message);
  }

  const memory = new MemoryModel({
    userId: userId.toString(),
    project: projectId || null,
    type: type.toString().trim(),
    content: content.toString().trim(),
    source: source?.toString().trim() || 'agent',
    embedding
  });

  await memory.save();

  return {
    id: memory._id.toString(),
    userId: memory.userId,
    projectId: memory.project?.toString() || null,
    type: memory.type,
    content: memory.content,
    source: memory.source,
    createdAt: memory.createdAt
  };
}

export async function getRecentMemory({ userId, projectId, limit = 5 }) {
  if (!userId) {
    return [];
  }

  const filter = { userId: userId.toString() };
  if (projectId) {
    filter.project = projectId;
  }

  const memories = await MemoryModel.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return memories.map((memory) => ({
    id: memory._id.toString(),
    userId: memory.userId,
    projectId: memory.project?.toString() || null,
    type: memory.type,
    content: memory.content,
    source: memory.source,
    createdAt: memory.createdAt
  }));
}
