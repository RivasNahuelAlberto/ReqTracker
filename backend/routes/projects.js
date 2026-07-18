import express from 'express';
import mongoose from 'mongoose';
import crypto from 'crypto';
import Project from '../models/Project.js';
import SymbolModel from '../models/Symbol.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { generateRequirementEmbedding, invalidateEmbeddingCache } from '../ai/embeddings.js';
import { generateProjectRelations, suggestRelationsForEntity } from '../ai/graph-generation.service.js';
import { getAnalyticsAutoUpdater } from '../ai/analytics-auto-updater.service.js';
import Relation from '../models/Relation.js';
import { requireAuth, authorizeRoles, authorizeProjectRoles } from '../middleware/auth.js';
import { emitGlobalDataChanged, emitProjectDataChanged, emitProjectNotification } from '../socket.js';
import Requirement from '../models/Requirement.js';
import Scenario from '../models/Scenario.js';
import Task from '../models/Task.js';
import Inspection from '../models/Inspection.js';
import DocumentModel from '../models/Document.js';
import { createProjectRequirementsService } from '../services/projectRequirements.service.js';
import { createProjectScenariosService } from '../services/projectScenarios.service.js';
import { createProjectTasksService } from '../services/projectTasks.service.js';
import { createProjectInspectionsService } from '../services/projectInspections.service.js';
import { createResolveNotesService } from '../services/resolveNotes.service.js';
import { buildProjectViewResponse } from '../services/projectView.service.js';
import { buildProjectExportPayload } from '../services/projectImportExport.service.js';
import { createProjectDocumentsService } from '../services/projectDocuments.service.js';
import { normalizeLockPayload } from '../utils/lockPayload.js';

const router = express.Router();
const requirementsService = createProjectRequirementsService({
  ProjectModel: Project,
  RequirementModel: Requirement
});
const scenariosService = createProjectScenariosService({
  ProjectModel: Project,
  ScenarioModel: Scenario
});
const tasksService = createProjectTasksService({
  ProjectModel: Project,
  TaskModel: Task
});
const inspectionsService = createProjectInspectionsService({
  ProjectModel: Project,
  InspectionModel: Inspection
});
const resolveNotesService = createResolveNotesService({
  ProjectModel: Project,
  ResolveNoteModel: (await import('../models/ResolveNote.js')).default
});
const documentsService = createProjectDocumentsService({
  ProjectModel: Project,
  DocumentModel
});

function broadcastProjectUpdate(req, projectId) {
  emitProjectDataChanged(projectId, 'Los datos del proyecto han sido actualizados. Haz clic para recargar.');
}

function broadcastLockUpdate(req, projectId, locks) {
  const io = req.app.get('io');
  if (io && projectId) {
    io.to(projectId).emit('lockChanged', locks || []);
  }
}

