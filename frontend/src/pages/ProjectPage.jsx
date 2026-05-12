import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../components/AuthContext.jsx';
import { io } from 'socket.io-client';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.entry', import.meta.url).toString();
import {
  fetchProject,
  fetchSymbols,
  createSymbol,
  updateSymbol,
  deleteSymbol,
  createResolveNote,
  updateResolveNote,
  resolveNote,
  deleteResolveNote,
  createScenario,
  updateScenario,
  deleteScenario,
  createTask,
  updateTask,
  deleteTask,
  createInspection,
  updateInspection,
  deleteInspection,
  createRequirement,
  updateRequirement,
  deleteRequirement,
  createDocument,
  updateDocument,
  deleteDocument,
  updateAbout,
  fetchProjectExport,
  fetchProjectUsers,
  fetchProjectNotificationsCount,
  fetchProjectNotifications,
  lockItem,
  unlockItem,
  generateProjectGraph,
  regenerateProjectEmbeddings
} from '../api.js';
import RelationMap from '../components/RelationMap.jsx';
import AIChat from '../components/AIChat.jsx';
import AICopilotPanel from '../components/AICopilotPanel.jsx';
import HealthMonitorPanel from '../components/HealthMonitorPanel.jsx';
import AutonomousAgentPanel from '../components/AutonomousAgentPanel.jsx';
import ProjectUserManagement from '../components/ProjectUserManagement.jsx';

const typeOptions = ['Sujeto', 'Objeto', 'Verbo', 'Estado'];
const statusOptions = [
  { value: 'incomplete', label: 'Incompleto', variant: 'danger' },
  { value: 'review', label: 'Revisión', variant: 'warning' },
  { value: 'complete', label: 'Completo', variant: 'success' }
];

const scenarioTypeOptions = ['Escenario', 'Subescenario', 'Episodio'];
const scenarioFilterOptions = ['Todos', ...scenarioTypeOptions];

