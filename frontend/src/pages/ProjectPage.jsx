import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  fetchProject,
  fetchSymbols,
  createSymbol,
  updateSymbol,
  deleteSymbol,
  createResolveNote,
  updateResolveNote,
  resolveNote,
  deleteResolveNote
} from '../api.js';
import RelationMap from '../components/RelationMap.jsx';

const typeOptions = ['Sujeto', 'Objeto', 'Verbo', 'Estado'];
const statusOptions = [
  { value: 'incomplete', label: 'Incompleto', variant: 'danger' },
  { value: 'review', label: 'Revisión', variant: 'warning' },
  { value: 'complete', label: 'Completo', variant: 'success' }
];

function ProjectPage() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [symbols, setSymbols] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [activeTab, setActiveTab] = useState('symbols');
  const [resolveNotes, setResolveNotes] = useState([]);
  const [newResolveText, setNewResolveText] = useState('');
  const [assistantProvider, setAssistantProvider] = useState('ChatGPT');
  const [assistantLoggedIn, setAssistantLoggedIn] = useState(false);
  const [assistantMessage, setAssistantMessage] = useState('Seleccione un proveedor y conecte su cuenta para empezar.');
  const [searchQuery, setSearchQuery] = useState('');
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
    if (!selectedSymbol && symbols.length > 0) {
      setSelectedSymbol(symbols[0]);
    }
  }, [symbols, selectedSymbol]);

  const loadProject = async () => {
    try {
      const projectData = await fetchProject(projectId);
      setProject(projectData);
      setSymbols(projectData.symbols || []);
      setResolveNotes(projectData.resolveNotes || []);
      if (projectData.symbols && projectData.symbols.length > 0) {
        setSelectedSymbol(projectData.symbols[0]);
      }
    } catch (error) {
      setMessage('Error cargando el proyecto.');
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
      setMessage('');
      setNewSymbol({ name: '', type: 'Sujeto' });
    }
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

  const handleUpdateResolveNote = async (note) => {
    const text = window.prompt('Edita la nota de resolución:', note.text);
    if (!text?.trim()) return;
    try {
      await updateResolveNote(projectId, note._id, text.trim());
      setMessage('Nota actualizada.');
      loadProject();
    } catch (error) {
      setMessage(error.response?.data?.message || 'No se pudo actualizar la nota.');
    }
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

  const insertLinkToSymbol = (symbolId, ref, value, setter) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const symbol = symbols.find((symbol) => symbol._id === symbolId);
    const selected = value.slice(start, end).trim();
    const label = selected || symbol?.name || 'enlace';
    const nextValue = value.slice(0, start) + `[${label}](${symbolId})` + value.slice(end);
    setter(nextValue);
    window.requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + label.length + 3, start + label.length + 3 + label.length);
    });
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
            handleSelect(targetId);
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
          <p className="text-muted">Secciones fundamentales: Documentos, Lista de símbolos, Mapa de relaciones, Escenarios, A Resolver y Asistente.</p>
        </div>
        <Link to="/" className="btn btn-outline-secondary align-self-start">
          Volver al menú
        </Link>
      </div>

      <div className="mb-3">
        <div className="btn-group" role="group">
          {['documents', 'symbols', 'map', 'scenarios', 'resolve', 'assistant'].map((tab) => (
            <button
              key={tab}
              type="button"
              className={`btn btn-${activeTab === tab ? 'primary' : 'outline-primary'}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'documents' && 'Documentos'}
              {tab === 'symbols' && 'Lista de símbolos'}
              {tab === 'map' && 'Mapa de relaciones'}
              {tab === 'scenarios' && 'Escenarios'}
              {tab === 'resolve' && 'A Resolver'}
              {tab === 'assistant' && 'Asistente'}
            </button>
          ))}
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
        <div className="card shadow-sm">
          <div className="card-body">
            <h2>Escenarios</h2>
            <p>Espacio preparado para gestionar escenarios de uso y casos de prueba.</p>
            <div className="alert alert-secondary">Funcionalidad de escenarios por desarrollar.</div>
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
                          <button className="btn btn-sm btn-success" onClick={() => handleResolveNote(note._id)}>
                            Marcar como resuelta
                          </button>
                          <button className="btn btn-sm btn-outline-secondary" onClick={() => handleUpdateResolveNote(note)}>
                            Editar
                          </button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleDeleteResolveNote(note._id)}>
                            Eliminar
                          </button>
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
            <p>Sección para futuros servicios de ayuda automática e integración AI.</p>
            <div className="mb-3">
              <label className="form-label">Proveedor</label>
              <select
                className="form-select"
                value={assistantProvider}
                onChange={(e) => setAssistantProvider(e.target.value)}
              >
                <option value="ChatGPT">ChatGPT</option>
                <option value="LocalAI">LocalAI</option>
              </select>
            </div>
            <div className="mb-3">
              <button
                className="btn btn-outline-primary"
                onClick={() => setAssistantLoggedIn(!assistantLoggedIn)}
              >
                {assistantLoggedIn ? 'Desconectar cuenta' : 'Conectar cuenta'}
              </button>
            </div>
            <div className="border rounded p-3 bg-light">
              <p>{assistantMessage}</p>
              <button className="btn btn-sm btn-primary" disabled={!assistantLoggedIn}>
                Enviar pregunta (pendiente de implementación)
              </button>
            </div>
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
                      <button className="btn btn-outline-danger" onClick={handleDeleteSymbol}>
                        Eliminar símbolo
                      </button>
                    </div>

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
