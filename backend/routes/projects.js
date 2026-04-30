const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const SymbolModel = require('../models/Symbol');

function validateSeedSymbolsUnique(items) {
  const seen = new Set();
  for (const item of items) {
    const name = String(item.name || '').trim().toLowerCase();
    const type = String(item.type || 'General').trim().toLowerCase();
    const key = `${type}|${name}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
  }
  return true;
}

async function createSeedSymbols(projectId, items = null) {
  const seeds = Array.isArray(items) && items.length > 0
    ? items
    : ['A', 'B', 'C'];

  const created = await Promise.all(seeds.map((item) => {
    const name = typeof item === 'string' ? item : item.name;
    const type = typeof item === 'string' ? 'General' : item.type || 'General';
    return SymbolModel.create({
      name,
      type,
      isSeed: true,
      project: projectId
    });
  }));

  const ids = created.map((symbol) => symbol._id);
  await Project.findByIdAndUpdate(projectId, { symbols: ids });
  return created;
}

router.get('/', async (req, res) => {
  try {
    const projects = await Project.find().sort({ createdAt: -1 });
    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, seedSymbols } = req.body;
    if (!name) return res.status(400).json({ message: 'El nombre del proyecto es requerido.' });
    if (!Array.isArray(seedSymbols) || seedSymbols.length === 0) {
      return res.status(400).json({ message: 'Se requiere al menos un símbolo semilla.' });
    }
    const invalidSeed = seedSymbols.find((item) => !item?.name || !item?.type);
    if (invalidSeed) {
      return res.status(400).json({ message: 'Todos los símbolos semilla deben tener nombre y tipo.' });
    }
    if (!validateSeedSymbolsUnique(seedSymbols)) {
      return res.status(400).json({ message: 'Los símbolos semilla no deben repetir nombre y tipo.' });
    }
    const project = await Project.create({ name });
    const symbols = await createSeedSymbols(project._id, seedSymbols);
    res.status(201).json({ ...project.toObject(), symbols });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:projectId', async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId).lean();
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado.' });
    const symbols = await SymbolModel.find({ project: project._id }).sort({ createdAt: 1 }).lean();
    res.json({ ...project, symbols });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:projectId', async (req, res) => {
  try {
    await SymbolModel.deleteMany({ project: req.params.projectId });
    await Project.findByIdAndDelete(req.params.projectId);
    res.json({ message: 'Proyecto eliminado' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
