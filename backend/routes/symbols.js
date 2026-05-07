import express from 'express';
import SymbolModel from '../models/Symbol.js';
import Project from '../models/Project.js';

const router = express.Router();

async function ensureUniqueNameForType(projectId, name, type, excludeId = null) {
  return await SymbolModel.isDuplicateNameForType(projectId, name, type, excludeId);
}

router.get('/:projectId/symbols', async (req, res) => {
  try {
    const symbols = await SymbolModel.find({ project: req.params.projectId }).sort({ createdAt: 1 }).lean();
    res.json(symbols);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:projectId/symbols', async (req, res) => {
  try {
    const { name, type, parentSymbol, isSeed, order } = req.body;
    if (!name) return res.status(400).json({ message: 'El nombre del símbolo es requerido.' });
    const validType = type || 'General';
    const duplicateError = await SymbolModel.isDuplicateNameForType(req.params.projectId, name, validType);
    if (duplicateError) return res.status(400).json({ message: 'Ya existe un símbolo con el mismo nombre y tipo.' });
    const isDerived = Boolean(parentSymbol);
    let symbolOrder = order?.toString().trim() || '';

    if (!symbolOrder) {
      if (!isDerived) {
        const seedCount = await SymbolModel.countDocuments({ project: req.params.projectId, isSeed: true });
        symbolOrder = `${seedCount + 1}`;
      } else {
        const parent = await SymbolModel.findById(parentSymbol);
        const siblingCount = await SymbolModel.countDocuments({ project: req.params.projectId, parentSymbol });
        symbolOrder = parent?.order ? `${parent.order}.${siblingCount + 1}` : `${siblingCount + 1}`;
      }
    }

    const symbol = await SymbolModel.create({
      name,
      type: validType,
      isSeed: isDerived ? false : isSeed === true,
      parentSymbol: parentSymbol || null,
      order: symbolOrder,
      project: req.params.projectId
    });
    await Project.findByIdAndUpdate(req.params.projectId, { $push: { symbols: symbol._id } });
    const io = req.app.get('io');
    if (io) io.to(req.params.projectId).emit('projectUpdated');
    res.status(201).json(symbol);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:projectId/symbols/:symbolId', async (req, res) => {
  try {
    const symbol = await SymbolModel.findOne({ _id: req.params.symbolId, project: req.params.projectId }).lean();
    if (!symbol) return res.status(404).json({ message: 'Símbolo no encontrado.' });

    const allowedFields = ['name', 'type', 'parentSymbol', 'isSeed', 'notion', 'impact', 'reviewNotes', 'status', 'order'];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => allowedFields.includes(key))
    );

    if (updates.parentSymbol === '') {
      updates.parentSymbol = null;
    }

    if (updates.parentSymbol === req.params.symbolId) {
      return res.status(400).json({ message: 'Un símbolo no puede depender de sí mismo.' });
    }

    const newName = updates.name ?? symbol.name;
    const newType = updates.type ?? symbol.type;
    if (newName && newType) {
      const duplicateExists = await SymbolModel.isDuplicateNameForType(
        req.params.projectId,
        newName,
        newType,
        req.params.symbolId
      );
      if (duplicateExists) {
        return res.status(400).json({ message: 'Ya existe un símbolo con el mismo nombre y tipo.' });
      }
    }

    if (updates.parentSymbol) {
      updates.isSeed = false;
    } else if (Object.prototype.hasOwnProperty.call(updates, 'parentSymbol')) {
      updates.isSeed = true;
    }

    if (symbol.parentSymbol && updates.isSeed === true && updates.parentSymbol) {
      updates.isSeed = false;
    }

    const updatedSymbol = await SymbolModel.findOneAndUpdate(
      { _id: req.params.symbolId, project: req.params.projectId },
      updates,
      { new: true }
    ).lean();
    const io = req.app.get('io');
    if (io) io.to(req.params.projectId).emit('projectUpdated');
    res.json(updatedSymbol);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:projectId/symbols/:symbolId', async (req, res) => {
  try {
    const symbol = await SymbolModel.findOne({ _id: req.params.symbolId, project: req.params.projectId });
    if (!symbol) return res.status(404).json({ message: 'Símbolo no encontrado.' });

    const parentSymbolId = symbol.parentSymbol || null;
    const childSymbols = await SymbolModel.find({ parentSymbol: symbol._id, project: req.params.projectId });

    await Promise.all(childSymbols.map((child) => {
      const update = parentSymbolId
        ? { parentSymbol: parentSymbolId, isSeed: false }
        : { parentSymbol: null, isSeed: true };
      return SymbolModel.findByIdAndUpdate(child._id, update);
    }));

    await SymbolModel.deleteOne({ _id: req.params.symbolId, project: req.params.projectId });

    await Project.findByIdAndUpdate(req.params.projectId, { $pull: { symbols: req.params.symbolId } });
    const io = req.app.get('io');
    if (io) io.to(req.params.projectId).emit('projectUpdated');
    res.json({ message: 'Símbolo eliminado' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
