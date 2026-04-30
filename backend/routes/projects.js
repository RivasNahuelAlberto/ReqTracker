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

  const created = await Promise.all(seeds.map((item, index) => {
    const name = typeof item === 'string' ? item : item.name;
    const type = typeof item === 'string' ? 'General' : item.type || 'General';
    return SymbolModel.create({
      name,
      type,
      isSeed: true,
      order: `${index + 1}`,
      project: projectId
    });
  }));

  const ids = created.map((symbol) => symbol._id);
  await Project.findByIdAndUpdate(projectId, { symbols: ids });
  return created;
}

router.get('/', async (req, res) => {
  try {
    const projects = await Project.find().sort({ createdAt: -1 }).lean();
    const response = projects.map((project) => ({
      _id: project._id,
      name: project.name,
      createdAt: project.createdAt,
      hasSecurity: Boolean(project.securityCode)
    }));
    res.json(response);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, seedSymbols, securityCode } = req.body;
    if (!name) return res.status(400).json({ message: 'El nombre del proyecto es requerido.' });
    if (!securityCode || !securityCode.toString().trim()) {
      return res.status(400).json({ message: 'El código de seguridad es obligatorio.' });
    }
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
    const project = await Project.create({ name, securityCode: securityCode.toString().trim() });
    const symbols = await createSeedSymbols(project._id, seedSymbols);
    const responseProject = project.toObject();
    delete responseProject.securityCode;
    responseProject.hasSecurity = true;
    res.status(201).json({ ...responseProject, symbols });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:projectId', async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId).lean();
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado.' });
    const symbols = await SymbolModel.find({ project: project._id }).sort({ createdAt: 1 }).lean();
    const responseProject = {
      _id: project._id,
      name: project.name,
      createdAt: project.createdAt,
      hasSecurity: Boolean(project.securityCode),
      resolveNotes: project.resolveNotes || [],
      scenarios: project.scenarios || [],
      assistantConfig: project.assistantConfig || {}
    };
    res.json({ ...responseProject, symbols });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:projectId/scenarios', async (req, res) => {
  try {
    const {
      type,
      title,
      objective,
      locationTemporal,
      locationGeographic,
      preconditions,
      actors,
      resources,
      episodes,
      exceptions,
      order
    } = req.body;
    if (!type || !title || !title.toString().trim()) {
      return res.status(400).json({ message: 'El tipo y el título del escenario son obligatorios.' });
    }
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado.' });
    const scenario = {
      type: type.toString().trim(),
      title: title.toString().trim(),
      objective: objective?.toString().trim() || '',
      locationTemporal: locationTemporal?.toString().trim() || '',
      locationGeographic: locationGeographic?.toString().trim() || '',
      preconditions: preconditions?.toString().trim() || '',
      actors: actors?.toString().trim() || '',
      resources: resources?.toString().trim() || '',
      episodes: episodes?.toString().trim() || '',
      exceptions: exceptions?.toString().trim() || '',
      order: order?.toString().trim() || ''
    };
    project.scenarios.push(scenario);
    await project.save();
    const createdScenario = project.scenarios[project.scenarios.length - 1].toObject();
    res.status(201).json(createdScenario);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:projectId/scenarios/:scenarioId', async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado.' });
    let scenario = project.scenarios.id(req.params.scenarioId);
    if (!scenario) {
      const index = project.scenarios.findIndex((item) => item._id?.toString() === req.params.scenarioId);
      scenario = index >= 0 ? project.scenarios[index] : null;
    }
    if (!scenario) return res.status(404).json({ message: 'Escenario no encontrado.' });
    const updates = req.body;
    scenario.type = updates.type?.toString().trim() || scenario.type;
    scenario.title = updates.title?.toString().trim() || scenario.title;
    scenario.objective = updates.objective?.toString().trim() || '';
    scenario.locationTemporal = updates.locationTemporal?.toString().trim() || '';
    scenario.locationGeographic = updates.locationGeographic?.toString().trim() || '';
    scenario.preconditions = updates.preconditions?.toString().trim() || '';
    scenario.actors = updates.actors?.toString().trim() || '';
    scenario.resources = updates.resources?.toString().trim() || '';
    scenario.episodes = updates.episodes?.toString().trim() || '';
    scenario.exceptions = updates.exceptions?.toString().trim() || '';
    scenario.order = updates.order?.toString().trim() || '';
    await project.save();
    res.json(scenario);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:projectId/scenarios/:scenarioId', async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado.' });
    const scenarioIndex = project.scenarios.findIndex((item) => item._id.toString() === req.params.scenarioId);
    if (scenarioIndex === -1) return res.status(404).json({ message: 'Escenario no encontrado.' });
    project.scenarios.splice(scenarioIndex, 1);
    await project.save();
    res.json({ message: 'Escenario eliminado.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

async function setProjectSecurityHandler(req, res) {
  try {
    const { securityCode } = req.body;
    if (!securityCode || !securityCode.toString().trim()) {
      return res.status(400).json({ message: 'El código de seguridad es obligatorio.' });
    }
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado.' });
    if (project.securityCode) {
      return res.status(400).json({ message: 'El proyecto ya tiene un código de seguridad.' });
    }
    project.securityCode = securityCode.toString().trim();
    await project.save();
    res.json({ hasSecurity: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

router.put('/:projectId/security', setProjectSecurityHandler);
router.patch('/:projectId/security', setProjectSecurityHandler);

router.post('/:projectId/resolve-notes', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.toString().trim()) {
      return res.status(400).json({ message: 'El texto de la nota es obligatorio.' });
    }
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado.' });
    project.resolveNotes.push({ text: text.toString().trim() });
    await project.save();
    res.status(201).json(project.resolveNotes.at(-1));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:projectId/resolve-notes/:noteId', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.toString().trim()) {
      return res.status(400).json({ message: 'El texto de la nota es obligatorio.' });
    }
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado.' });
    const note = project.resolveNotes.id(req.params.noteId);
    if (!note) return res.status(404).json({ message: 'Nota no encontrada.' });
    note.text = text.toString().trim();
    await project.save();
    res.json(note);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch('/:projectId/resolve-notes/:noteId/resolve', async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado.' });
    const noteIndex = project.resolveNotes.findIndex((item) => item._id.toString() === req.params.noteId);
    if (noteIndex === -1) return res.status(404).json({ message: 'Nota no encontrada.' });
    project.resolveNotes.splice(noteIndex, 1);
    await project.save();
    res.json({ message: 'Nota marcada como resuelta y eliminada.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:projectId/resolve-notes/:noteId', async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado.' });
    const noteIndex = project.resolveNotes.findIndex((item) => item._id.toString() === req.params.noteId);
    if (noteIndex === -1) return res.status(404).json({ message: 'Nota no encontrada.' });
    project.resolveNotes.splice(noteIndex, 1);
    await project.save();
    res.json({ message: 'Nota eliminada.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:projectId', async (req, res) => {
  try {
    const { securityCode } = req.body;
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado.' });
    if (!project.securityCode) {
      return res.status(400).json({ message: 'El proyecto no tiene código de seguridad. Establece uno antes de eliminarlo.' });
    }
    if (!securityCode || securityCode.toString().trim() !== project.securityCode) {
      return res.status(403).json({ message: 'Código de seguridad incorrecto.' });
    }
    await SymbolModel.deleteMany({ project: req.params.projectId });
    await Project.findByIdAndDelete(req.params.projectId);
    res.json({ message: 'Proyecto eliminado' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
