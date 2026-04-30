import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  fetchProject,
  fetchSymbols,
  createSymbol,
  updateSymbol,
  deleteSymbol
} from '../api.js';
import RelationMap from '../components/RelationMap.jsx';

function ProjectPage() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [symbols, setSymbols] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [activeTab, setActiveTab] = useState('symbols');
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
  const typeOptions = ['Sujeto', 'Objeto', 'Verbo', 'Estado'];

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
      setNewSymbol({ name: '', type: 'Concepto' });
    }
  };

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
        notion: notionEdit,
        impact: impactEdit,
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
      setNewSymbol({ name: '', type: 'Concepto' });
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
      setNewSeedSymbol({ name: '', type: 'Concepto' });
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

  const filteredSymbols = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return symbols;
    return symbols.filter((symbol) => {
      const name = symbol.name?.toLowerCase() || '';
      const type = symbol.type?.toLowerCase() || '';
      return name.includes(query) || type.includes(query);
    });
  }, [symbols, searchQuery]);

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
    return symbols.filter((symbol) => symbol._id !== selectedSymbol._id && !descendantIds.has(symbol._id));
  }, [selectedSymbol, symbols, descendantIds]);

  const childSymbols = useMemo(() => {
    if (!selectedSymbol) return [];
    return symbols.filter((symbol) => symbol.parentSymbol === selectedSymbol._id);
  }, [selectedSymbol, symbols]);

  return (
    <div className="container py-4">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h1>{project?.name || 'Proyecto'}</h1>
          <p className="text-muted">Secciones fundamentales: Documentos, Lista de símbolos, Mapa de relaciones y Escenarios.</p>
        </div>
        <Link to="/" className="btn btn-outline-secondary align-self-start">
          Volver al menú
        </Link>
      </div>

      <div className="mb-3">
        <div className="btn-group" role="group">
          {['documents', 'symbols', 'map', 'scenarios'].map((tab) => (
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

      {activeTab === 'map' && (
        <div className="card shadow-sm">
          <div className="card-body">
            <h2>Mapa de relaciones</h2>
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
                          <div>{symbol.name}</div>
                          {symbol.isSeed === true && <small className="badge bg-secondary me-2">Semilla</small>}
                        </div>
                        <span className={`badge ${symbol.status === 'complete' ? 'bg-success' : 'bg-danger'}`}>{symbol.status === 'complete' ? 'Completo' : 'Incompleto'}</span>
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
                    <div className="d-flex align-items-center gap-2">
                      <span className={`badge py-2 ${selectedSymbol.status === 'complete' ? 'text-bg-success' : 'text-bg-danger'}`}>
                        {selectedSymbol.status === 'complete' ? 'Completo' : 'Incompleto'}
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
                    <div className="mb-3">
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

                    <div className="form-check form-switch mb-3">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="statusSwitch"
                        checked={selectedSymbol.status === 'complete'}
                        onChange={(e) => handleUpdateField('status', e.target.checked ? 'complete' : 'incomplete')}
                      />
                      <label className="form-check-label" htmlFor="statusSwitch">
                        Marcar como completo
                      </label>
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