async function createProjectNotification({ projectId, actorId, actorUsername, action, targetType, targetId, targetLabel, message }) {
  if (!projectId || !actorId || !action || !targetType || !targetId || !message) {
    return null;
  }

  const notification = await Notification.create({
    project: projectId,
    actor: {
      _id: actorId,
      username: actorUsername || 'Usuario'
    },
    action,
    targetType,
    targetId,
    targetLabel: targetLabel || '',
    message,
    seenBy: [actorId]
  });

  emitProjectNotification(projectId, {
    id: notification._id.toString(),
    projectId: notification.project.toString(),
    actor: {
      _id: notification.actor._id.toString(),
      username: notification.actor.username
    },
    action: notification.action,
    targetType: notification.targetType,
    targetId: notification.targetId.toString(),
    targetLabel: notification.targetLabel,
    message: notification.message,
    createdAt: notification.createdAt,
    excludeUserId: actorId.toString()
  });

  return notification;
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

function normalizeProjectId(projectRef) {
  if (!projectRef) return null;
  if (typeof projectRef === 'string') return projectRef;
  if (projectRef._id) return projectRef._id.toString();
  if (projectRef.toString) return projectRef.toString();
  return null;
}

function getProjectRole(user, projectId) {
  if (!user || !Array.isArray(user.projectRoles)) return null;
  const projectIdStr = projectId?.toString?.();
  return user.projectRoles.find((pr) => normalizeProjectId(pr.project) === projectIdStr) || null;
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

  return created;
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const projects = await Project.find().sort({ createdAt: -1 }).lean();
    const visibleProjects = req.user.role === 'super_admin'
      ? projects
      : projects.filter((project) => Boolean(getProjectRole(req.user, project._id)));

    const response = visibleProjects.map((project) => {
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
    
    // Generate unique project hash for invitations
    const projectHash = `PRJ-${project._id.toString().slice(-8).toUpperCase()}`;
    project.projectHash = projectHash;
    await project.save();
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
    responseProject.projectHash = projectHash; // Include hash for admin
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
      symbols,
      relations
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

    // Create project first without embedded legacy entity arrays
    const project = await Project.create({
      name: name.toString().trim(),
      securityCode: securityCode.toString().trim(),
      about: {
        intro: about?.intro || '',
        items: Array.isArray(about?.items) ? about.items : []
      },
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
      project: project._id,
      embedding: Array.isArray(symbol.embedding) ? symbol.embedding : []
    }));

    const insertedSymbols = await SymbolModel.insertMany(symbolDocs);

    // Create symbol name to _id map
    const symbolMap = {};
    insertedSymbols.forEach(symbol => {
      symbolMap[symbol.name] = symbol._id;
    });

    // Create dedicated requirements and map them by import identifier/name
    const requirementMap = {};
    const createdRequirements = [];
    for (const req of Array.isArray(requirements) ? requirements : []) {
      const createdRequirement = await requirementsService.createRequirement(project._id, {
        identifier: req.identifier,
        name: req.name,
        type: req.type,
        description: req.description,
        basis: req.basis,
        priority: req.priority,
        criticidad: req.criticidad,
        costoImplementacion: req.costoImplementacion,
        volatilidad: req.volatilidad,
        factibilidad: req.factibilidad,
        riesgo: req.riesgo
      });
      requirementMap[req.identifier || req.name] = createdRequirement.id;
      createdRequirements.push(createdRequirement);
    }

    // Create dedicated scenarios and map them by title
    const scenarioMap = {};
    const createdScenarios = [];
    for (const scenario of Array.isArray(scenarios) ? scenarios : []) {
      const createdScenario = await scenariosService.createScenario(project._id, {
        type: scenario.type,
        title: scenario.title,
        objective: scenario.objective,
        locationTemporal: scenario.locationTemporal,
        locationGeographic: scenario.locationGeographic,
        preconditions: scenario.preconditions,
        actors: scenario.actors,
        resources: scenario.resources,
        episodes: scenario.episodes,
        exceptions: scenario.exceptions,
        order: scenario.order
      });
      scenarioMap[scenario.title] = createdScenario.id;
      createdScenarios.push(createdScenario);
    }

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

    // Create dedicated tasks and inspections using the newly created IDs
    const createdTasks = [];
    for (const task of Array.isArray(tasks) ? tasks : []) {
      const mappedTargetId = task.targetType === 'scenario'
        ? scenarioMap[task.targetId]
        : symbolMap[task.targetId];
      if (!mappedTargetId) continue;
      const createdTask = await tasksService.createTask(project._id, {
        priority: task.priority || 3,
        description: task.description || '',
        targetType: task.targetType,
        targetId: mappedTargetId,
        targetLabel: task.targetLabel || ''
      });
      createdTasks.push(createdTask);
    }

    const createdInspections = [];
    for (const inspection of Array.isArray(inspections) ? inspections : []) {
      const mappedTargetId = inspection.targetType === 'scenario'
        ? scenarioMap[inspection.targetId]
        : symbolMap[inspection.targetId];
      if (!mappedTargetId) continue;
      const createdInspection = await inspectionsService.createInspection(project._id, {
        targetType: inspection.targetType,
        targetId: mappedTargetId,
        targetLabel: inspection.targetLabel || '',
        aspect: inspection.aspect || '',
        description: inspection.description || ''
      });
      createdInspections.push(createdInspection);
    }

    const createdResolveNotes = [];
    for (const note of Array.isArray(resolveNotes) ? resolveNotes : []) {
      const text = note.text || note.name || note.description || '';
      if (!text) continue;
      const createdNote = await resolveNotesService.createResolveNote(project._id, { text });
      createdResolveNotes.push(createdNote);
    }

    for (const document of Array.isArray(documents) ? documents : []) {
      await documentsService.createDocument(project._id, {
        name: document.name,
        type: document.type,
        description: document.description,
        fileName: document.fileName,
        extension: document.extension,
        content: document.content,
        embedding: Array.isArray(document.embedding) ? document.embedding : []
      });
    }

    // Map and create relations
    const mappedRelations = [];
    if (Array.isArray(relations)) {
      for (const rel of relations) {
        try {
          // Map from entity
          let fromId = null;
          if (rel.fromType === 'symbol') {
            fromId = symbolMap[rel.fromId];
          } else if (rel.fromType === 'requirement') {
            fromId = requirementMap[rel.fromId];
          }

          // Map to entity
          let toId = null;
          if (rel.toType === 'symbol') {
            toId = symbolMap[rel.toId];
          } else if (rel.toType === 'requirement') {
            toId = requirementMap[rel.toId];
          }

          // Only create relation if both entities exist
          if (fromId && toId) {
            mappedRelations.push({
              fromType: rel.fromType,
              fromId: fromId,
              toType: rel.toType,
              toId: toId,
              type: rel.type || 'related_to',
              projectId: project._id,
              strength: rel.strength || 5
            });
          }
        } catch (err) {
          console.warn('Error mapping relation:', err.message);
          // Continue with next relation
        }
      }

      // Create all relations
      if (mappedRelations.length > 0) {
        await Relation.insertMany(mappedRelations);
      }
    }

    // Keep the project document light and attach the imported collections in the response
    const responseProject = project.toObject();
    responseProject.relationsImported = mappedRelations.length;
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

// router.use('/:projectId', requireAuth, authorizeProjectRoles('invitado', 'usuario', 'admin', 'super_admin'));

router.get('/:projectId/code', requireAuth, authorizeProjectRoles('admin', 'super_admin'), (req, res) => {
  res.json({
    securityCode: req.project.securityCode || '',
    projectHash: req.project.projectHash || ''
  });
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

    res.json({ users: projectUsers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:projectId/export', requireAuth, authorizeProjectRoles('invitado', 'usuario', 'admin', 'super_admin'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId).lean();
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado.' });

    const [symbols, requirements, scenarios, tasks, inspections, resolveNotes, relations, documents] = await Promise.all([
      SymbolModel.find({ project: project._id }).sort({ createdAt: 1 }).lean(),
      requirementsService.getProjectRequirements(project._id),
      scenariosService.getProjectScenarios(project._id),
      tasksService.getProjectTasks(project._id),
      inspectionsService.getProjectInspections(project._id),
      resolveNotesService.listResolveNotes(project._id),
      Relation.find({ projectId: project._id }).lean(),
      documentsService.getProjectDocuments(project._id)
    ]);

    const exportData = buildProjectExportPayload({
      project,
      symbols,
      requirements,
      scenarios,
      tasks,
      inspections,
      resolveNotes,
      relations,
      documents
    });

    const cleanedData = cleanDatabaseFields(exportData);
    res.json(cleanedData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:projectId', requireAuth, authorizeProjectRoles('invitado', 'usuario', 'admin', 'super_admin'), async (req, res) => {
  try {
    const project = req.project;
    const symbols = await SymbolModel.find({ project: project._id }).sort({ createdAt: 1 }).lean();
    const requirements = await requirementsService.getProjectRequirements(project._id);
    const scenarios = await scenariosService.getProjectScenarios(project._id);
    const tasks = await tasksService.getProjectTasks(project._id);
    const inspections = await inspectionsService.getProjectInspections(project._id);
    const projectRole = getProjectRole(req.user, project._id);
    const resolveNotes = await resolveNotesService.listResolveNotes(project._id);
    const documents = await documentsService.getProjectDocuments(project._id);
    const responseProject = await buildProjectViewResponse({
      project,
      user: req.user,
      projectRole,
      symbols,
      requirements,
      scenarios,
      tasks,
      inspections,
      resolveNotes,
      documents
    });

    res.json(responseProject);
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
    const documentItem = await documentsService.createDocument(req.params.projectId, {
      name: name.toString().trim(),
      type,
      description: description?.toString().trim() || '',
      fileName: fileName?.toString().trim() || '',
      extension: extension?.toString().trim() || '',
      content: contentText,
      embedding: await createEmbeddingForDocument(contentText)
    });

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

    const documentItem = await documentsService.updateDocument(req.params.projectId, req.params.documentId, {
      name,
      type,
      description,
      fileName,
      extension,
      content,
      embedding: await createEmbeddingForDocument(content?.toString() || '')
    });

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

    const deleted = await documentsService.deleteDocument(req.params.projectId, req.params.documentId);
    if (!deleted.deleted) return res.status(404).json({ message: 'Documento no encontrado.' });

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
    const createdScenario = await scenariosService.createScenario(req.params.projectId, {
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
    });
    broadcastProjectUpdate(req, req.params.projectId);
    res.status(201).json(createdScenario);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:projectId/scenarios/:scenarioId', requireAuth, authorizeProjectRoles('usuario', 'admin', 'super_admin'), async (req, res) => {
  try {
    const updatedScenario = await scenariosService.updateScenario(req.params.projectId, req.params.scenarioId, req.body);
    broadcastProjectUpdate(req, req.params.projectId);
    res.json(updatedScenario);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:projectId/scenarios/:scenarioId', requireAuth, authorizeProjectRoles('usuario', 'admin', 'super_admin'), async (req, res) => {
  try {
    const deleted = await scenariosService.deleteScenario(req.params.projectId, req.params.scenarioId);
    if (!deleted.deleted) {
      return res.status(404).json({ message: 'Escenario no encontrado.' });
    }
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
    const normalized = normalizeLockPayload(req.body);
    const { targetType, targetId, sessionId, lockedBy } = normalized;
    if (!normalized.isValid) {
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
    const normalized = normalizeLockPayload(req.body);
    const { targetType, targetId, sessionId } = normalized;
    if (!normalized.isValid) {
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

router.post('/:projectId/tasks', requireAuth, authorizeProjectRoles('admin', 'super_admin'), async (req, res) => {
  try {
    const { priority, description, targetType, targetId, targetLabel } = req.body;
    if (!description || !description.toString().trim()) {
      return res.status(400).json({ message: 'La descripción de la tarea es obligatoria.' });
    }
    if (!targetType || !['symbol', 'scenario'].includes(targetType) || !targetId) {
      return res.status(400).json({ message: 'El elemento asociado a la tarea es obligatorio.' });
    }
    const createdTask = await tasksService.createTask(req.params.projectId, {
      priority,
      description,
      targetType,
      targetId,
      targetLabel
    });
    await createProjectNotification({
      projectId: req.params.projectId,
      actorId: req.user._id,
      actorUsername: req.user.username,
      action: 'task_created',
      targetType: 'task',
      targetId: createdTask._id,
      targetLabel: createdTask.targetLabel || createdTask.description,
      message: `${req.user.username} creó la tarea pendiente "${createdTask.description}".`
    });
    broadcastProjectUpdate(req, req.params.projectId);
    res.status(201).json(createdTask);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:projectId/tasks/:taskId', requireAuth, authorizeProjectRoles('admin', 'super_admin'), async (req, res) => {
  try {
    const { description, priority, targetType, targetId, targetLabel } = req.body;
    const task = await tasksService.updateTask(req.params.projectId, req.params.taskId, {
      description,
      priority,
      targetType,
      targetId,
      targetLabel
    });
    await createProjectNotification({
      projectId: req.params.projectId,
      actorId: req.user._id,
      actorUsername: req.user.username,
      action: 'task_updated',
      targetType: 'task',
      targetId: task._id,
      targetLabel: task.targetLabel || task.description,
      message: `${req.user.username} actualizó la tarea pendiente "${task.description}".`
    });
    broadcastProjectUpdate(req, req.params.projectId);
    res.json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:projectId/tasks/:taskId', requireAuth, authorizeProjectRoles('usuario', 'admin', 'super_admin'), async (req, res) => {
  try {
    const task = await tasksService.getTask(req.params.projectId, req.params.taskId);
    const deleted = await tasksService.deleteTask(req.params.projectId, req.params.taskId);
    if (!deleted.deleted) {
      return res.status(404).json({ message: 'Tarea no encontrada.' });
    }
    await createProjectNotification({
      projectId: req.params.projectId,
      actorId: req.user._id,
      actorUsername: req.user.username,
      action: 'task_completed',
      targetType: 'task',
      targetId: task.id,
      targetLabel: task.targetLabel || task.description,
      message: `${req.user.username} completó la tarea pendiente "${task.description}".`
    });
    broadcastProjectUpdate(req, req.params.projectId);
    res.json({ message: 'Tarea completada y eliminada.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:projectId/inspections/:inspectionId', requireAuth, authorizeProjectRoles('usuario', 'admin', 'super_admin'), async (req, res) => {
  try {
    const { targetType, targetId, targetLabel, aspect, description } = req.body;
    const inspection = await inspectionsService.updateInspection(req.params.projectId, req.params.inspectionId, {
      targetType,
      targetId,
      targetLabel,
      aspect,
      description
    });
    await createProjectNotification({
      projectId: req.params.projectId,
      actorId: req.user._id,
      actorUsername: req.user.username,
      action: 'inspection_updated',
      targetType: 'inspection',
      targetId: inspection.id,
      targetLabel: inspection.targetLabel || inspection.description,
      message: `${req.user.username} actualizó una inspección para "${inspection.targetLabel || inspection.targetType}".`
    });
    broadcastProjectUpdate(req, req.params.projectId);
    res.json(inspection);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:projectId/inspections/:inspectionId', requireAuth, authorizeProjectRoles('usuario', 'admin', 'super_admin'), async (req, res) => {
  try {
    const inspection = await inspectionsService.getInspection(req.params.projectId, req.params.inspectionId);
    const deleted = await inspectionsService.deleteInspection(req.params.projectId, req.params.inspectionId);
    if (!deleted.deleted) {
      return res.status(404).json({ message: 'Inspección no encontrada.' });
    }
    await createProjectNotification({
      projectId: req.params.projectId,
      actorId: req.user._id,
      actorUsername: req.user.username,
      action: 'inspection_resolved',
      targetType: 'inspection',
      targetId: inspection.id,
      targetLabel: inspection.targetLabel || inspection.description,
      message: `${req.user.username} resolvió una inspección para "${inspection.targetLabel || inspection.targetType}".`
    });
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
    const createdInspection = await inspectionsService.createInspection(req.params.projectId, {
      targetType,
      targetId,
      targetLabel,
      aspect,
      description
    });
    await createProjectNotification({
      projectId: req.params.projectId,
      actorId: req.user._id,
      actorUsername: req.user.username,
      action: 'inspection_created',
      targetType: 'inspection',
      targetId: createdInspection.id,
      targetLabel: createdInspection.targetLabel || createdInspection.description,
      message: `${req.user.username} creó una inspección para "${createdInspection.targetLabel || createdInspection.targetType}".`
    });
    broadcastProjectUpdate(req, req.params.projectId);
    res.status(201).json(createdInspection);
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
    const createdRequirement = await requirementsService.createRequirement(req.params.projectId, {
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
    });
    try {
      const embedding = await generateRequirementEmbedding({
        name: createdRequirement.name,
        description: createdRequirement.description,
        basis: createdRequirement.basis
      });
      if (embedding && embedding.length > 0) {
        await Requirement.findByIdAndUpdate(createdRequirement.id, { embedding });
      }
    } catch (embeddingError) {
      console.warn('No se pudo generar embedding para el requisito:', embeddingError.message);
    }
    broadcastProjectUpdate(req, req.params.projectId);
    
    // ETAPA 8: Auto-update analytics (non-blocking)
    const autoUpdater = getAnalyticsAutoUpdater();
    autoUpdater.processRequirementChange(req.params.projectId, null, createdRequirement).catch(err => {
      console.warn('Auto-update failed for new requirement:', err.message);
    });
    
    res.status(201).json(createdRequirement);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:projectId/requirements/:requirementId', requireAuth, authorizeProjectRoles('usuario', 'admin', 'super_admin'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado.' });
    const existingRequirement = await Requirement.findOne({ _id: req.params.requirementId, project: req.params.projectId });
    if (!existingRequirement) return res.status(404).json({ message: 'Requisito no encontrado.' });
    
    // ETAPA 8: Capturar estado antiguo ANTES de actualizar
    const oldRequirement = existingRequirement.toObject();
    
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
    
    // Almacenar valores antiguos para invalidar cache si se cambian campos con embedding
    const oldName = existingRequirement.name;
    const oldDescription = existingRequirement.description;
    const oldBasis = existingRequirement.basis;
    
    const updatedRequirement = await requirementsService.updateRequirement(req.params.projectId, req.params.requirementId, req.body);

    const updatedFields = ['name', 'description', 'basis'];
    const shouldRegenerateEmbedding = updatedFields.some(field => Object.prototype.hasOwnProperty.call(req.body, field));
    
    // Invalidar cache del embedding antiguo antes de regenerar
    if (shouldRegenerateEmbedding) {
      const oldText = [oldName, oldDescription, oldBasis]
        .filter(text => text && text.toString().trim())
        .join(' ');
      
      if (oldText) {
        await invalidateEmbeddingCache(oldText).catch(err => {
          console.warn('Failed to invalidate old embedding cache:', err.message);
        });
      }
    }
    
    if (shouldRegenerateEmbedding) {
      try {
        const embedding = await generateRequirementEmbedding({
          name: updatedRequirement.name,
          description: updatedRequirement.description,
          basis: updatedRequirement.basis
        });
        if (embedding && embedding.length > 0) {
          await Requirement.findByIdAndUpdate(req.params.requirementId, { embedding });
        }
      } catch (embeddingError) {
        console.warn('No se pudo regenerar embedding para el requisito:', embeddingError.message);
      }
    }

    
    // ETAPA 8: Auto-update analytics for changed fields (non-blocking)
    const autoUpdater = getAnalyticsAutoUpdater();
    autoUpdater.processRequirementChange(req.params.projectId, oldRequirement, req.body).catch(err => {
      console.warn('Auto-update failed for requirement update:', err.message);
    });
    
    broadcastProjectUpdate(req, req.params.projectId);
    res.json(updatedRequirement);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:projectId/requirements/:requirementId', requireAuth, authorizeProjectRoles('usuario', 'admin', 'super_admin'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado.' });
    const existingRequirement = await Requirement.findOne({ _id: req.params.requirementId, project: req.params.projectId });
    if (!existingRequirement) return res.status(404).json({ message: 'Requisito no encontrado.' });
    
    // Obtener el requisito antes de eliminarlo para invalidar su cache de embedding
    const deletedText = [existingRequirement.name, existingRequirement.description, existingRequirement.basis]
      .filter(text => text && text.toString().trim())
      .join(' ');
    
    // Invalidar cache del embedding eliminado
    if (deletedText) {
      await invalidateEmbeddingCache(deletedText).catch(err => {
        console.warn('Failed to invalidate deleted requirement embedding cache:', err.message);
      });
    }
    
    const deleted = await requirementsService.deleteRequirement(req.params.projectId, req.params.requirementId);
    if (!deleted.deleted) {
      return res.status(404).json({ message: 'Requisito no encontrado.' });
    }
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
    const createdNote = await resolveNotesService.createResolveNote(req.params.projectId, { text });
    await createProjectNotification({
      projectId: req.params.projectId,
      actorId: req.user._id,
      actorUsername: req.user.username,
      action: 'resolve_note_created',
      targetType: 'resolve_note',
      targetId: createdNote._id,
      targetLabel: createdNote.text,
      message: `${req.user.username} creó una nota "A Resolver".`
    });
    broadcastProjectUpdate(req, req.params.projectId);
    res.status(201).json(createdNote);
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
    const note = await resolveNotesService.updateResolveNote(req.params.projectId, req.params.noteId, { text });
    await createProjectNotification({
      projectId: req.params.projectId,
      actorId: req.user._id,
      actorUsername: req.user.username,
      action: 'resolve_note_updated',
      targetType: 'resolve_note',
      targetId: note._id,
      targetLabel: note.text.substring(0, 50) + (note.text.length > 50 ? '...' : ''),
      message: `${req.user.username} actualizó una nota a resolver.`
    });
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
    const existingNote = await resolveNotesService.getResolveNote(req.params.projectId, req.params.noteId).catch(() => null);
    if (!existingNote) return res.status(404).json({ message: 'Nota no encontrada.' });
    const removedNote = existingNote;
    const deleted = await resolveNotesService.deleteResolveNote(req.params.projectId, req.params.noteId);
    if (!deleted.deleted) return res.status(404).json({ message: 'Nota no encontrada.' });
    await createProjectNotification({
      projectId: req.params.projectId,
      actorId: req.user._id,
      actorUsername: req.user.username,
      action: 'resolve_note_resolved',
      targetType: 'resolve_note',
      targetId: removedNote._id,
      targetLabel: removedNote.text,
      message: `${req.user.username} resolvió una nota "A Resolver".`
    });
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
    const existingNote = await resolveNotesService.getResolveNote(req.params.projectId, req.params.noteId).catch(() => null);
    if (!existingNote) return res.status(404).json({ message: 'Nota no encontrada.' });
    const deleted = await resolveNotesService.deleteResolveNote(req.params.projectId, req.params.noteId);
    if (!deleted.deleted) return res.status(404).json({ message: 'Nota no encontrada.' });
    broadcastProjectUpdate(req, req.params.projectId);
    res.json({ message: 'Nota eliminada.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:projectId/notifications/count', requireAuth, authorizeProjectRoles('invitado', 'usuario', 'admin', 'super_admin'), async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.user._id.toString();
    const count = await Notification.countDocuments({ project: projectId, seenBy: { $ne: userId } });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:projectId/notifications', requireAuth, authorizeProjectRoles('invitado', 'usuario', 'admin', 'super_admin'), async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.user._id.toString();
    const notifications = await Notification.find({ project: projectId, seenBy: { $ne: userId } })
      .sort({ createdAt: -1 })
      .lean();

    if (notifications.length > 0) {
      await Notification.updateMany(
        { project: projectId, seenBy: { $ne: userId } },
        { $push: { seenBy: userId } }
      );
    }

    res.json({ notifications: notifications.map((notification) => ({
      id: notification._id.toString(),
      action: notification.action,
      targetType: notification.targetType,
      targetId: notification.targetId.toString(),
      targetLabel: notification.targetLabel,
      message: notification.message,
      createdAt: notification.createdAt,
      actor: notification.actor
    })) });
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

router.post('/:projectId/generate-graph', requireAuth, authorizeProjectRoles('admin', 'super_admin'), async (req, res) => {
  try {
    const { threshold = 0.65 } = req.body;
    
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ message: 'Proyecto no encontrado.' });
    }

    const result = await generateProjectRelations({ 
      projectId: req.params.projectId, 
      threshold: Math.min(1, Math.max(0, threshold))
    });

    await createProjectNotification({
      projectId: req.params.projectId,
      actorId: req.user._id,
      actorUsername: req.user.username,
      action: 'graph_generated',
      targetType: 'graph',
      targetId: req.params.projectId,
      targetLabel: `Grafo generado (${result.createdRelations} relaciones)`,
      message: `${req.user.username} generó automáticamente ${result.createdRelations} relaciones en el grafo del proyecto.`
    });

    broadcastProjectUpdate(req, req.params.projectId);

    res.json({
      success: true,
      projectId: req.params.projectId,
      potentialRelations: result.potentialRelations,
      createdRelations: result.createdRelations,
      relations: result.relations
    });
  } catch (error) {
    console.error('Error generating project graph:', error);
    res.status(500).json({ message: error.message });
  }
});

router.post('/:projectId/regenerate-embeddings', requireAuth, authorizeProjectRoles('admin', 'super_admin'), async (req, res) => {
  try {
    const { force = false } = req.body;
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ message: 'Proyecto no encontrado.' });
    }

    const symbols = await SymbolModel.find({ project: req.params.projectId }).lean();
    let regeneratedSymbols = 0;
    for (const symbol of symbols) {
      const needsEmbedding = force || !Array.isArray(symbol.embedding) || symbol.embedding.length === 0;
      if (!needsEmbedding) continue;
      const textToEmbed = `${symbol.name} ${symbol.type} ${symbol.notion || ''} ${symbol.impact || ''}`.trim();
      try {
        const embedding = await generateEmbedding(textToEmbed);
        await SymbolModel.findByIdAndUpdate(symbol._id, { embedding });
        regeneratedSymbols += 1;
      } catch (error) {
        console.warn(`No se pudo regenerar embedding para símbolo ${symbol._id}:`, error.message);
      }
    }

    const requirements = await Requirement.find({ project: req.params.projectId }).lean();
    let regeneratedRequirements = 0;
    for (const requirement of requirements) {
      const needsEmbedding = force || !Array.isArray(requirement.embedding) || requirement.embedding.length === 0;
      if (!needsEmbedding) continue;
      const textToEmbed = `${requirement.name} ${requirement.description || ''} ${requirement.basis || ''}`.trim();
      try {
        await Requirement.findByIdAndUpdate(requirement._id, { embedding: await generateEmbedding(textToEmbed) });
        regeneratedRequirements += 1;
      } catch (error) {
        console.warn(`No se pudo regenerar embedding para requisito ${requirement._id}:`, error.message);
      }
    }

    await createProjectNotification({
      projectId: req.params.projectId,
      actorId: req.user._id,
      actorUsername: req.user.username,
      action: 'embeddings_regenerated',
      targetType: 'project',
      targetId: req.params.projectId,
      targetLabel: `Embeddings regenerados`,
      message: `${req.user.username} regeneró ${regeneratedSymbols} embeddings de símbolos y ${regeneratedRequirements} embeddings de requisitos.`
    });

    broadcastProjectUpdate(req, req.params.projectId);

    res.json({
      success: true,
      projectId: req.params.projectId,
      regeneratedSymbols,
      regeneratedRequirements,
      totalSymbols: symbols.length,
      totalRequirements: requirements.length,
      force: Boolean(force)
    });
  } catch (error) {
    console.error('Error regenerating embeddings:', error);
    res.status(500).json({ message: error.message });
  }
});

router.post('/:projectId/suggest-relations', requireAuth, authorizeProjectRoles('usuario', 'admin', 'super_admin'), async (req, res) => {
  try {
    const { entityId, entityType, threshold = 0.65 } = req.body;

    if (!entityId || !entityType) {
      return res.status(400).json({ message: 'entityId y entityType son requeridos.' });
    }

    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ message: 'Proyecto no encontrado.' });
    }

    const result = await suggestRelationsForEntity({
      projectId: req.params.projectId,
      entityId,
      entityType,
      threshold: Math.min(1, Math.max(0, threshold))
    });

    res.json({
      success: true,
      entityId: result.entityId,
      entityType: result.entityType,
      suggestedRelations: result.suggestions
    });
  } catch (error) {
    console.error('Error suggesting entity relations:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
