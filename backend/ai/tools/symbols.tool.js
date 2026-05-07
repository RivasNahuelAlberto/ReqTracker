import SymbolModel from '../../models/Symbol.js';
import { generateEmbedding } from '../embeddings.js';

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
