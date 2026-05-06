import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
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
  deleteTask,
  createInspection,
  updateAbout,
  lockItem,
  unlockItem
} from '../api.js';
import RelationMap from '../components/RelationMap.jsx';

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
  const [project, setProject] = useState(null);
  const [symbols, setSymbols] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [activeTab, setActiveTab] = useState('symbols');
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
  const [taskTargetType, setTaskTargetType] = useState('symbol');
  const [taskTargetId, setTaskTargetId] = useState('');
  const [inspections, setInspections] = useState([]);
  const [inspectionAspect, setInspectionAspect] = useState('');
  const [inspectionDescription, setInspectionDescription] = useState('');
  const [inspectionTargetType, setInspectionTargetType] = useState('symbol');
  const [inspectionTargetId, setInspectionTargetId] = useState('');
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
    const socketInstance = io(import.meta.env.VITE_API_BASE || 'http://localhost:4000', {
      transports: ['websocket']
    });
    socketInstance.on('connect', () => {
      socketInstance.emit('joinProject', projectId);
    });
    socketInstance.on('projectUpdated', () => {
      loadProject();
    });
    socketInstance.on('lockChanged', (locks) => {
      setProjectLocks(locks || []);
    });
    setSocket(socketInstance);

    return () => {
      socketInstance.emit('leaveProject', projectId);
      socketInstance.disconnect();
    };
  }, [projectId]);

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
      setProjectLocks(projectData.locks || []);
      setAboutIntro(projectData.about?.intro || '');
      setAboutItems(projectData.about?.items?.length ? projectData.about.items : ['']);
      if (projectData.symbols && projectData.symbols.length > 0) {
        setSelectedSymbol(projectData.symbols[0]);
      }
      if (projectData.scenarios && projectData.scenarios.length > 0) {
        setSelectedScenario(projectData.scenarios[0]);
      }
    } catch (error) {
      setMessage('Error cargando el proyecto.');
    } finally {
      setIsLoading(false);
    }
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
    const scenario = scenarios.find((item) => item._id === scenarioId);
    if (scenario) {
      setSelectedScenario(scenario);
      setScenarioEditMode(false);
      setScenarioTab(scenario.type || 'Escenario');
      setMessage('');
    }
  };

  const handleSelectItem = (targetId) => {
    const symbol = symbols.find((item) => item._id === targetId);
    if (symbol) {
      handleSelect(targetId);
      setActiveTab('symbols');
      return;
    }
    const scenario = scenarios.find((item) => item._id === targetId);
    if (scenario) {
      handleSelectScenario(targetId);
      setActiveTab('scenarios');
    }
  };

  const getTargetLabel = (targetType, targetId) => {
    if (targetType === 'symbol') {
      return symbols.find((symbol) => symbol._id === targetId)?.name || 'Símbolo';
    }
    if (targetType === 'scenario') {
      return scenarios.find((scenario) => scenario._id === targetId)?.title || 'Escenario';
    }
    return 'Elemento';
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
    const scenario = scenarios.find((item) => item._id === itemId);
    const symbol = symbols.find((item) => item._id === itemId);
    const selected = value.slice(start, end).trim();
    const label = selected || scenario?.title || symbol?.name || 'enlace';
    const nextValue = value.slice(0, start) + `[${label}](${itemId})` + value.slice(end);
    setter(nextValue);
    window.requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + label.length + 3, start + label.length + 3 + label.length);
    });
  };

  const insertLinkToSymbol = (itemId, ref, value, setter) => {
    insertLinkToItem(itemId, ref, value, setter);
  };

  const filteredLinkItemsEpisode = useMemo(() => {
    const query = linkSearchEpisode.trim().toLowerCase();
    const allItems = [
      ...symbols.map((symbol) => ({
        _id: symbol._id,
        label: `${symbol.name} (${symbol.type})`,
        type: 'symbol'
      })),
      ...scenarios.map((scenario) => ({
        _id: scenario._id,
        label: `${scenario.type}: ${scenario.title}`,
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
      await updateSymbol(projectId, selectedSymbol._id, {
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
      setSelectedSymbol((prev) => prev ? { ...prev, notion: notionEdit, impact: impactEdit } : prev);
      setSymbolEditMode(false);
      await unlockItemAction('symbol', selectedSymbol._id);
      setMessage('Símbolo actualizado');
      refreshSymbols();
    } catch (error) {
      setMessage('No se pudo guardar el símbolo.');
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
    return symbols.filter((symbol) => {
      if (!selectedSymbol || symbol._id === selectedSymbol._id) return false;
      if (!query) return true;
      const name = symbol.name?.toLowerCase() || '';
      const type = symbol.type?.toLowerCase() || '';
      return name.includes(query) || type.includes(query);
    });
  }, [symbols, linkSearchNotion, selectedSymbol]);

  const filteredLinkSymbolsImpact = useMemo(() => {
    const query = linkSearchImpact.trim().toLowerCase();
    return symbols.filter((symbol) => {
      if (!selectedSymbol || symbol._id === selectedSymbol._id) return false;
      if (!query) return true;
      const name = symbol.name?.toLowerCase() || '';
      const type = symbol.type?.toLowerCase() || '';
      return name.includes(query) || type.includes(query);
    });
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
    <div className="container py-4">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h1>{project?.name || 'Proyecto'}</h1>
          <p className="text-muted">Secciones fundamentales: Documentos, Lista de símbolos, Mapa de relaciones, Escenarios, A Resolver, Asistente, Acerca del Sistema, Tareas Pendientes e Inspección.</p>
        </div>
        <Link to="/" className="btn btn-outline-secondary align-self-start">
          Volver al menú
        </Link>
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
              { key: 'symbols', label: 'Lista de símbolos' },
              { key: 'map', label: 'Mapa de relaciones' },
              { key: 'scenarios', label: 'Escenarios' },
              { key: 'resolve', label: 'A Resolver' },
              { key: 'assistant', label: 'Asistente' },
              { key: 'about', label: 'Acerca del Sistema' },
              { key: 'tasks', label: `Tareas Pendientes${tasks.length > 0 ? ` (${tasks.length})` : ''}` },
              { key: 'inspection', label: 'Inspección' }
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`btn ${activeTab === tab.key ? 'btn-primary' : tab.key === 'tasks' && tasks.length > 0 ? 'btn-warning' : 'btn-outline-primary'}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {message && <div className="alert alert-info">{message}</div>}

      {activeTab === 'documents' && (
        <div className="card shadow-sm">
          <div className="card-body">
            <h2>Documentos</h2>
            <p>Esta sección está preparada para agregar descripciones, requisitos y archivos de especificación.</p>
            <div className="alert alert-secondary">Funcionalidad de documentos pendiente de expansión.</div>
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
                  {selectedScenario && (
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
                        <button className="btn btn-primary btn-sm" onClick={handleStartScenarioEdit}>
                          Editar escenario
                        </button>
                        <button className="btn btn-outline-danger btn-sm" onClick={handleDeleteScenario}>
                          Eliminar
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
                      {selectedScenario ? (
                        <>
                          <button className="btn btn-primary" onClick={handleUpdateScenario}>Guardar escenario</button>
                          <button className="btn btn-outline-secondary" onClick={handleCancelScenarioEdit}>Cancelar</button>
                          <button className="btn btn-outline-danger" onClick={handleDeleteScenario}>Eliminar escenario</button>
                        </>
                      ) : (
                        <button className="btn btn-success" onClick={handleCreateScenario}>Crear escenario</button>
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
              />
              <div className="mt-2 text-end">
                <button className="btn btn-primary" onClick={handleCreateResolveNote}>
                  Agregar nota a resolver
                </button>
              </div>
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
                              />
                              <div className="d-flex gap-2 flex-wrap">
                                <button className="btn btn-sm btn-primary" onClick={handleSaveResolveNote}>
                                  Guardar
                                </button>
                                <button className="btn btn-sm btn-outline-secondary" onClick={handleCancelResolveEdit}>
                                  Cancelar
                                </button>
                              </div>
                            </>
                          ) : (
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
        <div className="card shadow-sm">
          <div className="card-body">
            <h2>Asistente</h2>
            <p>La integración con un agente de IA real está en desarrollo.</p>
            <div className="alert alert-secondary">
              El chat se muestra aquí cuando se habilite una conexión directa a la API del agente.
              Por ahora está deshabilitado para evitar respuestas prefabricadas.
            </div>
          </div>
        </div>
      )}

      {activeTab === 'about' && (
        <div className="card shadow-sm">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2>Acerca del Sistema</h2>
              <button
                className="btn btn-outline-primary"
                onClick={() => setAboutEditMode(!aboutEditMode)}
              >
                {aboutEditMode ? 'Cancelar' : 'Editar'}
              </button>
            </div>
            {aboutEditMode ? (
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

      {activeTab === 'tasks' && (
        <div className="card shadow-sm">
          <div className="card-body">
            <h2>Tareas Pendientes</h2>
            <p className="text-muted">Tareas organizadas por prioridad para completar el proyecto.</p>
            <div className="mb-4">
              <h5>Nueva tarea</h5>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Descripción</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                    placeholder="Describe la tarea..."
                  />
                </div>
                <div className="col-md-3">
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
                <div className="col-md-3">
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
              <div className="mt-3 text-end">
                <button className="btn btn-primary" onClick={handleCreateTask}>
                  Agregar tarea
                </button>
              </div>
            </div>
            {tasks.length === 0 ? (
              <div className="alert alert-secondary">No hay tareas pendientes.</div>
            ) : (
              <div className="list-group">
                {tasks
                  .sort((a, b) => a.priority - b.priority)
                  .map((task) => (
                    <div key={task._id} className="list-group-item">
                      <div className="d-flex justify-content-between align-items-start">
                        <div className="flex-grow-1">
                          <div className="d-flex align-items-center gap-2 mb-2">
                            <span className={`badge ${task.priority === 1 ? 'bg-danger' : task.priority === 2 ? 'bg-warning text-dark' : 'bg-info'}`}>
                              {task.priority === 1 ? 'Alta' : task.priority === 2 ? 'Media' : 'Baja'}
                            </span>
                            <small className="text-muted">
                              Asociado a: {getTargetLabel(task.targetType, task.targetId)}
                            </small>
                          </div>
                          <p className="mb-2">{task.description}</p>
                        </div>
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => handleDeleteTask(task._id)}
                        >
                          Completar
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
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
                    placeholder="Describe el hallazgo o comentario..."
                  />
                </div>
              </div>
              <div className="mt-3 text-end">
                <button className="btn btn-primary" onClick={handleCreateInspection}>
                  Agregar reporte
                </button>
              </div>
            </div>
            {inspections.length === 0 ? (
              <div className="alert alert-secondary">No hay reportes de inspección.</div>
            ) : (
              <div className="list-group">
                {inspections.map((inspection) => (
                  <div key={inspection._id} className="list-group-item">
                    <div className="d-flex justify-content-between align-items-start">
                      <div className="flex-grow-1">
                        <div className="d-flex align-items-center gap-2 mb-2">
                          <strong>{inspection.aspect}</strong>
                          <small className="text-muted">
                            Asociado a: {getTargetLabel(inspection.targetType, inspection.targetId)}
                          </small>
                        </div>
                        <p className="mb-0">{inspection.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'map' && (
        <div className="card shadow-sm">
          <div className="card-body">
            <h2>Mapa de relaciones <small className="text-muted">({symbols.length})</small></h2>
            <p>Visualización jerárquica de símbolos según su origen.</p>
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
                                        {symbol.name} ({symbol.type})
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
                                        {symbol.name} ({symbol.type})
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
                          <button className="btn btn-primary" onClick={handleSave}>
                            Guardar cambios
                          </button>
                          <button className="btn btn-outline-secondary" onClick={handleCancelSymbolEdit}>
                            Cancelar
                          </button>
                          <button className="btn btn-outline-danger" onClick={handleDeleteSymbol}>
                            Eliminar símbolo
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="border rounded p-3 bg-light mb-4">
                        <div className="d-flex justify-content-between align-items-start mb-3">
                          <div>
                            <h5 className="mb-2">Vista previa</h5>
                            <p className="text-muted mb-0">Revisa el símbolo antes de editarlo.</p>
                          </div>
                          <div className="btn-group">
                            <button className="btn btn-primary btn-sm" onClick={handleStartSymbolEdit}>
                              Editar
                            </button>
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
                            <button className="btn btn-outline-danger btn-sm" onClick={handleDeleteSymbol}>
                              Eliminar
                            </button>
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
