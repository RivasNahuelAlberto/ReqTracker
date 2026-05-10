import express from 'express';
import mongoose from 'mongoose';
import crypto from 'crypto';
import Project from '../models/Project.js';
import SymbolModel from '../models/Symbol.js';
import User from '../models/User.js';
import { generateEmbedding } from '../ai/embeddings.js';
import { requireAuth, authorizeRoles, authorizeProjectRoles } from '../middleware/auth.js';

const router = express.Router();

function broadcastProjectUpdate(req, projectId) {
  const io = req.app.get('io');
  if (io && projectId) {
    io.to(projectId).emit('projectUpdated');
    io.to(projectId).emit('dataChanged', {
      message: 'Los datos del proyecto han sido actualizados. Haz clic para recargar.',
      type: 'reload'
    });
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

function generateProjectCode() {
  return crypto.randomBytes(16).toString('hex');
}

function getProjectRole(user, projectId) {
  if (!user || !Array.isArray(user.projectRoles)) return null;
  return user.projectRoles.find((pr) => pr.project?.toString() === projectId?.toString()) || null;
}

async function createEmbeddingForDocument(text) {
  if (!text || !text.toString().trim()) {
    return [];
  }

  try {
    return await generateEmbedding(text.toString().trim());
  } catch (error) {
    console.warn('No se pudo generar embedding para el documento:', error.message);
    return [];
  }
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

router.get('/', requireAuth, async (req, res) => {
  try {
    const projects = await Project.find().sort({ createdAt: -1 }).lean();
    const response = projects.map((project) => {
      const projectRole = getProjectRole(req.user, project._id);
      return {
        _id: project._id,
        name: project.name,
        createdAt: project.createdAt,
        hasSecurity: Boolean(project.securityCode),
        isProjectAdmin: req.user.role === 'super_admin' || projectRole?.role === 'admin'
      };
    });
    res.json(response);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', requireAuth, authorizeRoles('usuario', 'admin', 'super_admin'), async (req, res) => {
  try {
    const { name, seedSymbols, adminUsername, adminPassword } = req.body;
    if (!name || !name.toString().trim()) {
      return res.status(400).json({ message: 'El nombre del proyecto es requerido.' });
    }
    if (!adminUsername || !adminUsername.toString().trim() || !adminPassword || !adminPassword.toString().trim()) {
      return res.status(400).json({ message: 'Username y contraseña del administrador son obligatorios.' });
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

    const existingAdmin = await User.findOne({ username: adminUsername.toString().trim() });
    if (existingAdmin) {
      return res.status(400).json({ message: 'El nombre de usuario del administrador ya existe.' });
    }

    const securityCode = generateProjectCode();
    const project = await Project.create({ name: name.toString().trim(), securityCode });
    const adminUser = new User({
      username: adminUsername.toString().trim(),
      email: `${adminUsername.toString().trim()}@project.local`,
      password: adminPassword.toString(),
      role: 'usuario',
      projectRoles: [{ project: project._id, role: 'admin' }]
    });
    await adminUser.save();

    const symbols = await createSeedSymbols(project._id, seedSymbols);
    const responseProject = project.toObject();
    delete responseProject.securityCode;
    responseProject.hasSecurity = true;
    responseProject.isProjectAdmin = true;
    res.status(201).json({ ...responseProject, symbols });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/import', requireAuth, authorizeRoles('usuario', 'admin', 'super_admin'), async (req, res) => {
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
      requirements,
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
      requirements: Array.isArray(requirements) ? requirements : [],
      resolveNotes: Array.isArray(resolveNotes) ? resolveNotes : [],
      assistantConfig: assistantConfig || {}
    });

    // Create symbols with project reference, parentSymbol null initially
    const symbolDocs = symbols.map((symbol) => ({
      name: symbol.name,
      type: symbol.type || 'General',
      isSeed: symbol.isSeed === true,
      order: symbol.order || '',
      notion: symbol.notion || '',
      impact: symbol.impact || '',
      reviewNotes: symbol.reviewNotes || '',
      status: ['incomplete', 'review', 'complete'].includes(symbol.status) ? symbol.status : 'incomplete',
      parentSymbol: null, // will set later
      project: project._id
    }));

    const insertedSymbols = await SymbolModel.insertMany(symbolDocs);

    // Create symbol name to _id map
    const symbolMap = {};
    insertedSymbols.forEach(symbol => {
      symbolMap[symbol.name] = symbol._id;
    });

    // Update parentSymbol references
    const updatePromises = [];
    insertedSymbols.forEach((insertedSymbol, index) => {
      const originalSymbol = symbols[index];
      if (originalSymbol.parentSymbol && symbolMap[originalSymbol.parentSymbol]) {
        updatePromises.push(
          SymbolModel.findByIdAndUpdate(insertedSymbol._id, {
            parentSymbol: symbolMap[originalSymbol.parentSymbol]
          })
        );
      }
    });
    await Promise.all(updatePromises);

    // Create scenario map for targetId resolution
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
    project.requirements = Array.isArray(requirements) ? requirements : [];
    project.symbols = insertedSymbols.map(symbol => symbol._id);
    await project.save();

    const responseProject = project.toObject();
    responseProject.symbols = insertedSymbols;
    res.status(201).json(responseProject);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.param('projectId', async (req, res, next, projectId) => {
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    return res.status(400).json({ message: 'ID de proyecto inválido.' });
  }

  const project = await Project.findById(projectId).lean();
  if (!project) {
    return res.status(404).json({ message: 'Proyecto no encontrado.' });
  }

  req.project = project;
  next();
});

router.use('/:projectId', requireAuth, authorizeProjectRoles('usuario', 'admin', 'super_admin'));

router.get('/:projectId/code', requireAuth, authorizeProjectRoles('admin', 'super_admin'), (req, res) => {
  res.json({ securityCode: req.project.securityCode || '' });
});

router.get('/:projectId/users', requireAuth, authorizeProjectRoles('admin', 'super_admin'), async (req, res) => {
  try {
    const users = await User.find({ 'projectRoles.project': req.project._id }).select('-password').lean();
    let projectUsers = users.map((user) => {
      const projectRole = getProjectRole(user, req.project._id);
      return {
        id: user._id,
        username: user.username,
        email: user.email,
        role: projectRole?.role || 'invitado'
      };
    });

    if (req.user.role !== 'super_admin') {
      projectUsers = projectUsers.filter((item) => item.role !== 'invitado');
    }

    res.json({ users: projectUsers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:projectId/export', requireAuth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId).lean();
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado.' });
    const symbols = await SymbolModel.find({ project: project._id }).sort({ createdAt: 1 }).lean();
    const exportData = { ...project, symbols };
    // Create symbol name map for parentSymbol resolution
    const symbolNameMap = {};
    symbols.forEach(symbol => {
      symbolNameMap[symbol._id.toString()] = symbol.name;
    });
    // Replace parentSymbol with parent name
    exportData.symbols.forEach(symbol => {
      if (symbol.parentSymbol) {
        symbol.parentSymbol = symbolNameMap[symbol.parentSymbol.toString()] || null;
      }
    });
    // Replace targetId with targetLabel for tasks and inspections
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

router.get('/:projectId', requireAuth, async (req, res) => {
  try {
    const project = req.project;
    const symbols = await SymbolModel.find({ project: project._id }).sort({ createdAt: 1 }).lean();
    const projectRole = getProjectRole(req.user, project._id);
    const responseProject = {
      _id: project._id,
      name: project.name,
      createdAt: project.createdAt,
      hasSecurity: Boolean(project.securityCode),
      isProjectAdmin: req.user.role === 'super_admin' || projectRole?.role === 'admin',
      resolveNotes: project.resolveNotes || [],
      scenarios: project.scenarios || [],
      about: project.about || { intro: '', items: [] },
      documents: project.documents || [],
      tasks: project.tasks || [],
      inspections: project.inspections || [],
      requirements: project.requirements || [],
      locks: project.locks || [],
      assistantConfig: project.assistantConfig || {}
    };
    res.json({ ...responseProject, symbols });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:projectId/documents', requireAuth, authorizeProjectRoles('usuario', 'admin', 'super_admin'), async (req, res) => {
  try {
    const { name, type, description, fileName, extension, content } = req.body;
    if (!name || !name.toString().trim()) {
      return res.status(400).json({ message: 'El nombre del documento es obligatorio.' });
    }
    if (!type || !['texto', 'archivo'].includes(type)) {
      return res.status(400).json({ message: 'El tipo de documento debe ser texto o archivo.' });
    }
    if (type === 'texto' && !description?.toString().trim()) {
      return res.status(400).json({ message: 'La descripción es obligatoria para documentos de texto.' });
    }

    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado.' });

    const contentText = content?.toString() || (type === 'texto' ? description?.toString().trim() : '');
    const documentItem = {
      id: new mongoose.Types.ObjectId().toString(),
      name: name.toString().trim(),
      type,
      description: description?.toString().trim() || '',
      fileName: fileName?.toString().trim() || '',
      extension: extension?.toString().trim() || '',
      content: contentText,
      embedding: await createEmbeddingForDocument(contentText)
    };

    project.documents = project.documents || [];
    project.documents.push(documentItem);
    await project.save();
    broadcastProjectUpdate(req, req.params.projectId);
    res.status(201).json(documentItem);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:projectId/documents/:documentId', requireAuth, authorizeProjectRoles('usuario', 'admin', 'super_admin'), async (req, res) => {
  try {
    const { name, type, description, fileName, extension, content } = req.body;
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado.' });

    const documentIndex = (project.documents || []).findIndex((item) => item.id === req.params.documentId);
    if (documentIndex === -1) return res.status(404).json({ message: 'Documento no encontrado.' });

    const documentItem = project.documents[documentIndex];
    if (name !== undefined) documentItem.name = name?.toString().trim() || documentItem.name;
    if (type !== undefined && ['texto', 'archivo'].includes(type)) documentItem.type = type;
    if (description !== undefined) documentItem.description = description?.toString().trim() || documentItem.description;
    if (fileName !== undefined) documentItem.fileName = fileName?.toString().trim() || documentItem.fileName;
    if (extension !== undefined) documentItem.extension = extension?.toString().trim() || documentItem.extension;
    if (content !== undefined) documentItem.content = content?.toString() || documentItem.content;

    if (documentItem.type === 'texto') {
      documentItem.content = documentItem.description || documentItem.content;
    }

    documentItem.embedding = await createEmbeddingForDocument(documentItem.content);

    await project.save();
    broadcastProjectUpdate(req, req.params.projectId);
    res.json(documentItem);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:projectId/documents/:documentId', requireAuth, authorizeProjectRoles('usuario', 'admin', 'super_admin'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado.' });

    const documentIndex = (project.documents || []).findIndex((item) => item.id === req.params.documentId);
    if (documentIndex === -1) return res.status(404).json({ message: 'Documento no encontrado.' });

    project.documents.splice(documentIndex, 1);
    await project.save();
    broadcastProjectUpdate(req, req.params.projectId);
    res.json({ message: 'Documento eliminado.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:projectId/scenarios', requireAuth, authorizeProjectRoles('usuario', 'admin', 'super_admin'), async (req, res) => {
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

router.put('/:projectId/scenarios/:scenarioId', requireAuth, authorizeProjectRoles('usuario', 'admin', 'super_admin'), async (req, res) => {
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

router.delete('/:projectId/scenarios/:scenarioId', requireAuth, authorizeProjectRoles('usuario', 'admin', 'super_admin'), async (req, res) => {
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

router.patch('/:projectId/about', requireAuth, authorizeProjectRoles('usuario', 'admin', 'super_admin'), async (req, res) => {
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

router.patch('/:projectId/locks', requireAuth, authorizeProjectRoles('usuario', 'admin', 'super_admin'), async (req, res) => {
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

router.delete('/:projectId/locks', requireAuth, authorizeProjectRoles('usuario', 'admin', 'super_admin'), async (req, res) => {
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

router.post('/:projectId/tasks', requireAuth, authorizeProjectRoles('usuario', 'admin', 'super_admin'), async (req, res) => {
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

router.put('/:projectId/tasks/:taskId', requireAuth, authorizeProjectRoles('usuario', 'admin', 'super_admin'), async (req, res) => {
  try {
    const { description, priority, targetType, targetId, targetLabel } = req.body;
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado.' });
    const task = project.tasks.id(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Tarea no encontrada.' });
    if (description && description.toString().trim()) task.description = description.toString().trim();
    if (priority) task.priority = Number(priority);
    if (targetType && ['symbol', 'scenario'].includes(targetType)) task.targetType = targetType;
    if (targetId) task.targetId = targetId.toString();
    if (targetLabel) task.targetLabel = targetLabel.toString().trim();
    await project.save();
    broadcastProjectUpdate(req, req.params.projectId);
    res.json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:projectId/tasks/:taskId', requireAuth, authorizeProjectRoles('usuario', 'admin', 'super_admin'), async (req, res) => {
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

router.put('/:projectId/inspections/:inspectionId', requireAuth, authorizeProjectRoles('usuario', 'admin', 'super_admin'), async (req, res) => {
  try {
    const { aspect, description } = req.body;
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado.' });
    const inspection = project.inspections.id(req.params.inspectionId);
    if (!inspection) return res.status(404).json({ message: 'Inspección no encontrada.' });
    if (aspect && aspect.toString().trim()) inspection.aspect = aspect.toString().trim();
    if (description && description.toString().trim()) inspection.description = description.toString().trim();
    await project.save();
    broadcastProjectUpdate(req, req.params.projectId);
    res.json(inspection);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:projectId/inspections/:inspectionId', requireAuth, authorizeProjectRoles('usuario', 'admin', 'super_admin'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado.' });
    const inspectionIndex = project.inspections.findIndex((item) => item._id.toString() === req.params.inspectionId);
    if (inspectionIndex === -1) return res.status(404).json({ message: 'Inspección no encontrada.' });
    project.inspections.splice(inspectionIndex, 1);
    await project.save();
    broadcastProjectUpdate(req, req.params.projectId);
    res.json({ message: 'Inspección marcada como resuelta y eliminada.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:projectId/inspections', requireAuth, authorizeProjectRoles('usuario', 'admin', 'super_admin'), async (req, res) => {
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

router.post('/:projectId/requirements', requireAuth, authorizeProjectRoles('usuario', 'admin', 'super_admin'), async (req, res) => {
  try {
    const {
      identifier,
      name,
      type,
      description,
      basis,
      priority,
      criticidad,
      costoImplementacion,
      volatilidad,
      factibilidad,
      riesgo
    } = req.body;
    if (!name || !name.toString().trim()) {
      return res.status(400).json({ message: 'El nombre del requisito es obligatorio.' });
    }
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado.' });
    project.requirements = project.requirements || [];
    project.requirements.push({
      identifier: identifier?.toString().trim() || '',
      name: name.toString().trim(),
      type: type?.toString().trim() || '',
      description: description?.toString().trim() || '',
      basis: basis?.toString().trim() || '',
      priority: ['Alta', 'Media', 'Baja'].includes(priority) ? priority : 'Media',
      criticidad: ['Alta', 'Media', 'Baja'].includes(criticidad) ? criticidad : 'Media',
      costoImplementacion: ['Alto', 'Medio', 'Bajo'].includes(costoImplementacion) ? costoImplementacion : 'Medio',
      volatilidad: ['Alta', 'Media', 'Baja'].includes(volatilidad) ? volatilidad : 'Media',
      factibilidad: ['Alta', 'Media', 'Baja'].includes(factibilidad) ? factibilidad : 'Media',
      riesgo: ['Alto', 'Medio', 'Bajo'].includes(riesgo) ? riesgo : 'Medio',
      createdAt: new Date()
    });
    await project.save();
    broadcastProjectUpdate(req, req.params.projectId);
    res.status(201).json(project.requirements.at(-1));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:projectId/requirements/:requirementId', requireAuth, authorizeProjectRoles('usuario', 'admin', 'super_admin'), async (req, res) => {
  try {
    const {
      identifier,
      name,
      type,
      description,
      basis,
      priority,
      criticidad,
      costoImplementacion,
      volatilidad,
      factibilidad,
      riesgo
    } = req.body;
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado.' });
    const requirement = project.requirements.id(req.params.requirementId);
    if (!requirement) return res.status(404).json({ message: 'Requisito no encontrado.' });
    if (identifier !== undefined) requirement.identifier = identifier?.toString().trim() || '';
    if (name !== undefined && name.toString().trim()) requirement.name = name.toString().trim();
    if (type !== undefined) requirement.type = type?.toString().trim() || '';
    if (description !== undefined) requirement.description = description?.toString().trim() || '';
    if (basis !== undefined) requirement.basis = basis?.toString().trim() || '';
    if (priority !== undefined) requirement.priority = ['Alta', 'Media', 'Baja'].includes(priority) ? priority : requirement.priority;
    if (criticidad !== undefined) requirement.criticidad = ['Alta', 'Media', 'Baja'].includes(criticidad) ? criticidad : requirement.criticidad;
    if (costoImplementacion !== undefined) requirement.costoImplementacion = ['Alto', 'Medio', 'Bajo'].includes(costoImplementacion) ? costoImplementacion : requirement.costoImplementacion;
    if (volatilidad !== undefined) requirement.volatilidad = ['Alta', 'Media', 'Baja'].includes(volatilidad) ? volatilidad : requirement.volatilidad;
    if (factibilidad !== undefined) requirement.factibilidad = ['Alta', 'Media', 'Baja'].includes(factibilidad) ? factibilidad : requirement.factibilidad;
    if (riesgo !== undefined) requirement.riesgo = ['Alto', 'Medio', 'Bajo'].includes(riesgo) ? riesgo : requirement.riesgo;
    await project.save();
    broadcastProjectUpdate(req, req.params.projectId);
    res.json(requirement);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:projectId/requirements/:requirementId', requireAuth, authorizeProjectRoles('usuario', 'admin', 'super_admin'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado.' });
    const requirementIndex = project.requirements.findIndex((item) => item._id.toString() === req.params.requirementId);
    if (requirementIndex === -1) return res.status(404).json({ message: 'Requisito no encontrado.' });
    project.requirements.splice(requirementIndex, 1);
    await project.save();
    broadcastProjectUpdate(req, req.params.projectId);
    res.json({ message: 'Requisito eliminado.' });
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

router.put('/:projectId/security', requireAuth, authorizeProjectRoles('admin', 'super_admin'), setProjectSecurityHandler);
router.patch('/:projectId/security', requireAuth, authorizeProjectRoles('admin', 'super_admin'), setProjectSecurityHandler);

router.post('/:projectId/resolve-notes', requireAuth, authorizeProjectRoles('usuario', 'admin', 'super_admin'), async (req, res) => {
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

router.put('/:projectId/resolve-notes/:noteId', requireAuth, authorizeProjectRoles('usuario', 'admin', 'super_admin'), async (req, res) => {
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

router.patch('/:projectId/resolve-notes/:noteId/resolve', requireAuth, authorizeProjectRoles('usuario', 'admin', 'super_admin'), async (req, res) => {
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

router.delete('/:projectId/resolve-notes/:noteId', requireAuth, authorizeProjectRoles('usuario', 'admin', 'super_admin'), async (req, res) => {
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

router.delete('/:projectId', requireAuth, authorizeProjectRoles('usuario', 'admin', 'super_admin'), async (req, res) => {
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

export default router;