function ProjectPage() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [projectUsers, setProjectUsers] = useState([]);
  const currentProjectRole = useMemo(() => {
    return user?.projectRoles?.find((pr) => pr.project?.toString() === projectId)?.role || null;
  }, [user, projectId]);
  const canViewProjectUsers = useMemo(() => {
    return user?.role === 'super_admin' || currentProjectRole === 'admin';
  }, [user?.role, currentProjectRole]);
  const canEditAsUser = useMemo(() => {
    return user?.role === 'super_admin' || ['usuario', 'admin'].includes(currentProjectRole);
  }, [user?.role, currentProjectRole]);
  const canEditAsAdmin = useMemo(() => {
    return user?.role === 'super_admin' || currentProjectRole === 'admin';
  }, [user?.role, currentProjectRole]);
  const canUseAssistant = canEditAsUser; // Invitados no pueden ordenar acciones de edición/creación al agente
  const canManageTasks = useMemo(() => {
    return user?.role === 'super_admin' || currentProjectRole === 'admin';
  }, [user?.role, currentProjectRole]);

  const [manualCopilotContext, setManualCopilotContext] = useState('');
  const [projectUsersLoading, setProjectUsersLoading] = useState(false);
  const [graphActionLoading, setGraphActionLoading] = useState(false);
  const [graphActionMessage, setGraphActionMessage] = useState('');
  const [embeddingStats, setEmbeddingStats] = useState({ missingSymbols: 0, missingRequirements: 0, totalSymbols: 0, totalRequirements: 0 });
  const [symbols, setSymbols] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [activeTab, setActiveTab] = useState('symbols');
  const location = useLocation();
  const navigate = useNavigate();
  const [resolveNotes, setResolveNotes] = useState([]);
  const [newResolveText, setNewResolveText] = useState('');
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [scenarioTab, setScenarioTab] = useState('Todos');
  const [scenarioSearch, setScenarioSearch] = useState('');
  const [scenarioEditMode, setScenarioEditMode] = useState(false);
  const [newScenario, setNewScenario] = useState({
    type: 'Escenario',
    title: '',
    objective: '',
    locationTemporal: '',
    locationGeographic: '',
    preconditions: '',
    actors: '',
    resources: '',
    episodes: '',
    exceptions: '',
    order: ''
  });
  const [symbolEditMode, setSymbolEditMode] = useState(false);
  const [aboutEditMode, setAboutEditMode] = useState(false);
  const [aboutIntro, setAboutIntro] = useState('');
  const [aboutItems, setAboutItems] = useState(['']);
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState(3);
  const [notificationCount, setNotificationCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [taskTargetType, setTaskTargetType] = useState('symbol');
  const [taskTargetId, setTaskTargetId] = useState('');
  const [inspections, setInspections] = useState([]);
  const [inspectionAspect, setInspectionAspect] = useState('');
  const [inspectionDescription, setInspectionDescription] = useState('');
  const [inspectionTargetType, setInspectionTargetType] = useState('symbol');
  const [inspectionTargetId, setInspectionTargetId] = useState('');
  const [requirements, setRequirements] = useState([]);
  const [selectedRequirement, setSelectedRequirement] = useState(null);
  const copilotContextText = useMemo(() => {
    if (selectedRequirement) {
      return `${selectedRequirement.name || ''}\n${selectedRequirement.description || ''}`.trim();
    }
    if (selectedSymbol) {
      return `${selectedSymbol.name || ''}\n${selectedSymbol.notion || ''}\n${selectedSymbol.impact || ''}`.trim();
    }
    return manualCopilotContext;
  }, [selectedRequirement, selectedSymbol, manualCopilotContext]);
  const copilotActiveEntityId = selectedRequirement?._id || selectedSymbol?._id || projectId;
  const [requirementEditMode, setRequirementEditMode] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState(null);
  const [newRequirement, setNewRequirement] = useState({
    identifier: '',
    name: '',
    type: '',
    description: '',
    basis: '',
    priority: 'Media',
    criticidad: 'Media',
    costoImplementacion: 'Medio',
    volatilidad: 'Media',
    factibilidad: 'Media',
    riesgo: 'Medio'
  });
  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [documentEditMode, setDocumentEditMode] = useState(false);
  const [newDocument, setNewDocument] = useState({
    name: '',
    type: 'texto',
    description: '',
    fileName: '',
    extension: '',
    content: ''
  });
  const [editingDocument, setEditingDocument] = useState(null);
  const [documentProcessing, setDocumentProcessing] = useState(false);
  const [taskEditMode, setTaskEditMode] = useState(false);
  const [taskEditDescription, setTaskEditDescription] = useState('');
  const [taskEditPriority, setTaskEditPriority] = useState(3);
  const [taskEditTargetType, setTaskEditTargetType] = useState('symbol');
  const [taskEditTargetId, setTaskEditTargetId] = useState('');
  const [editingInspectionId, setEditingInspectionId] = useState(null);
  const [inspectionEditAspect, setInspectionEditAspect] = useState('');
  const [inspectionEditDescription, setInspectionEditDescription] = useState('');
  const [projectLocks, setProjectLocks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const clientSessionId = useMemo(() => {
    const stored = window.localStorage.getItem('reqtrackerSessionId');
    if (stored) return stored;
    const newId = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem('reqtrackerSessionId', newId);
    return newId;
  }, []);
  const [editingResolveNoteId, setEditingResolveNoteId] = useState(null);
  const [editingResolveText, setEditingResolveText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [linkSearchEpisode, setLinkSearchEpisode] = useState('');
  const episodesRef = useRef(null);
  const [newSymbol, setNewSymbol] = useState({ name: '', type: 'Sujeto' });
  const [newSeedSymbol, setNewSeedSymbol] = useState({ name: '', type: 'Sujeto' });
  const [message, setMessage] = useState('');
  const [editingNotion, setEditingNotion] = useState(false);
  const [editingImpact, setEditingImpact] = useState(false);
  const [notionEdit, setNotionEdit] = useState('');
  const [impactEdit, setImpactEdit] = useState('');
  const [linkSearchNotion, setLinkSearchNotion] = useState('');
  const [linkSearchImpact, setLinkSearchImpact] = useState('');
  const notionRef = useRef(null);
  const impactRef = useRef(null);

  const parseOrder = (order) => {
    if (!order) return null;
    const parts = order.toString().split('.').map((part) => parseInt(part, 10));
    return parts.every((part) => !Number.isNaN(part)) ? parts : null;
  };

  const compareSymbolOrder = (a, b) => {
    const aOrder = parseOrder(a.order);
    const bOrder = parseOrder(b.order);
    if (aOrder && bOrder) {
      for (let i = 0; i < Math.max(aOrder.length, bOrder.length); i += 1) {
        const aPart = aOrder[i] ?? 0;
        const bPart = bOrder[i] ?? 0;
        if (aPart !== bPart) return aPart - bPart;
      }
      return 0;
    }
    if (aOrder) return -1;
    if (bOrder) return 1;
    return new Date(a.createdAt) - new Date(b.createdAt);
  };

  const getSymbolLabel = (symbol) => {
    return symbol.order ? `${symbol.order} ${symbol.name}` : symbol.name;
  };

  const getStatusBadgeClass = (status) => {
    if (status === 'complete') return 'bg-success';
    if (status === 'review') return 'bg-warning text-dark';
    return 'bg-danger';
  };



  useEffect(() => {
    loadProject();
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    const apiBase = import.meta.env.VITE_API_BASE || `${window.location.origin}/api`;
    const socketUrl = import.meta.env.VITE_SOCKET_URL || apiBase.replace(/\/api\/?$/, '');
    const socketInstance = io(socketUrl, {
      transports: ['websocket', 'polling']
    });
    const currentUserId = user?._id?.toString();

    socketInstance.on('connect', () => {
      socketInstance.emit('joinProject', projectId);
    });
    socketInstance.on('lockChanged', (locks) => {
      setProjectLocks(locks || []);
    });
    socketInstance.on('projectUpdated', () => {
      loadProject();
    });
    socketInstance.on('projectNotification', (notification) => {
      if (notification?.excludeUserId && notification.excludeUserId === currentUserId) {
        return;
      }
      setNotificationCount((count) => count + 1);
    });
    socketInstance.on('dataChanged', (data) => {
      if (data?.type === 'reload') {
        loadProject();
      }
    });
    setSocket(socketInstance);

    return () => {
      socketInstance.emit('leaveProject', projectId);
      socketInstance.disconnect();
    };
  }, [projectId, user]);

  useEffect(() => {
    if (!selectedSymbol && symbols.length > 0) {
      setSelectedSymbol(symbols[0]);
    }
  }, [symbols, selectedSymbol]);

  const loadProject = async () => {
    setIsLoading(true);
    try {
      const projectData = await fetchProject(projectId);
      setProject(projectData);
      setSymbols(projectData.symbols || []);
      setResolveNotes(projectData.resolveNotes || []);
      setScenarios(projectData.scenarios || []);
      setTasks(projectData.tasks || []);
      setInspections(projectData.inspections || []);
      setRequirements(projectData.requirements || []);
      setDocuments(projectData.documents || []);
      setProjectLocks(projectData.locks || []);
      setAboutIntro(projectData.about?.intro || '');
      setAboutItems(projectData.about?.items?.length ? projectData.about.items : ['']);
      setEmbeddingStats(projectData.embeddingStats || { missingSymbols: 0, missingRequirements: 0, totalSymbols: 0, totalRequirements: 0 });
      if (projectData.symbols && projectData.symbols.length > 0) {
        setSelectedSymbol(projectData.symbols[0]);
      }
      if (projectData.scenarios && projectData.scenarios.length > 0) {
        setSelectedScenario(projectData.scenarios[0]);
      }
      if (projectData.isProjectAdmin || canViewProjectUsers) {
        await loadProjectUsers(projectId);
      }
      await loadNotificationCount();
    } catch (error) {
      console.error('Error cargando proyecto:', error);
      setMessage(error.response?.data?.message || error.message || 'Error cargando el proyecto.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadNotificationCount = async () => {
    if (!projectId) return;
    try {
      const data = await fetchProjectNotificationsCount(projectId);
      setNotificationCount(data.count || 0);
    } catch (error) {
      console.warn('Error cargando el conteo de notificaciones:', error);
    }
  };

  const openNotificationsPanel = async () => {
    if (!projectId) return;
    setNotificationsOpen(true);
    setNotificationsLoading(true);
    try {
      const data = await fetchProjectNotifications(projectId);
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      setNotificationCount(0);
    } catch (error) {
      setMessage(error.response?.data?.message || 'No se pudieron cargar las notificaciones.');
    } finally {
      setNotificationsLoading(false);
    }
  };

  const loadProjectUsers = async (projectIdToLoad) => {
    setProjectUsersLoading(true);
    try {
      const data = await fetchProjectUsers(projectIdToLoad);
      setProjectUsers(Array.isArray(data.users) ? data.users : []);
    } catch (error) {
      console.warn('Error cargando usuarios del proyecto:', error);
      setProjectUsers([]);
    } finally {
      setProjectUsersLoading(false);
    }
  };

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get('tab');
    console.log('🌐 URL tab parameter:', tab, 'current activeTab:', activeTab);
    if (tab && tab !== activeTab) {
      console.log('🌐 Setting activeTab from URL to:', tab);
      setActiveTab(tab);
    }
  }, [location.search, activeTab]);

  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    navigate(`/project/${projectId}?tab=${tabKey}`, { replace: true });
  };

  const refreshSymbols = async () => {
    try {
      const data = await fetchSymbols(projectId);
      setSymbols(data);
      if (selectedSymbol) {
        const updated = data.find((symbol) => symbol._id === selectedSymbol._id);
        setSelectedSymbol(updated || data[0] || null);
      }
    } catch (error) {
      setMessage('Error cargando símbolos.');
    }
  };

  const handleGenerateGraph = async () => {
    if (!projectId) return;
    setGraphActionLoading(true);
    setGraphActionMessage('Generando grafo semántico...');
    try {
      const result = await generateProjectGraph(projectId);
      setGraphActionMessage(`Grafo generado: ${result.createdRelations} relaciones creadas. ${result.potentialRelations ?? 0} relaciones potenciales encontradas.`);
      await loadProject();
    } catch (error) {
      console.error('Error generando grafo:', error);
      setGraphActionMessage(error.response?.data?.message || error.message || 'No se pudo generar el grafo.');
    } finally {
      setGraphActionLoading(false);
    }
  };

  const handleRegenerateEmbeddings = async () => {
    if (!projectId) return;
    setGraphActionLoading(true);
    setGraphActionMessage('Regenerando embeddings faltantes...');
    try {
      const result = await regenerateProjectEmbeddings(projectId, { force: false });
      setGraphActionMessage(`Embeddings regenerados: ${result.regeneratedSymbols} símbolos, ${result.regeneratedRequirements} requisitos.`);
      await loadProject();
    } catch (error) {
      console.error('Error regenerando embeddings:', error);
      setGraphActionMessage(error.response?.data?.message || error.message || 'No se pudieron regenerar los embeddings.');
    } finally {
      setGraphActionLoading(false);
    }
  };

  const handleForceRegenerateEmbeddings = async () => {
    if (!projectId) return;
    setGraphActionLoading(true);
    setGraphActionMessage('Forzando regeneración de todos los embeddings...');
    try {
      const result = await regenerateProjectEmbeddings(projectId, { force: true });
      setGraphActionMessage(`Embeddings regenerados: ${result.regeneratedSymbols} símbolos, ${result.regeneratedRequirements} requisitos. (fuerza aplicada)`);
      await loadProject();
    } catch (error) {
      console.error('Error forzando regeneración de embeddings:', error);
      setGraphActionMessage(error.response?.data?.message || error.message || 'No se pudieron regenerar los embeddings.');
    } finally {
      setGraphActionLoading(false);
    }
  };

  const handleDocumentInputChange = (field, value) => {
    setNewDocument((prev) => ({ ...prev, [field]: value }));
  };

  const handleDocumentFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileName = file.name;
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    if (!['txt', 'pdf', 'docx'].includes(extension)) {
      setMessage('Solo se soportan archivos .txt, .pdf y .docx en el navegador. Usa .docx o pega el texto directamente.');
      return;
    }

    setDocumentProcessing(true);
    setMessage('');

    const newDoc = {
      ...newDocument,
      type: 'archivo',
      fileName,
      extension,
      content: ''
    };

    try {
      if (extension === 'txt') {
        newDoc.content = await file.text();
      } else {
        const arrayBuffer = await file.arrayBuffer();
        if (extension === 'pdf') {
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          let extractedText = '';
          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item) => (item.str || '')).join(' ');
            extractedText += `${pageText}\n\n`;
          }
          newDoc.content = extractedText.trim();
        } else if (extension === 'docx') {
          const result = await mammoth.extractRawText({ arrayBuffer });
          newDoc.content = result.value.trim();
        }
      }
    } catch (error) {
      console.error('Error leyendo archivo:', error);
      setMessage('No se pudo extraer el texto del archivo seleccionado.');
    } finally {
      setDocumentProcessing(false);
      setNewDocument(newDoc);
    }
  };

  const handleEditDocument = () => {
    if (!selectedDocument) return;
    setDocumentEditMode(true);
    setEditingDocument(selectedDocument);
    setNewDocument({
      name: selectedDocument.name,
      type: selectedDocument.type || 'texto',
      description: selectedDocument.description || '',
      fileName: selectedDocument.fileName || '',
      extension: selectedDocument.extension || '',
      content: selectedDocument.content || ''
    });
  };

  const handleCancelDocumentEdit = () => {
    setDocumentEditMode(false);
    setEditingDocument(null);
    setSelectedDocument(null);
    setNewDocument({
      name: '',
      type: 'texto',
      description: '',
      fileName: '',
      extension: '',
      content: ''
    });
  };

  const handleSaveDocument = async (event) => {
    event.preventDefault();
    if (!newDocument.name.trim()) {
      setMessage('El nombre del documento es obligatorio.');
      return;
    }
    if (newDocument.type === 'texto' && !newDocument.description.trim()) {
      setMessage('La descripción es obligatoria para documentos de texto.');
      return;
    }

    const payload = {
      ...newDocument,
      content: newDocument.type === 'texto' ? newDocument.description : newDocument.content || ''
    };

    try {
      if (documentEditMode && editingDocument) {
        const updated = await updateDocument(projectId, editingDocument.id, payload);
        setDocuments((prev) => prev.map((doc) => (doc.id === updated.id ? updated : doc)));
        setMessage('Documento actualizado correctamente.');
      } else {
        const created = await createDocument(projectId, payload);
        setDocuments((prev) => [created, ...prev]);
        setMessage('Documento creado correctamente.');
      }
      handleCancelDocumentEdit();
    } catch (error) {
      setMessage(error.response?.data?.message || 'No se pudo guardar el documento.');
    }
  };

  const handleDeleteDocument = async (documentId) => {
    if (!window.confirm('¿Eliminar este documento?')) return;
    try {
      await deleteDocument(projectId, documentId);
      setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
      setMessage('Documento eliminado correctamente.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'No se pudo eliminar el documento.');
    }
  };

  const handleSelect = (symbolId) => {
    const symbol = symbols.find((item) => item._id === symbolId);
    if (symbol) {
      setSelectedSymbol(symbol);
      setSymbolEditMode(false);
      setMessage('');
      setNewSymbol({ name: '', type: 'Sujeto' });
    }
  };

  const handleStartSymbolEdit = async () => {
    if (!selectedSymbol) return;
    if (isLockedByOther('symbol', selectedSymbol._id)) {
      setMessage(getLockInfo('symbol', selectedSymbol._id));
      return;
    }
    const locked = await lockItemAction('symbol', selectedSymbol._id);
    if (locked) {
      setSymbolEditMode(true);
    }
  };

  const handleCancelSymbolEdit = async () => {
    if (!selectedSymbol) return;
    const original = symbols.find((item) => item._id === selectedSymbol._id);
    if (original) {
      setSelectedSymbol(original);
    }
    setSymbolEditMode(false);
    await unlockItemAction('symbol', selectedSymbol._id);
    setMessage('Edición cancelada.');
  };

  const handleSelectScenario = (scenarioId) => {
    console.log('🎭 handleSelectScenario called with ID:', scenarioId);
    const scenario = scenarios.find((item) => item._id === scenarioId);
    console.log('🎭 Found scenario:', scenario ? 'YES' : 'NO', scenario);
    if (scenario) {
      console.log('🎭 Setting selectedScenario to:', scenario);
      setSelectedScenario(scenario);
      setScenarioEditMode(false);
      setMessage('');
    } else {
      console.warn('🎭 Scenario not found with ID:', scenarioId);
    }
  };

  const handleSelectDocument = (documentId) => {
    const document = documents.find((item) => item.id === documentId);
    if (document) {
      setSelectedDocument(document);
      setDocumentEditMode(false);
      setMessage('');
    }
  };

  const handleSelectItem = (reference) => {
    // Support three formats:
    // 1. New encoded format: SYM-1, SCN-2, REQ-3, etc.
    // 2. Legacy format: type:id
    // 3. Raw MongoDB ID (backward compatibility)

    let targetType = null;
    let actualTargetId = reference;

    // Try to decode encoded reference first
    const decoded = decodeElementReference(reference);
    if (decoded) {
      targetType = decoded.type;
      actualTargetId = decoded.id;
    }

    // If not decoded, try legacy format (type:id)
    if (!decoded && reference.includes(':')) {
      const parts = reference.split(':');
      targetType = parts[0];
      actualTargetId = parts[1];
    }

    // Navigate based on type
    if (targetType === 'symbol') {
      handleSelect(actualTargetId);
      setActiveTab('symbols');
      navigate(`/project/${projectId}?tab=symbols`, { replace: true });
      return;
    }

    if (targetType === 'scenario') {
      handleSelectScenario(actualTargetId);
      setActiveTab('scenarios');
      navigate(`/project/${projectId}?tab=scenarios`, { replace: true });
      return;
    }

    if (targetType === 'requirement') {
      handleSelectRequirement(actualTargetId);
      setActiveTab('requirements');
      navigate(`/project/${projectId}?tab=requirements`, { replace: true });
      return;
    }

    if (targetType === 'task') {
      handleSelectTask(actualTargetId);
      setActiveTab('tasks');
      navigate(`/project/${projectId}?tab=tasks`, { replace: true });
      return;
    }

    if (targetType === 'inspection') {
      handleSelectInspection(actualTargetId);
      setActiveTab('inspection');
      navigate(`/project/${projectId}?tab=inspection`, { replace: true });
      return;
    }
  };

  // Encoding/Decoding system for hyperlinks
  // Converts MongoDB IDs to user-friendly codes like SYM-1, SCN-2, etc.
  const encodeElementReference = (type, id) => {
    const typePrefix = {
      symbol: 'SYM',
      scenario: 'SCN',
      requirement: 'REQ',
      task: 'TSK',
      inspection: 'INS'
    }[type];

    if (!typePrefix) return id; // Fallback to raw ID if type unknown

    let index = 1;
    if (type === 'symbol') {
      index = symbols.findIndex((s) => s._id === id) + 1;
    } else if (type === 'scenario') {
      index = scenarios.findIndex((s) => s._id === id) + 1;
    } else if (type === 'requirement') {
      index = requirements.findIndex((r) => r._id === id) + 1;
    } else if (type === 'task') {
      index = tasks.findIndex((t) => t._id === id) + 1;
    } else if (type === 'inspection') {
      index = inspections.findIndex((i) => i._id === id) + 1;
    }

    return index > 0 ? `${typePrefix}-${index}` : id;
  };

  // Decode user-friendly code back to real ID and type
  const decodeElementReference = (code) => {
    if (!code || !code.includes('-')) {
      // Try to find by raw ID (backward compatibility)
      for (const symbol of symbols) {
        if (symbol._id === code) return { type: 'symbol', id: symbol._id };
      }
      for (const scenario of scenarios) {
        if (scenario._id === code) return { type: 'scenario', id: scenario._id };
      }
      for (const requirement of requirements) {
        if (requirement._id === code) return { type: 'requirement', id: requirement._id };
      }
      for (const task of tasks) {
        if (task._id === code) return { type: 'task', id: task._id };
      }
      for (const inspection of inspections) {
        if (inspection._id === code) return { type: 'inspection', id: inspection._id };
      }
      return null;
    }

    const [typePrefix, indexStr] = code.split('-');
    const index = parseInt(indexStr, 10) - 1;

    if (typePrefix === 'SYM' && index >= 0 && index < symbols.length) {
      return { type: 'symbol', id: symbols[index]._id };
    }
    if (typePrefix === 'SCN' && index >= 0 && index < scenarios.length) {
      return { type: 'scenario', id: scenarios[index]._id };
    }
    if (typePrefix === 'REQ' && index >= 0 && index < requirements.length) {
      return { type: 'requirement', id: requirements[index]._id };
    }
    if (typePrefix === 'TSK' && index >= 0 && index < tasks.length) {
      return { type: 'task', id: tasks[index]._id };
    }
    if (typePrefix === 'INS' && index >= 0 && index < inspections.length) {
      return { type: 'inspection', id: inspections[index]._id };
    }

    return null;
  };

  const getTargetLabel = (targetType, targetId) => {
    if (targetType === 'symbol') {
      return symbols.find((symbol) => symbol._id === targetId)?.name || 'Símbolo';
    }
    if (targetType === 'scenario') {
      return scenarios.find((scenario) => scenario._id === targetId)?.title || 'Escenario';
    }
    if (targetType === 'requirement') {
      return requirements.find((requirement) => requirement._id === targetId)?.title || 'Requisito';
    }
    if (targetType === 'task') {
      return tasks.find((task) => task._id === targetId)?.description || 'Tarea';
    }
    if (targetType === 'inspection') {
      return inspections.find((inspection) => inspection._id === targetId)?.description || 'Inspección';
    }
    return 'Elemento';
  };

  // Helper function to create safe references for hyperlinks
  const createElementReference = (type, id) => {
    return `${type}:${id}`;
  };

  // Helper function to get available elements for hyperlink creation
  const getAvailableElements = () => {
    const elements = [];
    symbols.forEach(symbol => elements.push({ type: 'symbol', id: symbol._id, label: `${symbol.name} (Símbolo)` }));
    scenarios.forEach(scenario => elements.push({ type: 'scenario', id: scenario._id, label: `${scenario.title} (Escenario)` }));
    requirements.forEach(requirement => elements.push({ type: 'requirement', id: requirement._id, label: `${requirement.title} (Requisito)` }));
    tasks.forEach(task => elements.push({ type: 'task', id: task._id, label: `${task.description.substring(0, 50)}... (Tarea)` }));
    inspections.forEach(inspection => elements.push({ type: 'inspection', id: inspection._id, label: `${inspection.description.substring(0, 50)}... (Inspección)` }));
    return elements;
  };

  const getLockForItem = (targetType, targetId) => {
    return projectLocks.find((lock) => lock.targetType === targetType && lock.targetId === targetId);
  };

  const isLockedByOther = (targetType, targetId) => {
    const lock = getLockForItem(targetType, targetId);
    return lock && lock.sessionId !== clientSessionId;
  };

  const lockItemAction = async (targetType, targetId) => {
    try {
      await lockItem(projectId, { targetType, targetId, sessionId: clientSessionId });
      return true;
    } catch (error) {
      setMessage(error.response?.data?.message || 'No se pudo bloquear el elemento para edición.');
      return false;
    }
  };

  const unlockItemAction = async (targetType, targetId) => {
    try {
      await unlockItem(projectId, { targetType, targetId, sessionId: clientSessionId });
      return true;
    } catch (error) {
      return false;
    }
  };

  const getLockInfo = (targetType, targetId) => {
    const lock = getLockForItem(targetType, targetId);
    return lock ? `Bloqueado por ${lock.lockedBy}` : '';
  };

  const handleCreateResolveNote = async () => {
    if (!newResolveText.trim()) {
      setMessage('Escribe una nota para agregarla.');
      return;
    }
    try {
      await createResolveNote(projectId, newResolveText.trim());
      setNewResolveText('');
      setMessage('Nota agregada a resolver.');
      loadProject();
    } catch (error) {
      setMessage(error.response?.data?.message || 'No se pudo agregar la nota.');
    }
  };

  const handleCreateTask = async () => {
    if (!taskDescription.trim()) {
      setMessage('La descripción de la tarea es obligatoria.');
      return;
    }
    if (!taskTargetId) {
      setMessage('Selecciona el elemento asociado a la tarea.');
      return;
    }
    try {
      await createTask(projectId, {
        priority: taskPriority,
        description: taskDescription.trim(),
        targetType: taskTargetType,
        targetId: taskTargetId,
        targetLabel: getTargetLabel(taskTargetType, taskTargetId)
      });
      setTaskDescription('');
      setTaskPriority(3);
      setTaskTargetId('');
      setMessage('Tarea pendiente agregada.');
      loadProject();
    } catch (error) {
      setMessage(error.response?.data?.message || 'No se pudo crear la tarea pendiente.');
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Marcar esta tarea como realizada y eliminarla?')) return;
    try {
      await deleteTask(projectId, taskId);
      setMessage('Tarea completada.');
      loadProject();
      setSelectedTask(null);
    } catch (error) {
      setMessage(error.response?.data?.message || 'No se pudo completar la tarea.');
    }
  };

  const handleStartTaskEdit = () => {
    if (selectedTask) {
      setTaskEditDescription(selectedTask.description);
      setTaskEditPriority(selectedTask.priority);
      setTaskEditTargetType(selectedTask.targetType);
      setTaskEditTargetId(selectedTask.targetId);
      setTaskEditMode(true);
    }
  };

  const handleSaveTask = async () => {
    if (!taskEditDescription.trim()) {
      setMessage('La descripción de la tarea es obligatoria.');
      return;
    }
    try {
      await updateTask(projectId, selectedTask._id, {
        description: taskEditDescription.trim(),
        priority: taskEditPriority,
        targetType: taskEditTargetType,
        targetId: taskEditTargetId,
        targetLabel: getTargetLabel(taskEditTargetType, taskEditTargetId)
      });
      setMessage('Tarea actualizada.');
      setTaskEditMode(false);
      loadProject();
    } catch (error) {
      setMessage(error.response?.data?.message || 'No se pudo actualizar la tarea.');
    }
  };

  const handleCancelTaskEdit = () => {
    setTaskEditMode(false);
  };

  const handleStartInspectionEdit = (inspection) => {
    setEditingInspectionId(inspection._id);
    setInspectionEditAspect(inspection.aspect);
    setInspectionEditDescription(inspection.description);
  };

  const handleSaveInspection = async () => {
    if (!inspectionEditAspect.trim() || !inspectionEditDescription.trim()) {
      setMessage('Aspecto y descripción son obligatorios.');
      return;
    }
    try {
      await updateInspection(projectId, editingInspectionId, {
        aspect: inspectionEditAspect.trim(),
        description: inspectionEditDescription.trim()
      });
      setMessage('Inspección actualizada.');
      setEditingInspectionId(null);
      loadProject();
    } catch (error) {
      setMessage(error.response?.data?.message || 'No se pudo actualizar la inspección.');
    }
  };

  const handleCancelInspectionEdit = () => {
    setEditingInspectionId(null);
  };

  const handleDeleteInspection = async (inspectionId) => {
    if (!window.confirm('Marcar esta inspección como resuelta y eliminarla?')) return;
    try {
      await deleteInspection(projectId, inspectionId);
      setMessage('Inspección resuelta.');
      loadProject();
    } catch (error) {
      setMessage(error.response?.data?.message || 'No se pudo eliminar la inspección.');
    }
  };

  const groupInspectionsByDate = useMemo(() => {
    const grouped = {};
    inspections.forEach((inspection) => {
      const date = new Date(inspection.createdAt).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(inspection);
    });
    return grouped;
  }, [inspections]);

  const handleCreateInspectionFromScenario = (scenarioId) => {
    const scenario = scenarios.find(s => s._id === scenarioId);
    if (scenario) {
      setInspectionTargetType('scenario');
      setInspectionTargetId(scenarioId);
      setActiveTab('inspection');
      setMessage('Crea una inspección para este escenario.');
    }
  };

  const handleCreateInspection = async () => {
    if (!inspectionAspect.trim() || !inspectionDescription.trim()) {
      setMessage('Aspecto y descripción del reporte son obligatorios.');
      return;
    }
    if (!inspectionTargetId) {
      setMessage('Selecciona el símbolo o escenario asociado al reporte.');
      return;
    }
    try {
      await createInspection(projectId, {
        targetType: inspectionTargetType,
        targetId: inspectionTargetId,
        targetLabel: getTargetLabel(inspectionTargetType, inspectionTargetId),
        aspect: inspectionAspect.trim(),
        description: inspectionDescription.trim()
      });
      setInspectionAspect('');
      setInspectionDescription('');
      setInspectionTargetId('');
      setMessage('Reporte de inspección guardado.');
      loadProject();
    } catch (error) {
      setMessage(error.response?.data?.message || 'No se pudo crear el reporte de inspección.');
    }
  };

  const handleCreateRequirement = async () => {
    if (!newRequirement.name.trim()) {
      setMessage('El nombre del requisito es obligatorio.');
      return;
    }
    try {
      await createRequirement(projectId, {
        ...newRequirement,
        identifier: newRequirement.identifier.trim(),
        name: newRequirement.name.trim(),
        type: newRequirement.type.trim(),
        description: newRequirement.description.trim(),
        basis: newRequirement.basis.trim()
      });
      setNewRequirement({
        identifier: '',
        name: '',
        type: '',
        description: '',
        basis: '',
        priority: 'Media',
        criticidad: 'Media',
        costoImplementacion: 'Medio',
        volatilidad: 'Media',
        factibilidad: 'Media',
        riesgo: 'Medio'
      });
      setMessage('Requisito agregado.');
      loadProject();
    } catch (error) {
      setMessage(error.response?.data?.message || 'No se pudo crear el requisito.');
    }
  };

  const handleSelectRequirement = (requirementId) => {
    console.log('📋 handleSelectRequirement called with ID:', requirementId);
    const requirement = requirements.find((item) => item._id === requirementId);
    console.log('📋 Found requirement:', requirement ? 'YES' : 'NO', requirement);
    if (requirement) {
      console.log('📋 Setting selectedRequirement to:', requirement);
      setSelectedRequirement(requirement);
      setRequirementEditMode(false);
      setEditingRequirement(null);
      setMessage('');
    } else {
      console.warn('📋 Requirement not found with ID:', requirementId);
    }
  };

  const handleSelectTask = (taskId) => {
    console.log('✅ handleSelectTask called with ID:', taskId);
    const task = tasks.find((item) => item._id === taskId);
    console.log('✅ Found task:', task ? 'YES' : 'NO', task);
    if (task) {
      console.log('✅ Setting selectedTask to:', task);
      setSelectedTask(task);
      setMessage('');
    } else {
      console.warn('✅ Task not found with ID:', taskId);
    }
  };

  const handleSelectInspection = (inspectionId) => {
    console.log('🔍 handleSelectInspection called with ID:', inspectionId);
    // Inspections don't have individual selection, just switch to inspection tab
    console.log('🔍 Switching to inspection tab');
    setActiveTab('inspection');
  };

  const handleStartRequirementEdit = () => {
    if (!selectedRequirement) return;
    setRequirementEditMode(true);
    setEditingRequirement({ ...selectedRequirement });
  };

  const handleCancelRequirementEdit = () => {
    setRequirementEditMode(false);
    setEditingRequirement(null);
  };

  const handleSaveRequirement = async () => {
    if (!editingRequirement?.name?.trim()) {
      setMessage('El nombre del requisito es obligatorio.');
      return;
    }
    try {
      await updateRequirement(projectId, selectedRequirement._id, {
        identifier: editingRequirement.identifier?.trim() || '',
        name: editingRequirement.name.trim(),
        type: editingRequirement.type?.trim() || '',
        description: editingRequirement.description?.trim() || '',
        basis: editingRequirement.basis?.trim() || '',
        priority: editingRequirement.priority,
        criticidad: editingRequirement.criticidad,
        costoImplementacion: editingRequirement.costoImplementacion,
        volatilidad: editingRequirement.volatilidad,
        factibilidad: editingRequirement.factibilidad,
        riesgo: editingRequirement.riesgo
      });
      setMessage('Requisito actualizado.');
      setRequirementEditMode(false);
      setEditingRequirement(null);
      loadProject();
    } catch (error) {
      setMessage(error.response?.data?.message || 'No se pudo actualizar el requisito.');
    }
  };

  const handleDeleteRequirement = async (requirementId) => {
    if (!window.confirm('¿Eliminar este requisito?')) return;
    try {
      await deleteRequirement(projectId, requirementId);
      setMessage('Requisito eliminado.');
      setSelectedRequirement(null);
      setRequirementEditMode(false);
      setEditingRequirement(null);
      loadProject();
    } catch (error) {
      setMessage(error.response?.data?.message || 'No se pudo eliminar el requisito.');
    }
  };

  const handleSaveAbout = async () => {
    try {
      await updateAbout(projectId, {
        intro: aboutIntro,
        items: aboutItems.filter((item) => item.trim())
      });
      setAboutEditMode(false);
      setMessage('Sección Acerca del Sistema actualizada.');
      loadProject();
    } catch (error) {
      setMessage(error.response?.data?.message || 'No se pudo guardar la sección Acerca del Sistema.');
    }
  };

  const handleExportProjectJson = async () => {
    try {
      const projectData = await fetchProjectExport(projectId);
      const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${project?.name?.replace(/[^a-zA-Z0-9-_\.]/g, '_') || 'proyecto'}_${projectId}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setMessage('Exportación JSON preparada.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'No se pudo exportar el proyecto.');
    }
  };

  const handleAddAboutItem = () => {
    setAboutItems((prev) => [...prev, '']);
  };

  const handleRemoveAboutItem = (index) => {
    setAboutItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAboutItemChange = (index, value) => {
    setAboutItems((prev) => prev.map((item, idx) => (idx === index ? value : item)));
  };

  const handleEditResolveNoteStart = (note) => {
    setEditingResolveNoteId(note._id);
    setEditingResolveText(note.text || '');
  };

  const handleSaveResolveNote = async () => {
    if (!editingResolveText.trim() || !editingResolveNoteId) {
      setMessage('Escribe texto para guardar la nota.');
      return;
    }
    try {
      await updateResolveNote(projectId, editingResolveNoteId, editingResolveText.trim());
      setEditingResolveNoteId(null);
      setEditingResolveText('');
      setMessage('Nota actualizada.');
      loadProject();
    } catch (error) {
      setMessage(error.response?.data?.message || 'No se pudo actualizar la nota.');
    }
  };

  const handleCancelResolveEdit = () => {
    setEditingResolveNoteId(null);
    setEditingResolveText('');
  };

  const handleResolveNote = async (noteId) => {
    try {
      await resolveNote(projectId, noteId);
      setMessage('Nota marcada como resuelta.');
      loadProject();
    } catch (error) {
      setMessage(error.response?.data?.message || 'No se pudo marcar la nota como resuelta.');
    }
  };

  const handleDeleteResolveNote = async (noteId) => {
    if (!window.confirm('¿Eliminar esta nota?')) return;
    try {
      await deleteResolveNote(projectId, noteId);
      setMessage('Nota eliminada.');
      loadProject();
    } catch (error) {
      setMessage(error.response?.data?.message || 'No se pudo eliminar la nota.');
    }
  };

  const groupResolveNotesByDate = useMemo(() => {
    return resolveNotes.reduce((groups, note) => {
      const dateKey = new Date(note.createdAt).toLocaleDateString();
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(note);
      return groups;
    }, {});
  }, [resolveNotes]);

  const handleUpdateField = (field, value) => {
    setSelectedSymbol((prev) => ({ ...prev, [field]: value }));
  };

  const addListItem = (ref, value, setter) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const before = value.slice(0, start);
    const selected = value.slice(start, end) || '';
    const after = value.slice(end);
    const lines = selected.split('\n').map((line) => line.startsWith('- ') ? line : `- ${line}`);
    const nextValue = before + lines.join('\n') + after;
    setter(nextValue);
    window.requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start, start + lines.join('\n').length);
    });
  };

  const insertLinkToItem = (itemId, ref, value, setter) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    
    // Detect element type and get label
    let label = 'enlace';
    let encodedReference = itemId;
    
    const symbol = symbols.find((item) => item._id === itemId);
    if (symbol) {
      label = symbol.name;
      encodedReference = encodeElementReference('symbol', itemId);
    }
    
    const scenario = scenarios.find((item) => item._id === itemId);
    if (scenario) {
      label = scenario.title;
      encodedReference = encodeElementReference('scenario', itemId);
    }
    
    const requirement = requirements.find((item) => item._id === itemId);
    if (requirement) {
      label = requirement.title;
      encodedReference = encodeElementReference('requirement', itemId);
    }
    
    const task = tasks.find((item) => item._id === itemId);
    if (task) {
      label = task.description.substring(0, 50);
      encodedReference = encodeElementReference('task', itemId);
    }
    
    const inspection = inspections.find((item) => item._id === itemId);
    if (inspection) {
      label = inspection.description.substring(0, 50);
      encodedReference = encodeElementReference('inspection', itemId);
    }
    
    const selected = value.slice(start, end).trim();
    const finalLabel = selected || label;
    const nextValue = value.slice(0, start) + `[${finalLabel}](${encodedReference})` + value.slice(end);
    setter(nextValue);
    window.requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + finalLabel.length + 3, start + finalLabel.length + 3 + finalLabel.length);
    });
  };

  const insertLinkToSymbol = (itemId, ref, value, setter) => {
    insertLinkToItem(itemId, ref, value, setter);
  };

  const filteredLinkItemsEpisode = useMemo(() => {
    const query = linkSearchEpisode.trim().toLowerCase();
    const allItems = [
      ...symbols.map((symbol, index) => ({
        _id: symbol._id,
        code: `SYM-${index + 1}`,
        label: `[SYM-${index + 1}] ${symbol.name} (${symbol.type})`,
        type: 'symbol'
      })),
      ...scenarios.map((scenario, index) => ({
        _id: scenario._id,
        code: `SCN-${index + 1}`,
        label: `[SCN-${index + 1}] ${scenario.type}: ${scenario.title}`,
        type: 'scenario'
      }))
    ];
    return allItems.filter((item) => {
      if (!query) return true;
      return item.label.toLowerCase().includes(query);
    });
  }, [linkSearchEpisode, symbols, scenarios]);

  const getScenarioLabel = (scenario) => {
    return scenario.order ? `${scenario.order} ${scenario.title}` : scenario.title;
  };

  const filteredScenarios = useMemo(() => {
    const query = scenarioSearch.trim().toLowerCase();
    return scenarios
      .filter((scenario) => scenarioTab === 'Todos' || scenario.type === scenarioTab)
      .filter((scenario) => {
        if (!query) return true;
        return scenario.title?.toLowerCase().includes(query);
      })
      .sort((a, b) => {
        if (a.order && b.order) return a.order.localeCompare(b.order, undefined, { numeric: true, sensitivity: 'base' });
        if (a.order) return -1;
        if (b.order) return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
  }, [scenarios, scenarioTab, scenarioSearch]);

  const handleScenarioFieldChange = (field, value) => {
    setSelectedScenario((prev) => prev ? { ...prev, [field]: value } : prev);
  };

  const handleStartScenarioEdit = async () => {
    if (!selectedScenario) return;
    if (isLockedByOther('scenario', selectedScenario._id)) {
      setMessage(getLockInfo('scenario', selectedScenario._id));
      return;
    }
    const locked = await lockItemAction('scenario', selectedScenario._id);
    if (locked) {
      setScenarioEditMode(true);
    }
  };

  const handleCancelScenarioEdit = async () => {
    if (!selectedScenario) return;
    const original = scenarios.find((item) => item._id === selectedScenario._id);
    if (original) {
      setSelectedScenario(original);
    }
    setScenarioEditMode(false);
    await unlockItemAction('scenario', selectedScenario._id);
    setMessage('Edición cancelada.');
  };

  const handleCreateScenario = async () => {
    if (!newScenario.title.trim()) {
      setMessage('El título del escenario es obligatorio.');
      return;
    }
    try {
      const response = await createScenario(projectId, {
        ...newScenario,
        type: newScenario.type || 'Escenario'
      });
      setScenarios((prev) => [...prev, response]);
      setSelectedScenario(response);
      setNewScenario({
        type: 'Escenario',
        title: '',
        objective: '',
        locationTemporal: '',
        locationGeographic: '',
        preconditions: '',
        actors: '',
        resources: '',
        episodes: '',
        exceptions: '',
        order: ''
      });
      setMessage('Escenario añadido.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'No se pudo crear el escenario.');
    }
  };

  const handleUpdateScenario = async () => {
    if (!selectedScenario) return;
    if (!selectedScenario.title.trim()) {
      setMessage('El título del escenario es obligatorio.');
      return;
    }
    try {
      const response = await updateScenario(projectId, selectedScenario._id, selectedScenario);
      setScenarios((prev) => prev.map((item) => (item._id === response._id ? response : item)));
      setSelectedScenario(response);
      setScenarioEditMode(false);
      await unlockItemAction('scenario', response._id);
      setMessage('Escenario actualizado.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'No se pudo actualizar el escenario.');
    }
  };

  const handleDeleteScenario = async () => {
    if (!selectedScenario) return;
    if (!window.confirm('¿Eliminar este escenario?')) return;
    try {
      await deleteScenario(projectId, selectedScenario._id);
      await unlockItemAction('scenario', selectedScenario._id);
      setScenarios((prev) => prev.filter((item) => item._id !== selectedScenario._id));
      setSelectedScenario(null);
      setMessage('Escenario eliminado.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'No se pudo eliminar el escenario.');
    }
  };

  useEffect(() => {
    if (!selectedSymbol) return;
    setNotionEdit(selectedSymbol.notion || '');
    setImpactEdit(selectedSymbol.impact || '');
    setLinkSearchNotion('');
    setLinkSearchImpact('');
    setEditingNotion(false);
    setEditingImpact(false);
  }, [selectedSymbol]);

  const handleSave = async () => {
    if (!selectedSymbol) return;
    try {
      const updatedSymbol = await updateSymbol(projectId, selectedSymbol._id, {
        name: selectedSymbol.name,
        type: selectedSymbol.type,
        parentSymbol: selectedSymbol.parentSymbol || null,
        isSeed: selectedSymbol.isSeed,
        order: selectedSymbol.order || '',
        notion: notionEdit,
        impact: impactEdit,
        reviewNotes: selectedSymbol.reviewNotes || '',
        status: selectedSymbol.status
      });
      setSelectedSymbol(updatedSymbol);
      setSymbolEditMode(false);
      await unlockItemAction('symbol', selectedSymbol._id);
      setMessage('Símbolo actualizado');
      refreshSymbols();
    } catch (error) {
      setMessage(error.response?.data?.message || 'No se pudo guardar el símbolo.');
    }
  };

  const handleAddSymbol = async () => {
    if (!newSymbol.name.trim() || !newSymbol.type.trim() || !selectedSymbol) {
      setMessage('Ingrese nombre y tipo para el nuevo símbolo.');
      return;
    }
    try {
      await createSymbol(projectId, {
        name: newSymbol.name.trim(),
        type: newSymbol.type.trim(),
        parentSymbol: selectedSymbol._id
      });
      setNewSymbol({ name: '', type: 'Sujeto' });
      setMessage('Nuevo símbolo añadido.');
      refreshSymbols();
    } catch (error) {
      setMessage('No se pudo crear el nuevo símbolo.');
    }
  };

  const handleAddSeedSymbol = async () => {
    if (!newSeedSymbol.name.trim() || !newSeedSymbol.type.trim()) {
      setMessage('Ingrese nombre y tipo para el símbolo semilla.');
      return;
    }
    try {
      await createSymbol(projectId, {
        name: newSeedSymbol.name.trim(),
        type: newSeedSymbol.type.trim(),
        isSeed: true
      });
      setNewSeedSymbol({ name: '', type: 'Sujeto' });
      setMessage('Símbolo semilla añadido.');
      refreshSymbols();
    } catch (error) {
      setMessage('No se pudo crear el símbolo semilla.');
    }
  };

  const handleDeleteSymbol = async () => {
    if (!selectedSymbol) return;
    if (!window.confirm('¿Eliminar el símbolo seleccionado?')) return;
    try {
      await deleteSymbol(projectId, selectedSymbol._id);
      await unlockItemAction('symbol', selectedSymbol._id);
      setMessage('Símbolo eliminado.');
      refreshSymbols();
    } catch (error) {
      setMessage('No se pudo eliminar el símbolo.');
    }
  };

  const symbolIndex = useMemo(() => {
    return Object.fromEntries(symbols.map((symbol) => [symbol._id, symbol]));
  }, [symbols]);

  const filteredLinkSymbolsNotion = useMemo(() => {
    const query = linkSearchNotion.trim().toLowerCase();
    return symbols
      .filter((symbol) => {
        if (!selectedSymbol || symbol._id === selectedSymbol._id) return false;
        if (!query) return true;
        const name = symbol.name?.toLowerCase() || '';
        const type = symbol.type?.toLowerCase() || '';
        return name.includes(query) || type.includes(query);
      })
      .map((symbol, index) => ({
        ...symbol,
        code: `SYM-${index + 1}`,
        displayLabel: `[SYM-${index + 1}] ${symbol.name} (${symbol.type})`
      }));
  }, [symbols, linkSearchNotion, selectedSymbol]);

  const filteredLinkSymbolsImpact = useMemo(() => {
    const query = linkSearchImpact.trim().toLowerCase();
    return symbols
      .filter((symbol) => {
        if (!selectedSymbol || symbol._id === selectedSymbol._id) return false;
        if (!query) return true;
        const name = symbol.name?.toLowerCase() || '';
        const type = symbol.type?.toLowerCase() || '';
        return name.includes(query) || type.includes(query);
      })
      .map((symbol, index) => ({
        ...symbol,
        code: `SYM-${index + 1}`,
        displayLabel: `[SYM-${index + 1}] ${symbol.name} (${symbol.type})`
      }));
  }, [symbols, linkSearchImpact, selectedSymbol]);

  const renderFormattedSegment = (text, keyPrefix = 'seg') => {
    const regex = /(\[([^\]]+)\]\(([^)]+)\))|(\*\*([^*]+)\*\*)|(__([^_]+)__)/;
    const match = text.match(regex);
    if (!match) return [text];

    const before = text.slice(0, match.index);
    const after = text.slice(match.index + match[0].length);
    const parts = [];
    if (before) parts.push(before);

    if (match[1]) {
      const label = match[2];
      const targetId = match[3];
      parts.push(
        <a
          key={`${keyPrefix}-link-${targetId}-${before.length}`}
          href="#"
          onClick={(event) => {
            event.preventDefault();
            handleSelectItem(targetId);
          }}
          className="text-decoration-none"
        >
          {label}
        </a>
      );
    } else if (match[4]) {
      parts.push(
        <strong key={`${keyPrefix}-bold-${before.length}`}>{match[5]}</strong>
      );
    } else if (match[6]) {
      parts.push(
        <u key={`${keyPrefix}-underline-${before.length}`}>{match[7]}</u>
      );
    }

    return [...parts, ...renderFormattedSegment(after, `${keyPrefix}-next`)];
  };

  const renderFormattedContent = (value) => {
    const lines = (value || '').split('\n');
    return (
      <div>
        {lines.map((line, index) => {
          if (line.trim().startsWith('- ')) {
            return (
              <div key={`item-${index}`} className="border rounded-3 p-3 mb-2 bg-white shadow-sm">
                {renderFormattedSegment(line.trim().slice(2), `item-${index}`)}
              </div>
            );
          }
          if (!line.trim()) {
            return <div key={`empty-${index}`} className="mb-2">&nbsp;</div>;
          }
          return (
            <p key={`para-${index}`} className="mb-2">
              {renderFormattedSegment(line, `para-${index}`)}
            </p>
          );
        })}
      </div>
    );
  };

  const ancestors = useMemo(() => {
    const chain = [];
    let current = selectedSymbol;
    while (current && current.parentSymbol) {
      const parent = symbolIndex[current.parentSymbol];
      if (!parent) break;
      chain.unshift(parent);
      current = parent;
    }
    return chain;
  }, [selectedSymbol, symbolIndex]);

  const sortedSymbols = useMemo(() => {
    return [...symbols].sort(compareSymbolOrder);
  }, [symbols]);

  const filteredSymbols = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return sortedSymbols;
    return sortedSymbols.filter((symbol) => {
      const name = symbol.name?.toLowerCase() || '';
      const type = symbol.type?.toLowerCase() || '';
      return name.includes(query) || type.includes(query);
    });
  }, [sortedSymbols, searchQuery]);

  const descendantIds = useMemo(() => {
    if (!selectedSymbol) return new Set();
    const ids = new Set();
    const queue = [selectedSymbol._id];

    while (queue.length > 0) {
      const currentId = queue.shift();
      symbols.forEach((symbol) => {
        if (symbol.parentSymbol && String(symbol.parentSymbol) === String(currentId) && !ids.has(symbol._id)) {
          ids.add(symbol._id);
          queue.push(symbol._id);
        }
      });
    }

    return ids;
  }, [selectedSymbol, symbols]);

  const availableParentSymbols = useMemo(() => {
    if (!selectedSymbol) return [];
    return symbols
      .filter((symbol) => symbol._id !== selectedSymbol._id && !descendantIds.has(symbol._id))
      .sort(compareSymbolOrder);
  }, [selectedSymbol, symbols, descendantIds]);

  const childSymbols = useMemo(() => {
    if (!selectedSymbol) return [];
    return symbols
      .filter((symbol) => symbol.parentSymbol === selectedSymbol._id)
      .sort(compareSymbolOrder);
  }, [selectedSymbol, symbols]);

  return (
    <div className="container py-4 position-relative">
      {notificationsOpen && (
        <>
          <div
            className="position-fixed top-0 start-0 w-100 h-100"
            style={{ zIndex: 1990, backgroundColor: 'rgba(0,0,0,0.35)' }}
            onClick={() => setNotificationsOpen(false)}
          />
          <div
            className="position-fixed top-0 end-0 h-100 bg-white shadow-2xl d-flex flex-column"
            style={{ width: '420px', maxWidth: '100%', zIndex: 2000 }}
          >
            <div className="d-flex align-items-center justify-content-between p-3 border-bottom">
              <div>
                <h5 className="mb-1">Notificaciones</h5>
                <small className="text-muted">Últimas novedades del proyecto</small>
              </div>
              <button className="btn btn-sm btn-outline-secondary" onClick={() => setNotificationsOpen(false)}>
                Cerrar
              </button>
            </div>
            <div className="flex-grow-1 overflow-auto p-3">
              {notificationsLoading ? (
                <div className="text-center py-5">Cargando notificaciones...</div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-5 text-muted">No hay notificaciones nuevas.</div>
              ) : (
                <div className="list-group">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="list-group-item list-group-item-action mb-2"
                    >
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <div className="fw-semibold">{notification.message}</div>
                          <div className="text-muted small mt-1">{new Date(notification.createdAt).toLocaleString('es-ES')}</div>
                        </div>
                        <span className="badge bg-secondary">{notification.actor?.username || 'Usuario'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start gap-3 mb-4 position-sticky top-0 bg-white py-3" style={{ zIndex: 1030 }}>
        <div>
          <h1>{project?.name || 'Proyecto'}</h1>
          <p className="text-muted">Secciones fundamentales: Documentos, Lista de símbolos, Mapa de relaciones, Escenarios, A Resolver, Asistente, Acerca del Sistema, Tareas Pendientes e Inspección.</p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-outline-primary position-relative d-flex align-items-center"
            onClick={openNotificationsPanel}
          >
            <span className="me-2">Notificaciones</span>
            <span style={{ fontSize: '1rem' }}>🔔</span>
            {notificationCount > 0 && (
              <span className="badge bg-danger rounded-pill position-absolute top-0 end-0 translate-middle" style={{ fontSize: '0.6rem' }}>
                {notificationCount}
              </span>
            )}
          </button>
          <Link to="/" className="btn btn-outline-secondary align-self-start">
            Volver al menú
          </Link>
        </div>
      </div>

      {isLoading && (
        <div className="d-flex justify-content-center my-3">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      )}

      <div className="mb-3">
        <div className="d-flex overflow-auto" style={{ maxWidth: '100%' }}>
          <div className="btn-group flex-nowrap" role="group">
            {[
              { key: 'documents', label: 'Documentos' },
              { key: 'about', label: 'Acerca del Sistema' },
              { key: 'symbols', label: 'Lista de símbolos' },
              { key: 'map', label: 'Mapa de relaciones' },
              { key: 'scenarios', label: 'Escenarios' },
              { key: 'requirements', label: `Requisitos${requirements.length > 0 ? ` (${requirements.length})` : ''}` },
              { key: 'tasks', label: `Tareas Pendientes${tasks.length > 0 ? ` (${tasks.length})` : ''}` },
              { key: 'inspection', label: `Inspección${inspections.length > 0 ? ` (${inspections.length})` : ''}` },
              ...(canViewProjectUsers ? [{ key: 'users', label: 'Usuarios' }] : []),
              { key: 'resolve', label: 'A Resolver' },
              { key: 'assistant', label: 'Asistente' }
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`btn ${activeTab === tab.key ? 'btn-primary' : tab.key === 'tasks' && tasks.length > 0 ? 'btn-warning' : tab.key === 'inspection' && inspections.length > 0 ? 'btn-danger' : tab.key === 'requirements' && requirements.length > 0 ? 'btn-warning' : 'btn-outline-primary'}`}
                onClick={() => handleTabChange(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {message && <div className="alert alert-info">{message}</div>}

      {activeTab === 'documents' && (
        <div className="row g-4">
          <div className="col-xl-4">
            <div className="card shadow-sm h-100">
              <div className="card-body">
                <h3>Lista de documentos</h3>
                <div className="mb-3">
                  {canEditAsAdmin ? (
                    <button type="button" className="btn btn-primary w-100" onClick={() => { setDocumentEditMode(true); setEditingDocument(null); setSelectedDocument(null); }}>
                      Nuevo documento
                    </button>
                  ) : (
                    <div className="alert alert-secondary mb-0">Acceso de solo lectura. No podés crear ni editar documentos en este proyecto.</div>
                  )}
                </div>
                <div className="list-group">
                  {documents.length === 0 ? (
                    <div className="list-group-item">No hay documentos.</div>
                  ) : (
                    documents.map((doc) => (
                      <button
                        type="button"
                        key={doc.id}
                        onClick={() => handleSelectDocument(doc.id)}
                        className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${selectedDocument?.id === doc.id ? 'active' : ''}`}
                      >
                        <div>
                          <div>{doc.name}</div>
                          <div className="mt-1">
                            <span className="badge bg-primary me-2">{doc.type === 'texto' ? 'Texto' : 'Archivo'}</span>
                            {doc.extension && <small className="badge bg-secondary">{doc.extension}</small>}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-8">
            <div className="card shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <div>
                    <h3>Detalle del documento</h3>
                    <p className="text-muted">Visualiza y edita el contenido del documento.</p>
                  </div>
                  {selectedDocument && (
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <span className="badge bg-primary py-2">{selectedDocument.type === 'texto' ? 'Texto' : 'Archivo'}</span>
                      {selectedDocument.extension && (
                        <span className="badge bg-secondary py-2">{selectedDocument.extension}</span>
                      )}
                      {canEditAsAdmin ? (
                        <>
                          <button type="button" className="btn btn-outline-primary btn-sm" onClick={handleEditDocument}>
                            Editar
                          </button>
                          <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => handleDeleteDocument(selectedDocument.id)}>
                            Eliminar
                          </button>
                        </>
                      ) : null}
                    </div>
                  )}
                </div>

                {!selectedDocument && !documentEditMode ? (
                  <div className="alert alert-secondary">Selecciona un documento para ver su detalle.</div>
                ) : documentEditMode ? (
                  <div className="card border-secondary">
                    <div className="card-body">
                      <h5>{editingDocument ? 'Editar documento' : 'Nuevo documento'}</h5>
                      <form onSubmit={handleSaveDocument}>
                        <div className="mb-3">
                          <label className="form-label">Nombre</label>
                          <input
                            type="text"
                            className="form-control"
                            value={newDocument.name}
                            onChange={(e) => handleDocumentInputChange('name', e.target.value)}
                            placeholder="Nombre del documento"
                          />
                        </div>
                        <div className="mb-3">
                          <label className="form-label">Tipo</label>
                          <select
                            className="form-select"
                            value={newDocument.type}
                            onChange={(e) => handleDocumentInputChange('type', e.target.value)}
                          >
                            <option value="texto">Texto</option>
                            <option value="archivo">Archivo</option>
                          </select>
                        </div>
                        {newDocument.type === 'archivo' ? (
                          <>
                            <div className="mb-3">
                              <label className="form-label">Archivo</label>
                              <input
                                type="file"
                                accept=".txt,.docx,.pdf"
                                className="form-control"
                                onChange={handleDocumentFileChange}
                              />
                              {documentProcessing && (
                                <div className="text-muted small mt-2">
                                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                  Extrayendo texto del archivo...
                                </div>
                              )}
                            </div>
                            <div className="mb-3">
                              <label className="form-label">Nombre de archivo</label>
                              <input
                                type="text"
                                className="form-control"
                                value={newDocument.fileName}
                                onChange={(e) => handleDocumentInputChange('fileName', e.target.value)}
                                placeholder="Ej. especificacion.pdf"
                              />
                            </div>
                            <div className="mb-3">
                              <label className="form-label">Extensión</label>
                              <input
                                type="text"
                                className="form-control"
                                value={newDocument.extension}
                                onChange={(e) => handleDocumentInputChange('extension', e.target.value)}
                                placeholder="Ej. pdf"
                              />
                            </div>
                            <div className="mb-3">
                              <label className="form-label">Descripción (opcional)</label>
                              <textarea
                                className="form-control"
                                value={newDocument.description}
                                onChange={(e) => handleDocumentInputChange('description', e.target.value)}
                                rows={3}
                                placeholder="Descripción del documento"
                              />
                            </div>
                            {newDocument.content && (
                              <div className="mb-3">
                                <label className="form-label">Texto extraído</label>
                                <textarea
                                  className="form-control"
                                  value={newDocument.content}
                                  readOnly
                                  rows={5}
                                />
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="mb-3">
                              <label className="form-label">Descripción</label>
                              <textarea
                                className="form-control"
                                value={newDocument.description}
                                onChange={(e) => handleDocumentInputChange('description', e.target.value)}
                                rows={5}
                                placeholder="Redacta o pega aquí el texto del documento"
                              />
                            </div>
                          </>
                        )}
                        <div className="d-flex gap-2">
                          <button type="submit" className="btn btn-primary">
                            {editingDocument ? 'Actualizar documento' : 'Agregar documento'}
                          </button>
                          <button type="button" className="btn btn-secondary" onClick={handleCancelDocumentEdit}>
                            Cancelar
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h4>{selectedDocument.name}</h4>
                    {selectedDocument.description && (
                      <div className="mb-3">
                        <label className="form-label fw-bold">Descripción</label>
                        <div className="border rounded p-3 bg-light" style={{ width: '100%', wordWrap: 'break-word' }}>
                          {selectedDocument.description}
                        </div>
                      </div>
                    )}
                    {selectedDocument.content && selectedDocument.type === 'archivo' && (
                      <div className="mb-3">
                        <label className="form-label fw-bold">Contenido extraído</label>
                        <div className="border rounded p-3 bg-light" style={{ width: '100%', wordWrap: 'break-word', maxHeight: '400px', overflowY: 'auto' }}>
                          {selectedDocument.content}
                        </div>
                      </div>
                    )}
                    {selectedDocument.fileName && (
                      <div className="mb-3">
                        <label className="form-label fw-bold">Archivo</label>
                        <p className="mb-0">{selectedDocument.fileName}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'scenarios' && (
        <div className="row g-4">
          <div className="col-xl-4">
            <div className="card shadow-sm h-100">
              <div className="card-body d-flex flex-column">
                <div className="mb-3">
                  <h2>Escenarios</h2>
                  <p className="text-muted mb-2">Lista y filtro por tipo y título.</p>
                  {(() => {
                    const relatedTasks = tasks.filter(t => t.targetType === 'scenario');
                    return relatedTasks.length > 0 ? (
                      <div className="mb-3">
                        <h5>Tareas pendientes relacionadas</h5>
                        <div className="overflow-x-auto" style={{ whiteSpace: 'nowrap' }}>
                          {relatedTasks.map((task) => (
                            <div key={task._id} className="d-inline-block me-2">
                              <div
                                className="card"
                                style={{ width: '250px', cursor: 'pointer' }}
                                onClick={() => {
                                  setActiveTab('tasks');
                                  setSelectedTask(task);
                                  navigate(`/project/${projectId}?tab=tasks`, { replace: true });
                                }}
                              >
                                <div className="card-body">
                                  <h6 className="card-title">Tarea {task._id.slice(-4)}</h6>
                                  <p className="card-text">{getTargetLabel(task.targetType, task.targetId)}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })()}
                  <div className="mb-3">
                    <label className="form-label">Filtrar por tipo</label>
                    <select
                      className="form-select"
                      value={scenarioTab}
                      onChange={(e) => setScenarioTab(e.target.value)}
                    >
                      {scenarioFilterOptions.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="search"
                    className="form-control"
                    placeholder="Buscar por título..."
                    value={scenarioSearch}
                    onChange={(e) => setScenarioSearch(e.target.value)}
                  />
                </div>
                <div className="list-group flex-grow-1 overflow-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
                  {filteredScenarios.length === 0 ? (
                    <div className="list-group-item">
                      No hay {scenarioTab === 'Todos' ? 'escenarios' : scenarioTab.toLowerCase()} que coincidan.
                    </div>
                  ) : (
                    filteredScenarios.map((scenario) => (
                      <button
                        type="button"
                        key={scenario._id}
                        className={`list-group-item list-group-item-action ${selectedScenario?._id === scenario._id ? 'active' : ''}`}
                        onClick={() => handleSelectScenario(scenario._id)}
                      >
                        <div className="d-flex justify-content-between align-items-start" style={{ minWidth: 0 }}>
                          <div className="me-2 flex-grow-1" style={{ minWidth: 0 }}>
                            <div className="fw-semibold text-truncate">{getScenarioLabel(scenario)}</div>
                            <div className="text-muted small text-truncate">{scenario.title}</div>
                          </div>
                          <span className="badge bg-secondary align-self-start ms-2">{scenario.type}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-8">
            <div className="card shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div>
                    <h2>{selectedScenario ? 'Detalle del escenario' : 'Crear escenario nuevo'}</h2>
                    <p className="text-muted mb-0">Selecciona un escenario para editarlo o completa el formulario para uno nuevo.</p>
                  </div>
                  {selectedScenario && canEditAsUser && (
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => {
                        setSelectedScenario(null);
                        setNewScenario({
                          type: 'Escenario',
                          title: '',
                          objective: '',
                          locationTemporal: '',
                          locationGeographic: '',
                          preconditions: '',
                          actors: '',
                          resources: '',
                          episodes: '',
                          exceptions: '',
                          order: ''
                        });
                        setMessage('Creando un nuevo escenario.');
                      }}
                    >
                      Nuevo escenario
                    </button>
                  )}
                </div>

                {selectedScenario && !scenarioEditMode ? (
                  <div className="border rounded p-3 bg-light mb-4">
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <div>
                        <h5 className="mb-2">Vista previa</h5>
                        <p className="text-muted mb-0">Revisa el escenario antes de editarlo.</p>
                      </div>
                      <div className="btn-group">
                        {canEditAsUser ? (
                          <>
                            <button className="btn btn-primary btn-sm" onClick={handleStartScenarioEdit}>
                              Editar escenario
                            </button>
                            <button className="btn btn-outline-danger btn-sm" onClick={handleDeleteScenario}>
                              Eliminar
                            </button>
                          </>
                        ) : null}
                        <button className="btn btn-outline-secondary btn-sm" onClick={() => handleCreateInspectionFromScenario(selectedScenario._id)}>
                          Reporte de inspección
                        </button>
                      </div>
                    </div>
                    <p><strong>Tipo:</strong> {selectedScenario.type}</p>
                    <p><strong>Título:</strong> {selectedScenario.title}</p>
                    <p><strong>Orden:</strong> {selectedScenario.order || 'No definido'}</p>
                    <p><strong>Objetivo:</strong> {selectedScenario.objective || 'No definido'}</p>
                    <p><strong>Ubicación temporal:</strong> {selectedScenario.locationTemporal || 'No definido'}</p>
                    <p><strong>Ubicación geográfica:</strong> {selectedScenario.locationGeographic || 'No definido'}</p>
                    <p><strong>Precondiciones:</strong></p>
                    {renderFormattedContent(selectedScenario.preconditions || 'No definidas.')}
                    <p><strong>Actores:</strong></p>
                    {renderFormattedContent(selectedScenario.actors || 'No definidos.')}
                    <p><strong>Recursos:</strong></p>
                    {renderFormattedContent(selectedScenario.resources || 'No definidos.')}
                    <p><strong>Episodios:</strong></p>
                    {renderFormattedContent(selectedScenario.episodes || 'No definidos.')}
                    <p><strong>Excepciones:</strong></p>
                    {renderFormattedContent(selectedScenario.exceptions || 'No definidas.')}
                  </div>
                ) : (
                  <>
                    <div className="row g-3 mb-3">
                      <div className="col-md-4">
                        <label className="form-label">Tipo</label>
                        <select
                          className="form-select"
                          value={selectedScenario ? selectedScenario.type : newScenario.type}
                          onChange={(e) => selectedScenario ? handleScenarioFieldChange('type', e.target.value) : setNewScenario((prev) => ({ ...prev, type: e.target.value }))}
                        >
                          {scenarioTypeOptions.map((type) => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-8">
                        <label className="form-label">Título</label>
                        <input
                          className="form-control"
                          value={selectedScenario ? selectedScenario.title : newScenario.title}
                          onChange={(e) => selectedScenario ? handleScenarioFieldChange('title', e.target.value) : setNewScenario((prev) => ({ ...prev, title: e.target.value }))}
                          placeholder="Título del escenario"
                        />
                      </div>
                    </div>

                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label className="form-label">Orden</label>
                    <input
                      className="form-control"
                      value={selectedScenario ? selectedScenario.order || '' : newScenario.order}
                      onChange={(e) => selectedScenario ? handleScenarioFieldChange('order', e.target.value) : setNewScenario((prev) => ({ ...prev, order: e.target.value }))}
                      placeholder="Ej. 1, 1.2"
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Ubicación temporal</label>
                    <input
                      className="form-control"
                      value={selectedScenario ? selectedScenario.locationTemporal || '' : newScenario.locationTemporal}
                      onChange={(e) => selectedScenario ? handleScenarioFieldChange('locationTemporal', e.target.value) : setNewScenario((prev) => ({ ...prev, locationTemporal: e.target.value }))}
                      placeholder="Ej. Inicio del proceso"
                    />
                  </div>
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label className="form-label">Ubicación geográfica</label>
                    <input
                      className="form-control"
                      value={selectedScenario ? selectedScenario.locationGeographic || '' : newScenario.locationGeographic}
                      onChange={(e) => selectedScenario ? handleScenarioFieldChange('locationGeographic', e.target.value) : setNewScenario((prev) => ({ ...prev, locationGeographic: e.target.value }))}
                      placeholder="Ej. Oficina, aplicación móvil"
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Objetivo</label>
                    <input
                      className="form-control"
                      value={selectedScenario ? selectedScenario.objective || '' : newScenario.objective}
                      onChange={(e) => selectedScenario ? handleScenarioFieldChange('objective', e.target.value) : setNewScenario((prev) => ({ ...prev, objective: e.target.value }))}
                      placeholder="Qué busca lograr este escenario"
                    />
                  </div>
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label className="form-label">Precondiciones</label>
                    <textarea
                      className="form-control"
                      rows="4"
                      value={selectedScenario ? selectedScenario.preconditions || '' : newScenario.preconditions}
                      onChange={(e) => selectedScenario ? handleScenarioFieldChange('preconditions', e.target.value) : setNewScenario((prev) => ({ ...prev, preconditions: e.target.value }))}
                      placeholder="Qué debe cumplirse antes de iniciar"
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Actores</label>
                    <textarea
                      className="form-control"
                      rows="4"
                      value={selectedScenario ? selectedScenario.actors || '' : newScenario.actors}
                      onChange={(e) => selectedScenario ? handleScenarioFieldChange('actors', e.target.value) : setNewScenario((prev) => ({ ...prev, actors: e.target.value }))}
                      placeholder="Quiénes interactúan en este escenario"
                    />
                  </div>
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label className="form-label">Recursos</label>
                    <textarea
                      className="form-control"
                      rows="4"
                      value={selectedScenario ? selectedScenario.resources || '' : newScenario.resources}
                      onChange={(e) => selectedScenario ? handleScenarioFieldChange('resources', e.target.value) : setNewScenario((prev) => ({ ...prev, resources: e.target.value }))}
                      placeholder="Materiales, sistemas o datos requeridos"
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Excepciones</label>
                    <textarea
                      className="form-control"
                      rows="4"
                      value={selectedScenario ? selectedScenario.exceptions || '' : newScenario.exceptions}
                      onChange={(e) => selectedScenario ? handleScenarioFieldChange('exceptions', e.target.value) : setNewScenario((prev) => ({ ...prev, exceptions: e.target.value }))}
                      placeholder="Rutas alternativas o errores posibles"
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <label className="form-label mb-0">Episodios</label>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => {
                        const currentValue = selectedScenario ? selectedScenario.episodes || '' : newScenario.episodes;
                        const ref = episodesRef.current;
                        if (!ref) return;
                        const start = ref.selectionStart;
                        const before = currentValue.slice(0, start);
                        const after = currentValue.slice(start);
                        const nextValue = `${before}- ${after}`;
                        if (selectedScenario) {
                          handleScenarioFieldChange('episodes', nextValue);
                        } else {
                          setNewScenario((prev) => ({ ...prev, episodes: nextValue }));
                        }
                        window.requestAnimationFrame(() => {
                          ref.focus();
                          ref.setSelectionRange(start + 2, start + 2);
                        });
                      }}
                    >
                      Añadir ítem
                    </button>
                  </div>
                  <div className="row g-2 mb-2 align-items-center">
                    <div className="col-md-6">
                      <input
                        type="search"
                        className="form-control form-control-sm"
                        placeholder="Buscar símbolo o escenario para enlazar"
                        value={linkSearchEpisode}
                        onChange={(e) => setLinkSearchEpisode(e.target.value)}
                      />
                    </div>
                    <div className="col-md-6">
                      <select
                        className="form-select form-select-sm"
                        value=""
                        onChange={(e) => {
                          if (!e.target.value) return;
                          const currentValue = selectedScenario ? selectedScenario.episodes || '' : newScenario.episodes;
                          const setter = selectedScenario ? (value) => handleScenarioFieldChange('episodes', value) : (value) => setNewScenario((prev) => ({ ...prev, episodes: value }));
                          insertLinkToItem(e.target.value, episodesRef, currentValue, setter);
                          e.target.value = '';
                        }}
                      >
                        <option value="">Enlazar símbolo o escenario</option>
                        {filteredLinkItemsEpisode.map((item) => (
                          <option key={item._id} value={item._id}>{item.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <textarea
                    ref={episodesRef}
                    className="form-control"
                    rows="6"
                    value={selectedScenario ? selectedScenario.episodes || '' : newScenario.episodes}
                    onChange={(e) => selectedScenario ? handleScenarioFieldChange('episodes', e.target.value) : setNewScenario((prev) => ({ ...prev, episodes: e.target.value }))}
                    placeholder="Describe los episodios del escenario..."
                  />
                </div>

                    <div className="d-flex gap-2 mb-4">
                      {canEditAsUser ? (
                        selectedScenario ? (
                          <>
                            <button className="btn btn-primary" onClick={handleUpdateScenario}>Guardar escenario</button>
                            <button className="btn btn-outline-secondary" onClick={handleCancelScenarioEdit}>Cancelar</button>
                            <button className="btn btn-outline-danger" onClick={handleDeleteScenario}>Eliminar escenario</button>
                          </>
                        ) : (
                          <button className="btn btn-success" onClick={handleCreateScenario}>Crear escenario</button>
                        )
                      ) : (
                        <div className="alert alert-secondary mb-0">Acceso de solo lectura. No podés crear ni editar escenarios.</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'resolve' && (
        <div className="card shadow-sm">
          <div className="card-body">
            <h2>A Resolver</h2>
            <p>Notas abiertas organizadas por fecha de creación.</p>
            <div className="mb-4">
              <label className="form-label">Nueva nota</label>
              <textarea
                className="form-control"
                value={newResolveText}
                onChange={(e) => setNewResolveText(e.target.value)}
                rows="4"
                placeholder="Describe un problema, duda o requerimiento pendiente..."
                disabled={!canEditAsUser}
              />
              <div className="mt-2 text-end">
                <button className="btn btn-primary" onClick={handleCreateResolveNote} disabled={!canEditAsUser}>
                  Agregar nota a resolver
                </button>
              </div>
              {!canEditAsUser && (
                <div className="alert alert-secondary mt-3">Acceso de solo lectura. No podés crear ni editar notas en esta sección.</div>
              )}
            </div>
            {Object.keys(groupResolveNotesByDate).length === 0 ? (
              <div className="alert alert-secondary">No hay notas pendientes.</div>
            ) : (
              Object.entries(groupResolveNotesByDate).map(([date, notes]) => (
                <div key={date} className="mb-3">
                  <h5>{date}</h5>
                  {notes.map((note) => (
                    <div key={note._id} className="card mb-2">
                      <div className="card-body">
                        <p className="card-text">{note.text}</p>
                        <div className="d-flex gap-2 flex-wrap">
                          {editingResolveNoteId === note._id ? (
                            <>
                              <textarea
                                className="form-control mb-3"
                                rows="4"
                                value={editingResolveText}
                                onChange={(e) => setEditingResolveText(e.target.value)}
                                disabled={!canEditAsUser}
                              />
                              <div className="d-flex gap-2 flex-wrap">
                                <button className="btn btn-sm btn-primary" onClick={handleSaveResolveNote} disabled={!canEditAsUser}>
                                  Guardar
                                </button>
                                <button className="btn btn-sm btn-outline-secondary" onClick={handleCancelResolveEdit}>
                                  Cancelar
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              {canEditAsUser ? (
                                <>
                                  <button className="btn btn-sm btn-success" onClick={() => handleResolveNote(note._id)}>
                                    Marcar como resuelta
                                  </button>
                                  <button className="btn btn-sm btn-outline-secondary" onClick={() => handleEditResolveNoteStart(note)}>
                                    Editar
                                  </button>
                                  <button className="btn btn-sm btn-danger" onClick={() => handleDeleteResolveNote(note._id)}>
                                    Eliminar
                                  </button>
                                </>
                              ) : (
                                <span className="text-muted">Solo lectura</span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'assistant' && (
        <div className="row gy-4">
          <div className="col-lg-8">
            <AIChat projectId={projectId} canUseAssistant={canUseAssistant} />
          </div>
          <div className="col-lg-4">
            <div className="mb-3">
              <label className="form-label">Contexto activo para Copilot</label>
              <textarea
                className="form-control"
                rows={4}
                value={copilotContextText}
                onChange={(e) => setManualCopilotContext(e.target.value)}
                placeholder="Pega texto de requisitos, símbolos o escenarios aquí para obtener sugerencias..."
              />
            </div>
            <AICopilotPanel projectId={projectId} activeText={copilotContextText} activeEntityId={copilotActiveEntityId} />
            {canEditAsAdmin && (
              <>
                <div className="mt-3">
                  <HealthMonitorPanel projectId={projectId} canRunHealth={canEditAsAdmin} />
                </div>
                <div className="mt-3">
                  <AutonomousAgentPanel projectId={projectId} canRunAgent={canEditAsAdmin} />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <ProjectUserManagement projectId={projectId} />
      )}

      {activeTab === 'about' && (
        <div className="card shadow-sm">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2>Acerca del Sistema</h2>
              <div className="d-flex gap-2 flex-wrap">
                {canEditAsAdmin ? (
                  <button
                    className="btn btn-outline-primary"
                    onClick={() => setAboutEditMode(!aboutEditMode)}
                  >
                    {aboutEditMode ? 'Cancelar' : 'Editar'}
                  </button>
                ) : null}
                <button
                  className="btn btn-success"
                  onClick={handleExportProjectJson}
                >
                  Exportar JSON
                </button>
                {!canEditAsAdmin && (
                  <span className="text-muted">Solo lectura</span>
                )}
              </div>
            </div>
            {aboutEditMode ? (
              <>
                {!canEditAsAdmin ? (
                  <div className="alert alert-secondary mb-3">Acceso de solo lectura. No podés editar la información del sistema.</div>
                ) : (
                  <>
                    <div className="mb-3">
                      <label className="form-label">Introducción</label>
                      <textarea
                        className="form-control"
                        rows="4"
                        value={aboutIntro}
                        onChange={(e) => setAboutIntro(e.target.value)}
                        placeholder="Describe el propósito y objetivos del sistema..."
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Objetivos del Sistema</label>
                      {aboutItems.map((item, index) => (
                        <div key={index} className="input-group mb-2">
                          <input
                            type="text"
                            className="form-control"
                            value={item}
                            onChange={(e) => handleAboutItemChange(index, e.target.value)}
                            placeholder="Objetivo específico..."
                          />
                          <button
                            className="btn btn-outline-danger"
                            type="button"
                            onClick={() => handleRemoveAboutItem(index)}
                          >
                            Eliminar
                          </button>
                        </div>
                      ))}
                      <button
                        className="btn btn-outline-secondary"
                        onClick={handleAddAboutItem}
                      >
                        Agregar objetivo
                      </button>
                    </div>
                    <div className="d-flex gap-2">
                      <button className="btn btn-primary" onClick={handleSaveAbout}>
                        Guardar cambios
                      </button>
                      <button className="btn btn-outline-secondary" onClick={() => setAboutEditMode(false)}>
                        Cancelar
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <p className="text-muted">{aboutIntro || 'No hay introducción definida.'}</p>
                <h5>Objetivos del Sistema</h5>
                {aboutItems.length === 0 ? (
                  <p className="text-muted">No hay objetivos definidos.</p>
                ) : (
                  <ul>
                    {aboutItems.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'requirements' && (
        <div className="row g-4">
          <div className="col-xl-4">
            <div className="card shadow-sm h-100">
              <div className="card-body d-flex flex-column">
                <div className="mb-3">
                  <h3>Requisitos</h3>
                  <p className="text-muted mb-2">Registra requisitos con descripción, fundamento y atributos de riesgo, costo y prioridad.</p>
                  {(() => {
                    const relatedTasks = tasks.filter((t) => t.targetType === 'requirement');
                    return relatedTasks.length > 0 ? (
                      <div className="mb-3">
                        <h5>Tareas pendientes relacionadas</h5>
                        <div className="overflow-x-auto" style={{ whiteSpace: 'nowrap' }}>
                          {relatedTasks.map((task) => (
                            <div key={task._id} className="d-inline-block me-2">
                              <div
                                className="card"
                                style={{ width: '250px', cursor: 'pointer' }}
                                onClick={() => {
                                  setActiveTab('tasks');
                                  setSelectedTask(task);
                                  navigate(`/project/${projectId}?tab=tasks`, { replace: true });
                                }}
                              >
                                <div className="card-body">
                                  <h6 className="card-title">Tarea {task._id.slice(-4)}</h6>
                                  <p className="card-text">{getTargetLabel(task.targetType, task.targetId)}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
                <div className="mb-4">
                  <h5>Nuevo requisito</h5>
                  <div className="mb-2">
                    <label className="form-label">Identificador</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      value={newRequirement.identifier}
                      onChange={(e) => setNewRequirement((prev) => ({ ...prev, identifier: e.target.value }))}
                      placeholder="ID o referencia interna"
                    />
                  </div>
                  <div className="mb-2">
                    <label className="form-label">Nombre</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      value={newRequirement.name}
                      onChange={(e) => setNewRequirement((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Nombre del requisito"
                    />
                  </div>
                  <div className="mb-2">
                    <label className="form-label">Tipo</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      value={newRequirement.type}
                      onChange={(e) => setNewRequirement((prev) => ({ ...prev, type: e.target.value }))}
                      placeholder="Funcional, No funcional, Regulatorio, etc."
                    />
                  </div>
                  <div className="mb-2">
                    <label className="form-label">Descripción</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={newRequirement.description}
                      onChange={(e) => setNewRequirement((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe el requisito. Usa [texto](código) para hipervínculos. Ej: [símbolo](SYM-1) o [requisito](REQ-2). Códigos: SYM-# (símbolo), SCN-# (escenario), REQ-# (requisito), TSK-# (tarea), INS-# (inspección)."
                    />
                  </div>
                  <div className="mb-2">
                    <label className="form-label">Fundamento</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={newRequirement.basis}
                      onChange={(e) => setNewRequirement((prev) => ({ ...prev, basis: e.target.value }))}
                      placeholder="Justifica por qué este requisito es necesario."
                    />
                  </div>
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label">Prioridad</label>
                      <select
                        className="form-select"
                        value={newRequirement.priority}
                        onChange={(e) => setNewRequirement((prev) => ({ ...prev, priority: e.target.value }))}
                      >
                        <option value="Alta">Alta</option>
                        <option value="Media">Media</option>
                        <option value="Baja">Baja</option>
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label">Criticidad</label>
                      <select
                        className="form-select"
                        value={newRequirement.criticidad}
                        onChange={(e) => setNewRequirement((prev) => ({ ...prev, criticidad: e.target.value }))}
                      >
                        <option value="Alta">Alta</option>
                        <option value="Media">Media</option>
                        <option value="Baja">Baja</option>
                      </select>
                    </div>
                  </div>
                  <div className="row g-2 mt-2">
                    <div className="col-6">
                      <label className="form-label">Costo de implementación</label>
                      <select
                        className="form-select"
                        value={newRequirement.costoImplementacion}
                        onChange={(e) => setNewRequirement((prev) => ({ ...prev, costoImplementacion: e.target.value }))}
                      >
                        <option value="Alto">Alto</option>
                        <option value="Medio">Medio</option>
                        <option value="Bajo">Bajo</option>
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label">Volatilidad</label>
                      <select
                        className="form-select"
                        value={newRequirement.volatilidad}
                        onChange={(e) => setNewRequirement((prev) => ({ ...prev, volatilidad: e.target.value }))}
                      >
                        <option value="Alta">Alta</option>
                        <option value="Media">Media</option>
                        <option value="Baja">Baja</option>
                      </select>
                    </div>
                  </div>
                  <div className="row g-2 mt-2">
                    <div className="col-6">
                      <label className="form-label">Factibilidad</label>
                      <select
                        className="form-select"
                        value={newRequirement.factibilidad}
                        onChange={(e) => setNewRequirement((prev) => ({ ...prev, factibilidad: e.target.value }))}
                      >
                        <option value="Alta">Alta</option>
                        <option value="Media">Media</option>
                        <option value="Baja">Baja</option>
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label">Riesgo</label>
                      <select
                        className="form-select"
                        value={newRequirement.riesgo}
                        onChange={(e) => setNewRequirement((prev) => ({ ...prev, riesgo: e.target.value }))}
                      >
                        <option value="Alto">Alto</option>
                        <option value="Medio">Medio</option>
                        <option value="Bajo">Bajo</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-3 text-end">
                    <button className="btn btn-primary" onClick={handleCreateRequirement} disabled={!canEditAsUser}>
                      Agregar requisito
                    </button>
                  </div>
                  {!canEditAsUser && (
                    <div className="alert alert-secondary mt-3">Acceso de solo lectura. No podés crear ni editar requisitos.</div>
                  )}
                </div>
                <div className="list-group flex-grow-1 overflow-auto" style={{ maxHeight: 'calc(100vh - 620px)' }}>
                  {requirements.length === 0 ? (
                    <div className="list-group-item">No hay requisitos definidos.</div>
                  ) : (
                    requirements.map((requirement) => (
                      <button
                        type="button"
                        key={requirement._id}
                        className={`list-group-item list-group-item-action ${selectedRequirement?._id === requirement._id ? 'active' : ''}`}
                        onClick={() => handleSelectRequirement(requirement._id)}
                      >
                        <div className="d-flex justify-content-between align-items-start">
                          <div className="me-2 flex-grow-1">
                            <div className="fw-semibold text-truncate">{requirement.identifier || requirement.name || 'Requisito'}</div>
                            <div className="text-muted small text-truncate">{requirement.type || 'Tipo no definido'}</div>
                          </div>
                          <span className={`badge ${requirement.priority === 'Alta' ? 'bg-danger' : requirement.priority === 'Media' ? 'bg-warning text-dark' : 'bg-secondary'}`}>
                            {requirement.priority}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-8">
            <div className="card shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h3>Detalle de requisito</h3>
                    <p className="text-muted">Selecciona un requisito para revisar o editar sus atributos.</p>
                  </div>
                  {selectedRequirement && !requirementEditMode && canEditAsUser && (
                    <button className="btn btn-primary btn-sm" onClick={handleStartRequirementEdit}>
                      Editar
                    </button>
                  )}
                </div>
                {!selectedRequirement ? (
                  <div className="alert alert-secondary">Selecciona un requisito para ver sus detalles.</div>
                ) : requirementEditMode ? (
                  <>
                    <div className="row g-3 mb-3">
                      <div className="col-md-6">
                        <label className="form-label">Identificador</label>
                        <textarea
                          className="form-control"
                          rows="2"
                          value={editingRequirement.identifier}
                          onChange={(e) => setEditingRequirement((prev) => ({ ...prev, identifier: e.target.value }))}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Nombre</label>
                        <textarea
                          className="form-control"
                          rows="2"
                          value={editingRequirement.name}
                          onChange={(e) => setEditingRequirement((prev) => ({ ...prev, name: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Tipo</label>
                      <textarea
                        className="form-control"
                        rows="2"
                        value={editingRequirement.type}
                        onChange={(e) => setEditingRequirement((prev) => ({ ...prev, type: e.target.value }))}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Descripción</label>
                      <textarea
                        className="form-control"
                        rows="3"
                        value={editingRequirement.description}
                        onChange={(e) => setEditingRequirement((prev) => ({ ...prev, description: e.target.value }))}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Fundamento</label>
                      <textarea
                        className="form-control"
                        rows="3"
                        value={editingRequirement.basis}
                        onChange={(e) => setEditingRequirement((prev) => ({ ...prev, basis: e.target.value }))}
                      />
                    </div>
                    <div className="row g-2">
                      <div className="col-md-4">
                        <label className="form-label">Prioridad</label>
                        <select
                          className="form-select"
                          value={editingRequirement.priority}
                          onChange={(e) => setEditingRequirement((prev) => ({ ...prev, priority: e.target.value }))}
                        >
                          <option value="Alta">Alta</option>
                          <option value="Media">Media</option>
                          <option value="Baja">Baja</option>
                        </select>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Criticidad</label>
                        <select
                          className="form-select"
                          value={editingRequirement.criticidad}
                          onChange={(e) => setEditingRequirement((prev) => ({ ...prev, criticidad: e.target.value }))}
                        >
                          <option value="Alta">Alta</option>
                          <option value="Media">Media</option>
                          <option value="Baja">Baja</option>
                        </select>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Costo de implementación</label>
                        <select
                          className="form-select"
                          value={editingRequirement.costoImplementacion}
                          onChange={(e) => setEditingRequirement((prev) => ({ ...prev, costoImplementacion: e.target.value }))}
                        >
                          <option value="Alto">Alto</option>
                          <option value="Medio">Medio</option>
                          <option value="Bajo">Bajo</option>
                        </select>
                      </div>
                    </div>
                    <div className="row g-2 mt-3">
                      <div className="col-md-4">
                        <label className="form-label">Volatilidad</label>
                        <select
                          className="form-select"
                          value={editingRequirement.volatilidad}
                          onChange={(e) => setEditingRequirement((prev) => ({ ...prev, volatilidad: e.target.value }))}
                        >
                          <option value="Alta">Alta</option>
                          <option value="Media">Media</option>
                          <option value="Baja">Baja</option>
                        </select>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Factibilidad</label>
                        <select
                          className="form-select"
                          value={editingRequirement.factibilidad}
                          onChange={(e) => setEditingRequirement((prev) => ({ ...prev, factibilidad: e.target.value }))}
                        >
                          <option value="Alta">Alta</option>
                          <option value="Media">Media</option>
                          <option value="Baja">Baja</option>
                        </select>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Riesgo</label>
                        <select
                          className="form-select"
                          value={editingRequirement.riesgo}
                          onChange={(e) => setEditingRequirement((prev) => ({ ...prev, riesgo: e.target.value }))}
                        >
                          <option value="Alto">Alto</option>
                          <option value="Medio">Medio</option>
                          <option value="Bajo">Bajo</option>
                        </select>
                      </div>
                    </div>
                    <div className="d-flex gap-2 mt-4">
                      <button className="btn btn-primary" onClick={handleSaveRequirement}>
                        Guardar cambios
                      </button>
                      <button className="btn btn-outline-secondary" onClick={handleCancelRequirementEdit}>
                        Cancelar
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <p className="mb-1"><strong>Identificador</strong></p>
                        <p>{selectedRequirement.identifier || 'No definido'}</p>
                      </div>
                      <div className="col-md-6">
                        <p className="mb-1"><strong>Tipo</strong></p>
                        <p>{selectedRequirement.type || 'No definido'}</p>
                      </div>
                    </div>
                    <div className="row g-3">
                      <div className="col-md-4">
                        <p className="mb-1"><strong>Prioridad</strong></p>
                        <p>{selectedRequirement.priority}</p>
                      </div>
                      <div className="col-md-4">
                        <p className="mb-1"><strong>Criticidad</strong></p>
                        <p>{selectedRequirement.criticidad}</p>
                      </div>
                      <div className="col-md-4">
                        <p className="mb-1"><strong>Costo</strong></p>
                        <p>{selectedRequirement.costoImplementacion}</p>
                      </div>
                    </div>
                    <div className="row g-3">
                      <div className="col-md-4">
                        <p className="mb-1"><strong>Volatilidad</strong></p>
                        <p>{selectedRequirement.volatilidad}</p>
                      </div>
                      <div className="col-md-4">
                        <p className="mb-1"><strong>Factibilidad</strong></p>
                        <p>{selectedRequirement.factibilidad}</p>
                      </div>
                      <div className="col-md-4">
                        <p className="mb-1"><strong>Riesgo</strong></p>
                        <p>{selectedRequirement.riesgo}</p>
                      </div>
                    </div>
                    <div className="mb-3">
                      <p className="mb-1"><strong>Descripción</strong></p>
                      <div className="border rounded p-3 bg-light">
                        {renderFormattedContent(selectedRequirement.description || 'No hay descripción.')}
                      </div>
                    </div>
                    <div className="mb-3">
                      <p className="mb-1"><strong>Fundamento</strong></p>
                      <div className="border rounded p-3 bg-light">
                        {renderFormattedContent(selectedRequirement.basis || 'No hay fundamento.')}
                      </div>
                    </div>
                    <div className="d-flex gap-2 flex-wrap">
                      {canEditAsUser ? (
                        <>
                          <button className="btn btn-outline-secondary" onClick={handleStartRequirementEdit}>
                            Editar
                          </button>
                          <button className="btn btn-danger" onClick={() => handleDeleteRequirement(selectedRequirement._id)}>
                            Eliminar
                          </button>
                        </>
                      ) : (
                        <span className="text-muted">Solo lectura</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="row g-4">
          <div className="col-xl-4">
            <div className="card shadow-sm h-100">
              <div className="card-body d-flex flex-column">
                <div className="mb-3">
                  <h3>Tareas Pendientes</h3>
                  <p className="text-muted mb-2">Lista de tareas por prioridad.</p>
                  <div className="mb-3">
                    <label className="form-label">Buscar tareas</label>
                    <input
                      type="search"
                      className="form-control"
                      placeholder="Buscar por descripción..."
                    />
                  </div>
                  <div className="mb-4">
                    {canManageTasks ? (
                      <>
                        <h5>Nueva tarea</h5>
                        <div className="row g-3">
                          <div className="col-12">
                            <label className="form-label">Descripción</label>
                            <textarea
                              className="form-control"
                              rows="3"
                              value={taskDescription}
                              onChange={(e) => setTaskDescription(e.target.value)}
                              placeholder="Describe la tarea. Usa [texto](código) para hipervínculos. Ej: [símbolo](SYM-1). Códigos: SYM-#, SCN-#, REQ-#, TSK-#, INS-#"
                            />
                          </div>
                          <div className="col-md-6">
                            <label className="form-label">Prioridad</label>
                            <select
                              className="form-select"
                              value={taskPriority}
                              onChange={(e) => setTaskPriority(parseInt(e.target.value))}
                            >
                              <option value={1}>Alta</option>
                              <option value={2}>Media</option>
                              <option value={3}>Baja</option>
                            </select>
                          </div>
                          <div className="col-md-6">
                            <label className="form-label">Elemento asociado</label>
                            <select
                              className="form-select"
                              value={`${taskTargetType}:${taskTargetId}`}
                              onChange={(e) => {
                                const [type, id] = e.target.value.split(':');
                                setTaskTargetType(type);
                                setTaskTargetId(id);
                              }}
                        >
                          <option value="">Seleccionar...</option>
                          {symbols.map((symbol) => (
                            <option key={`symbol:${symbol._id}`} value={`symbol:${symbol._id}`}>
                              Símbolo: {symbol.name}
                            </option>
                          ))}
                          {scenarios.map((scenario) => (
                            <option key={`scenario:${scenario._id}`} value={`scenario:${scenario._id}`}>
                              Escenario: {scenario.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="text-end">
                      <button className="btn btn-primary" onClick={handleCreateTask} disabled={!canManageTasks}>
                        Agregar tarea
                      </button>
                    </div>
                    </>
                    ) : (
                      <div className="alert alert-secondary">Solo administradores pueden crear o editar tareas.</div>
                    )}
                  </div>
                </div>
                <div className="list-group flex-grow-1 overflow-auto" style={{ maxHeight: 'calc(100vh - 500px)' }}>
                  {tasks
                    .sort((a, b) => a.priority - b.priority)
                    .map((task) => (
                      <button
                        type="button"
                        key={task._id}
                        className={`list-group-item list-group-item-action ${selectedTask?._id === task._id ? 'active' : ''}`}
                        onClick={() => setSelectedTask(task)}
                      >
                        <div className="d-flex justify-content-between align-items-start">
                          <div className="flex-grow-1">
                            <div className="d-flex align-items-center gap-2 mb-2">
                              <span className={`badge ${task.priority === 1 ? 'bg-danger' : task.priority === 2 ? 'bg-warning text-dark' : 'bg-info'}`}>
                                {task.priority === 1 ? 'Alta' : task.priority === 2 ? 'Media' : 'Baja'}
                              </span>
                              <small className="text-muted">
                                Asociado a:{' '}
                                <button
                                  type="button"
                                  className="btn btn-link btn-sm p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectItem(task.targetId);
                                  }}
                                >
                                  {getTargetLabel(task.targetType, task.targetId)}
                                </button>
                              </small>
                            </div>
                            <p className="mb-0">{task.description}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-8">
            <div className="card shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h3>Detalle de la tarea</h3>
                    <p className="text-muted">Revisa y completa la tarea seleccionada.</p>
                  </div>
                  {selectedTask && canEditAsUser ? (
                    <button className="btn btn-success" onClick={() => handleDeleteTask(selectedTask._id)}>
                      Marcar como completada
                    </button>
                  ) : selectedTask ? (
                    <span className="text-muted">Solo lectura</span>
                  ) : null}
                </div>

                {!selectedTask ? (
                  <div className="alert alert-secondary">Selecciona una tarea para ver su detalle.</div>
                ) : taskEditMode ? (
                  <>
                    {!canManageTasks ? (
                      <div className="alert alert-secondary">Solo administradores pueden editar tareas.</div>
                    ) : (
                      <>
                        <div className="mb-3">
                          <label className="form-label">Descripción</label>
                          <textarea
                            className="form-control"
                            rows="3"
                            value={taskEditDescription}
                            onChange={(e) => setTaskEditDescription(e.target.value)}
                            placeholder="Describe la tarea. Usa [texto](código) para hipervínculos. Ej: [símbolo](SYM-1). Códigos: SYM-#, SCN-#, REQ-#, TSK-#, INS-#"
                          />
                        </div>
                        <div className="row g-3 mb-3">
                          <div className="col-md-6">
                            <label className="form-label">Prioridad</label>
                            <select
                              className="form-select"
                              value={taskEditPriority}
                              onChange={(e) => setTaskEditPriority(parseInt(e.target.value))}
                            >
                              <option value={1}>Alta</option>
                              <option value={2}>Media</option>
                              <option value={3}>Baja</option>
                            </select>
                          </div>
                          <div className="col-md-6">
                            <label className="form-label">Elemento asociado</label>
                            <select
                              className="form-select"
                              value={`${taskEditTargetType}:${taskEditTargetId}`}
                              onChange={(e) => {
                                const [type, id] = e.target.value.split(':');
                                setTaskEditTargetType(type);
                                setTaskEditTargetId(id);
                              }}
                            >
                              <option value="">Seleccionar...</option>
                              {symbols.map((symbol) => (
                                <option key={`symbol:${symbol._id}`} value={`symbol:${symbol._id}`}>
                                  Símbolo: {symbol.name}
                                </option>
                              ))}
                              {scenarios.map((scenario) => (
                                <option key={`scenario:${scenario._id}`} value={`scenario:${scenario._id}`}>
                                  Escenario: {scenario.title}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="d-flex gap-2">
                          <button className="btn btn-primary" onClick={handleSaveTask}>Guardar cambios</button>
                          <button className="btn btn-outline-secondary" onClick={handleCancelTaskEdit}>Cancelar</button>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div>
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <div>
                        <p><strong>Descripción:</strong> {selectedTask.description}</p>
                        <p><strong>Prioridad:</strong> {selectedTask.priority === 1 ? 'Alta' : selectedTask.priority === 2 ? 'Media' : 'Baja'}</p>
                        <p>
                          <strong>Elemento asociado:</strong>{' '}
                          <button
                            type="button"
                            className="btn btn-link p-0"
                            onClick={() => handleSelectItem(selectedTask.targetId)}
                          >
                            {getTargetLabel(selectedTask.targetType, selectedTask.targetId)}
                          </button>
                        </p>
                      </div>
                        {canManageTasks ? (
                          <button className="btn btn-primary btn-sm" onClick={handleStartTaskEdit}>
                            Editar
                          </button>
                        ) : (
                          <span className="text-muted">Solo lectura</span>
                        )}
                      </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'inspection' && (
        <div className="card shadow-sm">
          <div className="card-body">
            <h2>Inspección</h2>
            <p className="text-muted">Reportes de inspección por stakeholders sobre símbolos y escenarios.</p>
            <div className="mb-4">
              <h5>Nuevo reporte de inspección</h5>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Aspecto</label>
                  <input
                    type="text"
                    className="form-control"
                    value={inspectionAspect}
                    onChange={(e) => setInspectionAspect(e.target.value)}
                    placeholder="Ej. Claridad, Consistencia..."
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Elemento asociado</label>
                  <select
                    className="form-select"
                    value={`${inspectionTargetType}:${inspectionTargetId}`}
                    onChange={(e) => {
                      const [type, id] = e.target.value.split(':');
                      setInspectionTargetType(type);
                      setInspectionTargetId(id);
                    }}
                  >
                    <option value="">Seleccionar...</option>
                    {symbols.map((symbol) => (
                      <option key={`symbol:${symbol._id}`} value={`symbol:${symbol._id}`}>
                        Símbolo: {symbol.name}
                      </option>
                    ))}
                    {scenarios.map((scenario) => (
                      <option key={`scenario:${scenario._id}`} value={`scenario:${scenario._id}`}>
                        Escenario: {scenario.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label">Descripción</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={inspectionDescription}
                    onChange={(e) => setInspectionDescription(e.target.value)}
                    placeholder="Describe el hallazgo o comentario. Usa [texto](código) para hipervínculos. Ej: [símbolo](SYM-1). Códigos: SYM-#, SCN-#, REQ-#, TSK-#, INS-#"
                  />
                </div>
              </div>
              <div className="mt-3 text-end">
                <button className="btn btn-primary" onClick={handleCreateInspection} disabled={!canEditAsAdmin}>
                  Agregar reporte
                </button>
              </div>
              {!canEditAsAdmin && (
                <div className="alert alert-secondary mt-3">Acceso de solo lectura. No podés crear ni editar reportes de inspección.</div>
              )}
            </div>
            {inspections.length === 0 ? (
              <div className="alert alert-secondary">No hay reportes de inspección.</div>
            ) : (
              Object.entries(groupInspectionsByDate).map(([date, dateInspections]) => (
                <div key={date} className="mb-4">
                  <h5>{date}</h5>
                  {dateInspections.map((inspection) => (
                    <div key={inspection._id} className="card mb-2">
                      <div className="card-body">
                        {editingInspectionId === inspection._id ? (
                          <>
                            <div className="mb-3">
                              <label className="form-label">Aspecto</label>
                              <input
                                type="text"
                                className="form-control"
                                value={inspectionEditAspect}
                                onChange={(e) => setInspectionEditAspect(e.target.value)}
                                placeholder="Ej. Claridad, Consistencia..."
                              />
                            </div>
                            <div className="mb-3">
                              <label className="form-label">Descripción</label>
                              <textarea
                                className="form-control"
                                rows="3"
                                value={inspectionEditDescription}
                                onChange={(e) => setInspectionEditDescription(e.target.value)}
                                placeholder="Describe el hallazgo o comentario. Usa [texto](código) para hipervínculos. Ej: [símbolo](SYM-1). Códigos: SYM-#, SCN-#, REQ-#, TSK-#, INS-#"
                              />
                            </div>
                            <div className="d-flex gap-2">
                              <button className="btn btn-sm btn-primary" onClick={handleSaveInspection}>
                                Guardar
                              </button>
                              <button className="btn btn-sm btn-outline-secondary" onClick={handleCancelInspectionEdit}>
                                Cancelar
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="d-flex justify-content-between align-items-start mb-2">
                              <div>
                                <div className="d-flex align-items-center gap-2 mb-2">
                                  <strong>{inspection.aspect}</strong>
                                  <small className="text-muted">
                                    Asociado a:{' '}
                                    <button
                                      type="button"
                                      className="btn btn-link btn-sm p-0"
                                      onClick={() => handleSelectItem(inspection.targetId)}
                                    >
                                      {getTargetLabel(inspection.targetType, inspection.targetId)}
                                    </button>
                                  </small>
                                </div>
                                <p className="mb-0">{inspection.description}</p>
                              </div>
                            </div>
                            <div className="d-flex gap-2">
                              {canEditAsAdmin ? (
                                <>
                                  <button className="btn btn-sm btn-outline-secondary" onClick={() => handleStartInspectionEdit(inspection)}>
                                    Editar
                                  </button>
                                  <button className="btn btn-sm btn-success" onClick={() => handleDeleteInspection(inspection._id)}>
                                    Marcar como resuelta
                                  </button>
                                </>
                              ) : (
                                <span className="text-muted small">Solo lectura</span>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'map' && (
        <div className="card shadow-sm">
          <div className="card-body">
            <h2>Mapa de relaciones <small className="text-muted">({symbols.length})</small></h2>
            <p>Visualización jerárquica de símbolos según su origen.</p>
            {canEditAsAdmin && (
              <div className="border rounded p-3 mb-4 bg-light">
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-start gap-3">
                  <div>
                    <h5 className="mb-1">Administrar grafo y embeddings</h5>
                    {embeddingStats.totalSymbols || embeddingStats.totalRequirements ? (
                      <>
                        <div className="mb-2">
                          <span className="badge bg-danger me-2">{embeddingStats.missingSymbols} símbolos sin embedding</span>
                          <span className="badge bg-danger">{embeddingStats.missingRequirements} requisitos sin embedding</span>
                        </div>
                        {embeddingStats.missingSymbols + embeddingStats.missingRequirements === 0 ? (
                          <p className="mb-0 text-success">Todos los embeddings están presentes.</p>
                        ) : (
                          <p className="mb-0 text-muted">Regenera solo los embeddings faltantes, o fuerza la regeneración completa si necesitas limpiar datos antiguos.</p>
                        )}
                      </>
                    ) : (
                      <p className="mb-1 text-muted">Carga el proyecto para ver el estado de embeddings.</p>
                    )}
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      onClick={handleRegenerateEmbeddings}
                      disabled={graphActionLoading}
                    >
                      {graphActionLoading ? 'Procesando...' : 'Regenerar embeddings faltantes'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-danger"
                      onClick={handleForceRegenerateEmbeddings}
                      disabled={graphActionLoading}
                    >
                      {graphActionLoading ? 'Procesando...' : 'Forzar regenerar todo'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleGenerateGraph}
                      disabled={graphActionLoading}
                    >
                      {graphActionLoading ? 'Procesando...' : 'Generar grafo semántico'}
                    </button>
                  </div>
                </div>
                {graphActionMessage && (
                  <div className="alert alert-info mt-3 mb-0">{graphActionMessage}</div>
                )}
              </div>
            )}
            <RelationMap symbols={symbols} />
          </div>
        </div>
      )}

      {activeTab === 'symbols' && (
        <div className="row g-4">
          <div className="col-xl-4">
            <div className="card shadow-sm h-100">
              <div className="card-body">
                <h3>Lista de símbolos</h3>
                <div className="mb-3">
                  <label className="form-label">Buscar símbolos</label>
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="form-control"
                    placeholder="Buscar por nombre o tipo..."
                  />
                </div>
                {(() => {
                  const relatedTasks = tasks.filter(t => t.targetType === 'symbol');
                  return relatedTasks.length > 0 ? (
                    <div className="mb-3">
                      <h5>Tareas pendientes relacionadas</h5>
                      <div className="overflow-x-auto" style={{ whiteSpace: 'nowrap' }}>
                        {relatedTasks.map((task) => (
                          <div key={task._id} className="d-inline-block me-2">
                            <div
                              className="card"
                              style={{ width: '250px', cursor: 'pointer' }}
                              onClick={() => {
                                setActiveTab('tasks');
                                setSelectedTask(task);
                                navigate(`/project/${projectId}?tab=tasks`, { replace: true });
                              }}
                            >
                              <div className="card-body">
                                <h6 className="card-title">Tarea {task._id.slice(-4)}</h6>
                                <p className="card-text">{getTargetLabel(task.targetType, task.targetId)}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}
                <div className="list-group"> 
                  {filteredSymbols.length === 0 ? (
                    <div className="list-group-item">No se encontraron símbolos.</div>
                  ) : (
                    filteredSymbols.map((symbol) => (
                      <button
                        type="button"
                        key={symbol._id}
                        onClick={() => handleSelect(symbol._id)}
                        className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${selectedSymbol?._id === symbol._id ? 'active' : ''}`}
                      >
                        <div>
                          <div>{getSymbolLabel(symbol)}</div>
                          <div className="mt-1">
                            <span className="badge bg-primary me-2">{symbol.type}</span>
                            {symbol.isSeed === true && <small className="badge bg-secondary me-2">Semilla</small>}
                            {symbol.parentSymbol && <small className="badge bg-info text-dark">Derivado</small>}
                          </div>
                        </div>
                        <span className={`badge ${getStatusBadgeClass(symbol.status)}`}>
                          {statusOptions.find((option) => option.value === symbol.status)?.label || 'Incompleto'}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-8">
            <div className="card shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <div>
                    <h3>Detalle del símbolo</h3>
                    <p className="text-muted">Edita atributos y añade símbolos derivados.</p>
                  </div>
                  {selectedSymbol && (
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <span className={`badge py-2 ${getStatusBadgeClass(selectedSymbol.status)}`}>
                        {statusOptions.find((option) => option.value === selectedSymbol.status)?.label || 'Incompleto'}
                      </span>
                      {selectedSymbol.isSeed === true && (
                        <span className="badge bg-secondary py-2">Semilla</span>
                      )}
                      {selectedSymbol.parentSymbol && (
                        <span className="badge bg-info text-dark py-2">Derivado</span>
                      )}
                    </div>
                  )}
                </div>

                {!selectedSymbol ? (
                  <div className="alert alert-secondary">Selecciona un símbolo para ver su detalle.</div>
                ) : (
                  <>
                    {symbolEditMode ? (
                      <>
                        {!canEditAsUser ? (
                          <div className="alert alert-secondary mb-3">Acceso de solo lectura. No podés editar símbolos.</div>
                        ) : (
                          <>
                            <div className="mb-3">
                              <label className="form-label">Nombre</label>
                              <input
                                value={selectedSymbol.name}
                                onChange={(e) => handleUpdateField('name', e.target.value)}
                                className="form-control"
                                placeholder="Nombre del símbolo"
                              />
                        </div>
                        <div className="row g-3">
                          <div className="col-md-6">
                            <label className="form-label">Tipo</label>
                            <select
                              className="form-select"
                              value={selectedSymbol.type || typeOptions[0]}
                              onChange={(e) => handleUpdateField('type', e.target.value)}
                            >
                              {typeOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="col-md-6">
                            <label className="form-label">Numeración</label>
                            <input
                              className="form-control"
                              value={selectedSymbol.order || ''}
                              onChange={(e) => handleUpdateField('order', e.target.value)}
                              placeholder="Ej. 1, 1.2, 2.1"
                            />
                          </div>
                        </div>
                        <div className="mb-3">
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <label className="form-label mb-0">Noción</label>
                            <div className="btn-group btn-group-sm">
                              <button type="button" className="btn btn-outline-primary" onClick={() => setEditingNotion(true)}>
                                Editar
                              </button>
                              {editingNotion && (
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary"
                                  onClick={() => {
                                    if (window.confirm('¿Deseas borrar todo el contenido de Noción?')) {
                                      setNotionEdit('');
                                    }
                                  }}
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                          </div>
                          {editingNotion ? (
                            <>
                              <div className="mb-2">
                                <button type="button" className="btn btn-sm btn-outline-secondary me-2" onClick={() => addListItem(notionRef, notionEdit, setNotionEdit)}>
                                  Ítem
                                </button>
                                <div className="d-flex gap-2 flex-column flex-md-row align-items-start">
                                  <input
                                    type="search"
                                    className="form-control form-control-sm"
                                    placeholder="Buscar símbolo..."
                                    value={linkSearchNotion}
                                    onChange={(e) => setLinkSearchNotion(e.target.value)}
                                  />
                                  <select
                                    className="form-select form-select-sm w-auto"
                                    value=""
                                    onChange={(e) => {
                                      if (!e.target.value) return;
                                      insertLinkToSymbol(e.target.value, notionRef, notionEdit, setNotionEdit);
                                      e.target.value = '';
                                    }}
                                  >
                                    <option value="">Seleccionar símbolo</option>
                                    {filteredLinkSymbolsNotion.map((symbol) => (
                                      <option key={symbol._id} value={symbol._id}>
                                        {symbol.displayLabel}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <textarea
                                ref={notionRef}
                                value={notionEdit}
                                onChange={(e) => setNotionEdit(e.target.value)}
                                className="form-control"
                                rows="5"
                                placeholder="Describir la noción del símbolo"
                              />
                            </>
                          ) : (
                            <div className="border rounded p-3 bg-light" style={{ minHeight: '120px' }}>
                              {renderFormattedContent(selectedSymbol.notion || 'No hay noción definida.')}
                            </div>
                          )}
                        </div>
                        <div className="mb-3">
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <label className="form-label mb-0">Impacto</label>
                            <div className="btn-group btn-group-sm">
                              <button type="button" className="btn btn-outline-primary" onClick={() => setEditingImpact(true)}>
                                Editar
                              </button>
                              {editingImpact && (
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary"
                                  onClick={() => {
                                    if (window.confirm('¿Deseas borrar todo el contenido de Impacto?')) {
                                      setImpactEdit('');
                                    }
                                  }}
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                          </div>
                          {editingImpact ? (
                            <>
                              <div className="mb-2">
                                <button type="button" className="btn btn-sm btn-outline-secondary me-2" onClick={() => addListItem(impactRef, impactEdit, setImpactEdit)}>
                                  Ítem
                                </button>
                                <div className="d-flex gap-2 flex-column flex-md-row align-items-start">
                                  <input
                                    type="search"
                                    className="form-control form-control-sm"
                                    placeholder="Buscar símbolo..."
                                    value={linkSearchImpact}
                                    onChange={(e) => setLinkSearchImpact(e.target.value)}
                                  />
                                  <select
                                    className="form-select form-select-sm w-auto"
                                    value=""
                                    onChange={(e) => {
                                      if (!e.target.value) return;
                                      insertLinkToSymbol(e.target.value, impactRef, impactEdit, setImpactEdit);
                                      e.target.value = '';
                                    }}
                                  >
                                    <option value="">Seleccionar símbolo</option>
                                    {filteredLinkSymbolsImpact.map((symbol) => (
                                      <option key={symbol._id} value={symbol._id}>
                                        {symbol.displayLabel}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <textarea
                                ref={impactRef}
                                value={impactEdit}
                                onChange={(e) => setImpactEdit(e.target.value)}
                                className="form-control"
                                rows="5"
                                placeholder="Describir cómo impacta este símbolo"
                              />
                            </>
                          ) : (
                            <div className="border rounded p-3 bg-light" style={{ minHeight: '120px' }}>
                              {renderFormattedContent(selectedSymbol.impact || 'No hay impacto definido.')}
                            </div>
                          )}
                        </div>
                        <div className="mb-3">
                          <label className="form-label">Jerarquía de derivación</label>
                          <select
                            className="form-select"
                            value={selectedSymbol.parentSymbol || ''}
                            onChange={(e) => {
                              const parentValue = e.target.value || null;
                              handleUpdateField('parentSymbol', parentValue);
                              handleUpdateField('isSeed', parentValue ? false : true);
                            }}
                          >
                            <option value="">Ninguno (Símbolo Semilla)</option>
                            {availableParentSymbols.map((symbol) => (
                              <option key={symbol._id} value={symbol._id}>
                                {symbol.name} {symbol.isSeed ? '(Semilla)' : '(Derivado)'}
                              </option>
                            ))}
                          </select>
                          <div className="form-text">Selecciona un nuevo padre para este símbolo.</div>
                        </div>
                        <div className="mb-3">
                          <label className="form-label">Estado</label>
                          <select
                            className="form-select"
                            value={selectedSymbol.status || 'incomplete'}
                            onChange={(e) => handleUpdateField('status', e.target.value)}
                          >
                            {statusOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="mb-3">
                          <label className="form-label">Notas de revisión</label>
                          <textarea
                            className="form-control"
                            value={selectedSymbol.reviewNotes || ''}
                            onChange={(e) => handleUpdateField('reviewNotes', e.target.value)}
                            rows="4"
                            placeholder="Comentarios, hallazgos o solicitudes de revisión"
                          />
                        </div>
                        <div className="d-flex gap-2 mb-4">
                          {canEditAsUser ? (
                            <>
                              <button className="btn btn-primary" onClick={handleSave}>
                                Guardar cambios
                              </button>
                              <button className="btn btn-outline-secondary" onClick={handleCancelSymbolEdit}>
                                Cancelar
                              </button>
                              <button className="btn btn-outline-danger" onClick={handleDeleteSymbol}>
                                Eliminar símbolo
                              </button>
                            </>
                          ) : (
                            <span className="text-muted">Solo lectura</span>
                          )}
                        </div>
                          </>
                        )}
                      </>
                    ) : (
                      <div className="border rounded p-3 bg-light mb-4">
                        <div className="d-flex justify-content-between align-items-start mb-3">
                          <div>
                            <h5 className="mb-2">Vista previa</h5>
                            <p className="text-muted mb-0">Revisa el símbolo antes de editarlo.</p>
                          </div>
                          <div className="btn-group">
                            {canEditAsUser ? (
                              <button className="btn btn-primary btn-sm" onClick={handleStartSymbolEdit}>
                                Editar
                              </button>
                            ) : null}
                            <button
                              className="btn btn-outline-secondary btn-sm"
                              onClick={() => {
                                setInspectionTargetType('symbol');
                                setInspectionTargetId(selectedSymbol._id);
                                setActiveTab('inspection');
                              }}
                            >
                              Reporte de inspección
                            </button>
                            {canEditAsUser ? (
                              <button className="btn btn-outline-danger btn-sm" onClick={handleDeleteSymbol}>
                                Eliminar
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <p><strong>Tipo:</strong> {selectedSymbol.type}</p>
                        <p><strong>Nombre:</strong> {selectedSymbol.name}</p>
                        <p><strong>Numeración:</strong> {selectedSymbol.order || 'No definido'}</p>
                        <p><strong>Estado:</strong> {statusOptions.find((option) => option.value === selectedSymbol.status)?.label || 'Incompleto'}</p>
                        <p><strong>Noción:</strong></p>
                        {renderFormattedContent(selectedSymbol.notion || 'No hay noción definida.')}
                        <p><strong>Impacto:</strong></p>
                        {renderFormattedContent(selectedSymbol.impact || 'No hay impacto definido.')}
                        <p><strong>Notas de revisión:</strong></p>
                        {renderFormattedContent(selectedSymbol.reviewNotes || 'No hay notas de revisión.')}
                      </div>
                    )}
                    <div className="border-top pt-4">
                      {canEditAsUser ? (
                        <>
                          <h5 className="mb-3">Añadir símbolo semilla</h5>
                          <div className="row g-3 align-items-end mb-4">
                            <div className="col-md-6">
                              <label className="form-label">Nombre del símbolo semilla</label>
                              <input
                                value={newSeedSymbol.name}
                                onChange={(e) => setNewSeedSymbol((prev) => ({ ...prev, name: e.target.value }))}
                                className="form-control"
                                placeholder="Ej. X"
                              />
                            </div>
                            <div className="col-md-4">
                              <label className="form-label">Tipo</label>
                              <select
                                className="form-select"
                                value={newSeedSymbol.type}
                                onChange={(e) => setNewSeedSymbol((prev) => ({ ...prev, type: e.target.value }))}
                              >
                                {typeOptions.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="col-md-2 d-grid">
                              <button className="btn btn-success" onClick={handleAddSeedSymbol}>
                                Añadir semilla
                              </button>
                            </div>
                          </div>

                          <h5 className="mb-3">Añadir símbolo derivado</h5>
                          <div className="row g-3 align-items-end">
                            <div className="col-md-6">
                              <label className="form-label">Nombre del nuevo símbolo</label>
                              <input
                                value={newSymbol.name}
                                onChange={(e) => setNewSymbol((prev) => ({ ...prev, name: e.target.value }))}
                                className="form-control"
                                placeholder="Ej. D"
                              />
                            </div>
                            <div className="col-md-4">
                              <label className="form-label">Tipo</label>
                              <select
                                className="form-select"
                                value={newSymbol.type}
                                onChange={(e) => setNewSymbol((prev) => ({ ...prev, type: e.target.value }))}
                              >
                                {typeOptions.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="col-md-2 d-grid">
                              <button className="btn btn-success" onClick={handleAddSymbol}>
                                Añadir derivado
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="alert alert-secondary">Acceso de solo lectura. No podés crear nuevos símbolos.</div>
                      )}
                    </div>

                    <div className="row mt-4 gy-3">
                      <div className="col-md-6">
                        <div className="card bg-light">
                          <div className="card-body">
                            <h5>Cadena de símbolos</h5>
                            {ancestors.length === 0 ? (
                              <p className="text-muted">No hay símbolos previos en la cadena.</p>
                            ) : (
                              <ol>
                                {ancestors.map((item) => (
                                  <li key={item._id}>{item.name}</li>
                                ))}
                              </ol>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="col-md-6">
                        <div className="card bg-light">
                          <div className="card-body">
                            <h5>Símbolos derivados</h5>
                            {childSymbols.length === 0 ? (
                              <p className="text-muted">No hay símbolos derivados desde este símbolo.</p>
                            ) : (
                              <ul className="list-unstyled mb-0">
                                {childSymbols.map((item) => (
                                  <li key={item._id}>
                                    <button type="button" className="btn btn-link p-0" onClick={() => handleSelect(item._id)}>
                                      {item.name}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectPage;
