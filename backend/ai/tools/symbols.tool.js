import SymbolModel from '../../models/Symbol.js';
import Project from '../../models/Project.js';
import { generateEmbedding } from '../embeddings.js';
import { emitProjectDataChanged } from '../../socket.js';
import { invalidateProjectCache } from '../cache/redis.cache.js';

export async function createSymbol({ projectId, name, type = 'General', notion = '', impact = '' }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para crear un símbolo.');
  }
  if (!name || !name.toString().trim()) {
    throw new Error('El nombre del símbolo es obligatorio.');
  }

  const isDuplicate = await SymbolModel.isDuplicateNameForType(projectId, name, type);
  if (isDuplicate) {
    throw new Error(`Ya existe un símbolo con el nombre "${name}" y tipo "${type}".`);
  }

  // Generar embedding para el texto combinado
  const textToEmbed = `${name} ${type} ${notion} ${impact}`.trim();
  let embedding = [];
  try {
    embedding = await generateEmbedding(textToEmbed);
  } catch (error) {
    console.warn('No se pudo generar embedding:', error.message);
  }

  const symbol = new SymbolModel({
    name: name.toString().trim(),
    type: type?.toString().trim() || 'General',
    notion: notion?.toString().trim() || '',
    impact: impact?.toString().trim() || '',
    project: projectId,
    embedding
  });

  await symbol.save();
  
  // Invalidate cache for this project
  await invalidateProjectCache(projectId);
  
  emitProjectDataChanged(projectId, 'El asistente agregó un símbolo al proyecto. Haz clic para recargar.');

  return {
    id: symbol._id.toString(),
    name: symbol.name,
    type: symbol.type,
    notion: symbol.notion,
    impact: symbol.impact,
    status: symbol.status
  };
}

export async function listSymbols({ projectId }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para listar símbolos.');
  }

  const symbols = await SymbolModel.find({ project: projectId }).lean();
  return symbols.map((symbol) => ({
    id: symbol._id.toString(),
    name: symbol.name,
    type: symbol.type,
    isSeed: symbol.isSeed,
    parentSymbol: symbol.parentSymbol?.toString() || null,
    status: symbol.status,
    notion: symbol.notion,
    impact: symbol.impact
  }));
}

export async function getSymbol({ projectId, symbolId }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para obtener un símbolo.');
  }
  if (!symbolId) {
    throw new Error('symbolId es obligatorio para obtener un símbolo.');
  }

  const symbol = await SymbolModel.findOne({ _id: symbolId, project: projectId }).lean();
  if (!symbol) {
    throw new Error('Símbolo no encontrado.');
  }

  return {
    id: symbol._id.toString(),
    name: symbol.name,
    type: symbol.type,
    isSeed: symbol.isSeed,
    parentSymbol: symbol.parentSymbol?.toString() || null,
    status: symbol.status,
    notion: symbol.notion,
    impact: symbol.impact,
    reviewNotes: symbol.reviewNotes,
    order: symbol.order
  };
}

export async function updateSymbol({ projectId, symbolId, name, type, parentSymbol, isSeed, notion, impact, reviewNotes, status, order }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para actualizar un símbolo.');
  }
  if (!symbolId) {
    throw new Error('symbolId es obligatorio para actualizar un símbolo.');
  }

  const symbol = await SymbolModel.findOne({ _id: symbolId, project: projectId });
  if (!symbol) {
    throw new Error('Símbolo no encontrado.');
  }

  const updates = {};
  if (name !== undefined) updates.name = name?.toString().trim() || symbol.name;
  if (type !== undefined) updates.type = type?.toString().trim() || symbol.type;
  if (parentSymbol !== undefined) updates.parentSymbol = parentSymbol || null;
  if (isSeed !== undefined) updates.isSeed = Boolean(isSeed);
  if (notion !== undefined) updates.notion = notion?.toString().trim() || symbol.notion;
  if (impact !== undefined) updates.impact = impact?.toString().trim() || symbol.impact;
  if (reviewNotes !== undefined) updates.reviewNotes = reviewNotes?.toString().trim() || symbol.reviewNotes;
  if (status !== undefined) updates.status = status?.toString().trim() || symbol.status;
  if (order !== undefined) updates.order = order?.toString().trim() || symbol.order;

  const updatedSymbol = await SymbolModel.findOneAndUpdate(
    { _id: symbolId, project: projectId },
    updates,
    { new: true }
  ).lean();
  
  // Invalidate cache for this project
  await invalidateProjectCache(projectId);
  
  emitProjectDataChanged(projectId, 'El asistente modificó un símbolo del proyecto. Haz clic para recargar.');

  return {
    id: updatedSymbol._id.toString(),
    name: updatedSymbol.name,
    type: updatedSymbol.type,
    isSeed: updatedSymbol.isSeed,
    parentSymbol: updatedSymbol.parentSymbol?.toString() || null,
    status: updatedSymbol.status,
    notion: updatedSymbol.notion,
    impact: updatedSymbol.impact,
    reviewNotes: updatedSymbol.reviewNotes,
    order: updatedSymbol.order
  };
}

export async function deleteSymbol({ projectId, symbolId }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para eliminar un símbolo.');
  }
  if (!symbolId) {
    throw new Error('symbolId es obligatorio para eliminar un símbolo.');
  }

  const symbol = await SymbolModel.findOne({ _id: symbolId, project: projectId });
  if (!symbol) {
    throw new Error('Símbolo no encontrado.');
  }

  const parentSymbolId = symbol.parentSymbol || null;
  const childSymbols = await SymbolModel.find({ parentSymbol: symbol._id, project: projectId });

  await Promise.all(childSymbols.map((child) => {
    const update = parentSymbolId
      ? { parentSymbol: parentSymbolId, isSeed: false }
      : { parentSymbol: null, isSeed: true };
    return SymbolModel.findByIdAndUpdate(child._id, update);
  }));

  await SymbolModel.deleteOne({ _id: symbolId, project: projectId });

  // Invalidate cache for this project
  await invalidateProjectCache(projectId);
  
  emitProjectDataChanged(projectId, 'El asistente eliminó un símbolo del proyecto. Haz clic para recargar.');

  return { message: 'Símbolo eliminado.' };
}
