import express from 'express';
import SymbolModel from '../models/Symbol.js';
import Project from '../models/Project.js';
import { requireAuth, authorizeRoles, authorizeProjectRoles } from '../middleware/auth.js';
import { emitProjectDataChanged, emitGlobalDataChanged } from '../socket.js';
import { generateSymbolEmbedding, invalidateEmbeddingCache } from '../ai/embeddings.js';
import { getAnalyticsAutoUpdater } from '../ai/analytics-auto-updater.service.js';

const router = express.Router();

async function ensureUniqueNameForType(projectId, name, type, excludeId = null) {
  return await SymbolModel.isDuplicateNameForType(projectId, name, type, excludeId);
}

router.get('/:projectId/symbols', requireAuth, authorizeProjectRoles('invitado', 'usuario', 'admin', 'super_admin'), async (req, res) => {
  try {
    const symbols = await SymbolModel.find({ project: req.params.projectId }).sort({ createdAt: 1 }).lean();
    res.json(symbols);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:projectId/symbols', requireAuth, authorizeProjectRoles('usuario', 'admin', 'super_admin'), async (req, res) => {
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
    
    // Generar embedding de manera asincrónica sin bloquear la respuesta
    try {
      const embedding = await generateSymbolEmbedding(symbol);
      if (embedding && embedding.length > 0) {
        symbol.embedding = embedding;
        await symbol.save();
      }
    } catch (embeddingError) {
      console.warn('No se pudo generar embedding para el símbolo:', embeddingError.message);
      // No fallar la creación si falla el embedding
    }
    
    await Project.findByIdAndUpdate(req.params.projectId, { $push: { symbols: symbol._id } });
    emitProjectDataChanged(req.params.projectId, 'Se agregó un símbolo al proyecto. Haz clic para recargar.');
    
    // ETAPA 8: Auto-update analytics for new symbol (non-blocking)
    const autoUpdater = getAnalyticsAutoUpdater();
    autoUpdater.processSymbolChange(req.params.projectId, null, symbol).catch(err => {
      console.warn('Auto-update failed for new symbol:', err.message);
    });
    
    res.status(201).json(symbol);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:projectId/symbols/import', requireAuth, authorizeProjectRoles('usuario', 'admin', 'super_admin'), async (req, res) => {
  try {
    const { symbols } = req.body;
    if (!Array.isArray(symbols)) {
      return res.status(400).json({ message: 'Se requiere un array de símbolos.' });
    }

    const projectId = req.params.projectId;
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Proyecto no encontrado.' });
    }

    let inserted = 0;
    let skipped = 0;
    let invalid = 0;
    const createdIds = [];
    let seedCount = await SymbolModel.countDocuments({ project: projectId, isSeed: true });

    for (const symbolData of symbols) {
      const name = symbolData?.name?.toString().trim();
      const type = symbolData?.type?.toString().trim();
      const notion = symbolData?.notion?.toString().trim() || '';
      const impact = symbolData?.impact?.toString().trim() || '';

      if (!name || !type) {
        invalid += 1;
        continue;
      }

      const duplicate = await SymbolModel.isDuplicateNameForType(projectId, name, type);
      if (duplicate) {
        skipped += 1;
        continue;
      }

      seedCount += 1;
      const symbol = await SymbolModel.create({
        name,
        type,
        notion,
        impact,
        isSeed: true,
        parentSymbol: null,
        order: `${seedCount}`,
        status: 'incomplete',
        reviewNotes: '',
        project: projectId
      });

      try {
        const embedding = await generateSymbolEmbedding(symbol);
        if (Array.isArray(embedding) && embedding.length > 0) {
          symbol.embedding = embedding;
          await symbol.save();
        }
      } catch (embeddingError) {
        console.warn('No se pudo generar embedding para el símbolo importado:', embeddingError.message);
      }

      inserted += 1;
      createdIds.push(symbol._id);
    }

    if (createdIds.length > 0) {
      await Project.findByIdAndUpdate(projectId, { $push: { symbols: { $each: createdIds } } });
    }

    emitProjectDataChanged(projectId, `Importación de símbolos completada. Insertados: ${inserted}, omitidos: ${skipped + invalid}.`);
    res.json({ inserted, skipped, invalid });
  } catch (error) {
    res.status(500).json({ message: error.message });

    // ETAPA 8: Capturar símbolo anterior para analytics auto-updater
    const oldSymbol = { ...symbol };

  }
});

router.put('/:projectId/symbols/:symbolId', requireAuth, authorizeProjectRoles('usuario', 'admin', 'super_admin'), async (req, res) => {
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
    
    // Invalidar cache del embedding antiguo si se actualizan campos relevantes
    if (updates.name || updates.notion || updates.impact) {
      const oldText = [symbol.name, symbol.notion, symbol.impact]
        .filter(text => text && text.toString().trim())
        .join(' ');
      
      if (oldText) {
        await invalidateEmbeddingCache(oldText).catch(err => {
          console.warn('Failed to invalidate old symbol embedding cache:', err.message);
        });
      }
    }

    const updatedSymbol = await SymbolModel.findOneAndUpdate(
      { _id: req.params.symbolId, project: req.params.projectId },
      updates,
      { new: true }
    ).lean();
    
    // Regenerar embedding si se actualizaron campos relevantes
    if (updates.name || updates.notion || updates.impact) {
      try {
        const embedding = await generateSymbolEmbedding(updatedSymbol);
        if (embedding && embedding.length > 0) {
          await SymbolModel.findByIdAndUpdate(req.params.symbolId, { embedding });
          updatedSymbol.embedding = embedding;
        }
      } catch (embeddingError) {
        console.warn('No se pudo regenerar embedding para el símbolo:', embeddingError.message);
        // No fallar la actualización si falla el embedding
    
    // ETAPA 8: Auto-update analytics for symbol changes (non-blocking)
    const autoUpdater = getAnalyticsAutoUpdater();
    autoUpdater.processSymbolChange(req.params.projectId, oldSymbol, req.body).catch(err => {
      console.warn('Auto-update failed for symbol update:', err.message);
    });
    
      }
    }
    
    emitProjectDataChanged(req.params.projectId, 'Se actualizó un símbolo del proyecto. Haz clic para recargar.');
    res.json(updatedSymbol);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:projectId/symbols/:symbolId', requireAuth, authorizeProjectRoles('usuario', 'admin', 'super_admin'), async (req, res) => {
  try {
    const symbol = await SymbolModel.findOne({ _id: req.params.symbolId, project: req.params.projectId });
    if (!symbol) return res.status(404).json({ message: 'Símbolo no encontrado.' });

    // Invalidar cache del embedding del símbolo eliminado
    const deletedText = [symbol.name, symbol.notion, symbol.impact]
      .filter(text => text && text.toString().trim())
      .join(' ');
    
    if (deletedText) {
      await invalidateEmbeddingCache(deletedText).catch(err => {
        console.warn('Failed to invalidate deleted symbol embedding cache:', err.message);
      });
    }

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
    emitProjectDataChanged(req.params.projectId, 'Se eliminó un símbolo del proyecto. Haz clic para recargar.');
    res.json({ message: 'Símbolo eliminado' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
