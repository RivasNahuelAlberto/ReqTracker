import SymbolModel from '../../models/Symbol.js';

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
