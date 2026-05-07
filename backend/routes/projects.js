const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const SymbolModel = require('../models/Symbol');

function broadcastProjectUpdate(req, projectId) {
  const io = req.app.get('io');
  if (io && projectId) {
    io.to(projectId).emit('projectUpdated');
  }
}

function broadcastLockUpdate(req, projectId, locks) {
  const io = req.app.get('io');
  if (io && projectId) {
    io.to(projectId).emit('lockChanged', locks || []);
  }
}

function cleanDatabaseFields(obj) {
  if (Array.isArray(obj)) {
    return obj.map(item => cleanDatabaseFields(item));
  }
  if (obj && typeof obj === 'object') {
    const cleaned = {};
    for (const key in obj) {
      if (!['_id', 'createdAt', '__v'].includes(key)) {
        cleaned[key] = cleanDatabaseFields(obj[key]);
      }
    }
    return cleaned;
  }
  return obj;
}

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

router.post('/import', async (req, res) => {
  try {
    const cleanedData = cleanDatabaseFields(req.body);
    const {
      name,
      securityCode,
      documents,
      scenarios,
      about,
      tasks,
      inspections,
      resolveNotes,
      assistantConfig,
      symbols
    } = cleanedData;

    if (!name || !name.toString().trim()) {
      return res.status(400).json({ message: 'El nombre del proyecto es requerido.' });
    }
    if (!securityCode || !securityCode.toString().trim()) {
      return res.status(400).json({ message: 'El código de seguridad es obligatorio.' });
    }
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({ message: 'Se requiere al menos un símbolo para importar el proyecto.' });
    }

    // Create project first with empty tasks and inspections
    const project = await Project.create({
      name: name.toString().trim(),
      securityCode: securityCode.toString().trim(),
      documents: Array.isArray(documents) ? documents : [],
      scenarios: Array.isArray(scenarios) ? scenarios : [],
      about: {
        intro: about?.intro || '',
        items: Array.isArray(about?.items) ? about.items : []
      },
      tasks: [],
      inspections: [],
      resolveNotes: Array.isArray(resolveNotes) ? resolveNotes : [],
      assistantConfig: assistantConfig || {}
    });

    // Create symbols with project reference
    const symbolDocs = symbols.map((symbol) => ({
      name: symbol.name,
      type: symbol.type || 'General',
      isSeed: symbol.isSeed === true,
      order: symbol.order || '',
      notion: symbol.notion || '',
      impact: symbol.impact || '',
      reviewNotes: symbol.reviewNotes || '',
      status: ['incomplete', 'review', 'complete'].includes(symbol.status) ? symbol.status : 'incomplete',
      parentSymbol: symbol.parentSymbol || null,
      project: project._id
    }));

    const insertedSymbols = await SymbolModel.insertMany(symbolDocs);

    // Create maps for targetId resolution
    const symbolMap = {};
    insertedSymbols.forEach(symbol => {
      symbolMap[symbol.name] = symbol._id;
    });

    const scenarioMap = {};
    project.scenarios.forEach(scenario => {
      scenarioMap[scenario.title] = scenario._id;
    });

    // Map tasks targetId from name to ObjectId
    const mappedTasks = Array.isArray(tasks)
      ? tasks.map((task, index) => {
          const mappedTargetId = task.targetType === 'scenario'
            ? scenarioMap[task.targetId]
            : symbolMap[task.targetId];
          if (!mappedTargetId) return null; // skip if target not found
          return {
            number: task.number || index + 1,
            priority: task.priority || 3,
            description: task.description || '',
            targetType: task.targetType,
            targetId: mappedTargetId,
            targetLabel: task.targetLabel || ''
          };
        }).filter(task => task !== null)
      : [];

    // Map inspections targetId from name to ObjectId
    const mappedInspections = Array.isArray(inspections)
      ? inspections.map(inspection => {
          const mappedTargetId = inspection.targetType === 'scenario'
            ? scenarioMap[inspection.targetId]
            : symbolMap[inspection.targetId];
          if (!mappedTargetId) return null; // skip if target not found
          return {
            targetType: inspection.targetType,
            targetId: mappedTargetId,
            targetLabel: inspection.targetLabel || '',
            aspect: inspection.aspect || '',
            description: inspection.description || ''
          };
        }).filter(inspection => inspection !== null)
      : [];

    // Update project with mapped tasks and inspections
    project.tasks = mappedTasks;
    project.inspections = mappedInspections;
    project.symbols = insertedSymbols.map(symbol => symbol._id);
    await project.save();

    const responseProject = project.toObject();
    responseProject.symbols = insertedSymbols;
    res.status(201).json(responseProject);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:projectId/export', async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId).lean();
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado.' });
    const symbols = await SymbolModel.find({ project: project._id }).sort({ createdAt: 1 }).lean();
    const exportData = { ...project, symbols };
    // Replace targetId with targetLabel for tasks and inspections to avoid DB field issues
    exportData.tasks.forEach(task => {
      task.targetId = task.targetLabel;
    });
    exportData.inspections.forEach(inspection => {
      inspection.targetId = inspection.targetLabel;
    });
    const cleanedData = cleanDatabaseFields(exportData);
    res.json(cleanedData);
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
      about: project.about || { intro: '', items: [] },
      tasks: project.tasks || [],
      inspections: project.inspections || [],
      locks: project.locks || [],
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
    broadcastProjectUpdate(req, req.params.projectId);
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
    broadcastProjectUpdate(req, req.params.projectId);
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
    broadcastProjectUpdate(req, req.params.projectId);
    res.json({ message: 'Escenario eliminado.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch('/:projectId/about', async (req, res) => {
  try {
    const { intro, items } = req.body;
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado.' });
    project.about = {
      intro: intro?.toString().trim() || '',
      items: Array.isArray(items) ? items.map((item) => item?.toString().trim()).filter(Boolean) : []
    };
    await project.save();
    broadcastProjectUpdate(req, req.params.projectId);
    res.json(project.about);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch('/:projectId/locks', async (req, res) => {
  try {
    const { targetType, targetId, sessionId, lockedBy } = req.body;
    if (!targetType || !targetId || !sessionId) {
      return res.status(400).json({ message: 'Los datos de bloqueo son obligatorios.' });
    }
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado.' });
    const existingLock = project.locks.find((item) => item.targetType === targetType && item.targetId === targetId);
    if (existingLock && existingLock.sessionId !== sessionId) {
      return res.status(409).json({ message: 'Este elemento ya está siendo editado por otro usuario.' });
    }
    if (existingLock) {
      existingLock.lockedAt = new Date();
      existingLock.lockedBy = lockedBy?.toString().trim() || existingLock.lockedBy;
    } else {
      project.locks.push({
        targetType,
        targetId: targetId.toString(),
        sessionId,
        lockedBy: lockedBy?.toString().trim() || 'Usuario',
        lockedAt: new Date()
      });
    }
    await project.save();
    broadcastLockUpdate(req, req.params.projectId, project.locks);
    res.json(project.locks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:projectId/locks', async (req, res) => {
  try {
    const { targetType, targetId, sessionId } = req.body;
    if (!targetType || !targetId || !sessionId) {
      return res.status(400).json({ message: 'Los datos de desbloqueo son obligatorios.' });
    }
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado.' });
    project.locks = project.locks.filter((item) => !(item.targetType === targetType && item.targetId === targetId && item.sessionId === sessionId));
    await project.save();
    broadcastLockUpdate(req, req.params.projectId, project.locks);
    res.json({ message: 'Bloqueo liberado.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:projectId/tasks', async (req, res) => {
  try {
    const { priority, description, targetType, targetId, targetLabel } = req.body;
    if (!description || !description.toString().trim()) {
      return res.status(400).json({ message: 'La descripción de la tarea es obligatoria.' });
    }
    if (!targetType || !['symbol', 'scenario'].includes(targetType) || !targetId) {
      return res.status(400).json({ message: 'El elemento asociado a la tarea es obligatorio.' });
    }
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado.' });
    const nextNumber = (project.tasks?.reduce((max, item) => Math.max(max, item.number || 0), 0) || 0) + 1;
    project.tasks = project.tasks || [];
    project.tasks.push({
      number: nextNumber,
      priority: Number(priority) || 3,
      description: description.toString().trim(),
      targetType,
      targetId: targetId.toString(),
      targetLabel: targetLabel?.toString().trim() || '',
      createdAt: new Date()
    });
    await project.save();
    broadcastProjectUpdate(req, req.params.projectId);
    res.status(201).json(project.tasks.at(-1));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:projectId/tasks/:taskId', async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado.' });
    const taskIndex = project.tasks.findIndex((item) => item._id.toString() === req.params.taskId);
    if (taskIndex === -1) return res.status(404).json({ message: 'Tarea no encontrada.' });
    project.tasks.splice(taskIndex, 1);
    await project.save();
    broadcastProjectUpdate(req, req.params.projectId);
    res.json({ message: 'Tarea completada y eliminada.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:projectId/inspections', async (req, res) => {
  try {
    const { targetType, targetId, targetLabel, aspect, description } = req.body;
    if (!targetType || !['symbol', 'scenario'].includes(targetType) || !targetId) {
      return res.status(400).json({ message: 'El elemento asociado al reporte es obligatorio.' });
    }
    if (!aspect || !aspect.toString().trim() || !description || !description.toString().trim()) {
      return res.status(400).json({ message: 'Aspecto y descripción son obligatorios.' });
    }
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado.' });
    project.inspections = project.inspections || [];
    project.inspections.push({
      targetType,
      targetId: targetId.toString(),
      targetLabel: targetLabel?.toString().trim() || '',
      aspect: aspect.toString().trim(),
      description: description.toString().trim(),
      createdAt: new Date()
    });
    await project.save();
    broadcastProjectUpdate(req, req.params.projectId);
    res.status(201).json(project.inspections.at(-1));
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
    broadcastProjectUpdate(req, req.params.projectId);
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
    broadcastProjectUpdate(req, req.params.projectId);
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
    broadcastProjectUpdate(req, req.params.projectId);
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
    broadcastProjectUpdate(req, req.params.projectId);
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
