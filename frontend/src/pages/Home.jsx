import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchProjects, createProject, createProjectFromJson, deleteProject, setProjectSecurity, fetchProjectCode } from '../api.js';
import { useAuth } from '../components/AuthContext.jsx';
import RoleManagement from '../components/RoleManagement.jsx';

const typeOptions = ['Sujeto', 'Objeto', 'Verbo', 'Estado'];
const sampleProjectJson = `{
  "name": "Proyecto de ejemplo",
  "securityCode": "1234",
  "documents": [],
  "about": {
    "intro": "Intro del sistema",
    "items": ["Objetivo 1", "Objetivo 2"]
  },
  "symbols": [
    {
      "name": "A",
      "type": "Sujeto",
      "isSeed": true,
      "order": "1"
    }
  ],
  "scenarios": [
    {
      "type": "Escenario",
      "title": "Login",
      "objective": "El usuario ingresa al sistema",
      "order": "1"
    }
  ],
  "tasks": [
    {
      "number": 1,
      "priority": 1,
      "description": "Verificar credenciales de usuario",
      "targetType": "scenario",
      "targetId": "Login",
      "targetLabel": "Login"
    }
  ],
  "inspections": [],
  "resolveNotes": []
}`;

function Home() {
  const { user, signOut } = useAuth();
  const [projects, setProjects] = useState([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [newName, setNewName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [seedSymbols, setSeedSymbols] = useState([{ name: '', type: 'Sujeto' }]);
  const [message, setMessage] = useState('');
  const [importJsonFile, setImportJsonFile] = useState(null);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [modalCode, setModalCode] = useState('');
  const [modalProjectName, setModalProjectName] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [activeMenuIndex, setActiveMenuIndex] = useState(0);
  const [activeModal, setActiveModal] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const menuOptions = [
    {
      key: 'create',
      title: 'Crear nuevo proyecto',
      subtitle: 'Abrir el formulario completo de creación',
      description: 'Crea un proyecto nuevo con administrador y símbolos semilla.',
      visible: user?.role !== 'invitado' && user?.role !== 'usuario'
    },
    {
      key: 'view',
      title: 'Ver proyectos',
      subtitle: 'Consulta tus proyectos existentes',
      description: 'Accede al listado de proyectos y administra códigos de seguridad.',
      visible: true
    },
    {
      key: 'roles',
      title: 'Administrar Roles',
      subtitle: 'Gestiona permisos de usuarios',
      description: 'Abre la vista de administración de roles para super admins.',
      visible: user?.role === 'super_admin'
    }
  ];

  const visibleOptions = menuOptions.filter((option) => option.visible);
  const activeOption = visibleOptions[activeMenuIndex] || visibleOptions[0] || null;
  const prevOption = visibleOptions.length > 1 ? visibleOptions[(activeMenuIndex - 1 + visibleOptions.length) % visibleOptions.length] : null;
  const nextOption = visibleOptions.length > 1 ? visibleOptions[(activeMenuIndex + 1) % visibleOptions.length] : null;

  useEffect(() => {
    if (!visibleOptions.length) return;
    setActiveMenuIndex((current) => {
      if (current < 0 || current >= visibleOptions.length) return 0;
      return current;
    });
  }, [visibleOptions.length]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!visibleOptions.length) return;
      if (event.key === 'ArrowLeft') {
        setActiveMenuIndex((prevIndex) => (prevIndex - 1 + visibleOptions.length) % visibleOptions.length);
      }
      if (event.key === 'ArrowRight') {
        setActiveMenuIndex((prevIndex) => (prevIndex + 1) % visibleOptions.length);
      }
      if (event.key === 'Enter') {
        setActiveModal(activeOption?.key || null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeOption, visibleOptions.length]);

  const handlePrevMenu = () => {
    if (!visibleOptions.length) return;
    setActiveMenuIndex((prevIndex) => (prevIndex - 1 + visibleOptions.length) % visibleOptions.length);
  };

  const handleNextMenu = () => {
    if (!visibleOptions.length) return;
    setActiveMenuIndex((prevIndex) => (prevIndex + 1) % visibleOptions.length);
  };

  const handleOpenMenuModal = (key) => {
    setActiveModal(key);
  };

  const handleCloseMenuModal = () => {
    setActiveModal(null);
  };

  const loadProjects = async () => {
    setIsLoadingProjects(true);
    try {
      const data = await fetchProjects();
      setProjects(data);
    } catch (error) {
      setMessage('Error al cargar proyectos');
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const handleAddSeedField = () => {
    setSeedSymbols((prev) => [...prev, { name: '', type: '' }]);
  };

  const handleRemoveSeedField = (index) => {
    setSeedSymbols((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSeedChange = (index, field, value) => {
    setSeedSymbols((prev) => prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item)));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) {
      setMessage('El nombre del proyecto es requerido.');
      return;
    }
    if (!adminUsername.trim() || !adminPassword.trim()) {
      setMessage('El username y la contraseña del administrador son obligatorios.');
      return;
    }
    const filledSeeds = seedSymbols.map((item) => ({ name: item.name.trim(), type: item.type.trim() }));
    if (!filledSeeds.length || filledSeeds.some((item) => !item.name || !item.type)) {
      setMessage('Todos los símbolos semilla deben tener nombre y tipo.');
      return;
    }

    try {
      await createProject(newName.trim(), filledSeeds, adminUsername.trim(), adminPassword.trim());
      setNewName('');
      setAdminUsername('');
      setAdminPassword('');
      setSeedSymbols([{ name: '', type: '' }]);
      setMessage('Proyecto creado. Usa Ver código para compartir el hash del proyecto.');
      loadProjects();
      setActiveModal(null);
    } catch (error) {
      setMessage(error.response?.data?.message || 'No se pudo crear el proyecto.');
    }
  };

  const handleSelectJsonFile = async (event) => {
    const file = event.target.files?.[0];
    setImportJsonFile(file || null);
  };

  const handleCreateFromJson = async () => {
    if (!importJsonFile) {
      setMessage('Selecciona un archivo JSON para importar.');
      return;
    }

    try {
      const jsonText = await importJsonFile.text();
      const parsed = JSON.parse(jsonText);
      await createProjectFromJson(parsed);
      setImportJsonFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setMessage('Proyecto importado correctamente desde JSON.');
      loadProjects();
      setActiveModal(null);
    } catch (error) {
      setMessage(error.response?.data?.message || error.message || 'JSON inválido o formato incorrecto.');
    }
  };

  const handleOpenCode = async (project) => {
    setShowCodeModal(true);
    setModalCode('');
    setModalProjectName(project.name);
    setModalError('');
    setModalLoading(true);

    try {
      const data = await fetchProjectCode(project._id);
      setModalCode(data.securityCode || '');
    } catch (error) {
      setModalError(error.response?.data?.message || 'No se pudo obtener el código del proyecto.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleCloseModal = () => {
    setShowCodeModal(false);
    setModalCode('');
    setModalProjectName('');
    setModalError('');
    setModalLoading(false);
  };

  const handleCopyCode = async () => {
    if (!modalCode) return;
    try {
      await navigator.clipboard.writeText(modalCode);
      setMessage('Código copiado al portapapeles.');
    } catch (error) {
      setMessage('No se pudo copiar el código.');
    }
  };

  const handleSetSecurity = async (projectId) => {
    const code = window.prompt('Ingrese un código de seguridad para este proyecto:');
    if (!code?.trim()) return;
    try {
      await setProjectSecurity(projectId, code.trim());
      setMessage('Código de seguridad establecido correctamente.');
      loadProjects();
    } catch (error) {
      setMessage(error.response?.data?.message || 'No se pudo establecer el código de seguridad.');
    }
  };

  const handleDelete = async (project) => {
    if (!window.confirm('¿Eliminar este proyecto?')) return;
    if (!project.hasSecurity) {
      setMessage('Este proyecto no tiene código de seguridad. Establezca uno antes de eliminarlo.');
      return;
    }
    const code = window.prompt('Ingrese el código de seguridad para eliminar el proyecto:');
    if (!code?.trim()) return;
    try {
      await deleteProject(project._id, code.trim());
      loadProjects();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Error al eliminar el proyecto');
    }
  };

  return (
    <div className="home-page container py-5">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h1 className="display-5">ReqTracker</h1>
          <p className="text-secondary mb-0">Menú principal organizado para creación, visualización y administración.</p>
        </div>
        <div className="d-flex align-items-center gap-3 flex-wrap">
          <span className="text-secondary">Bienvenido, {user?.username}</span>
          {user?.role === 'super_admin' && (
            <span className="badge bg-primary">Super Admin</span>
          )}
          <button onClick={signOut} className="btn btn-outline-secondary">Logout</button>
        </div>
      </div>

      {message && <div className="alert alert-info">{message}</div>}

      <div className="menu-wrapper mb-4">
        <div className="menu-card side-card">
          {prevOption ? (
            <>
              <img
                className="side-image"
                src="https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=60"
                alt={prevOption.title}
              />
              <div className="side-title">{prevOption.title}</div>
              <div className="side-sub">{prevOption.subtitle}</div>
              <p className="text-muted mt-3">{prevOption.description}</p>
            </>
          ) : (
            <div className="text-muted">No hay opción anterior</div>
          )}
        </div>

        <div className="menu-card main-card">
          {activeOption ? (
            <>
              <div className="main-header">
                <div>
                  <h2 className="project-title mb-2">{activeOption.title}</h2>
                  <p className="project-subtitle mb-3">{activeOption.subtitle}</p>
                  <p className="text-muted">{activeOption.description}</p>
                </div>
              </div>

              <div className="main-image mb-4" />

              <div>
                <button type="button" className="btn btn-primary me-2" onClick={() => handleOpenMenuModal(activeOption.key)}>
                  Abrir vista
                </button>
                {activeOption.key === 'view' && (
                  <span className="text-muted">Puedes ver todos tus proyectos y acciones rápidas.</span>
                )}
              </div>

              <div className="bottom-ui mt-4">
                <div className="nav">
                  <button type="button" className="circle-btn" onClick={handlePrevMenu} aria-label="Anterior">
                    ‹
                  </button>
                  <button type="button" className="circle-btn" onClick={handleNextMenu} aria-label="Siguiente">
                    ›
                  </button>
                  <span className="helper">Usá las flechas del teclado o hacé click para cambiar de opción.</span>
                </div>
                <div className="status">
                  <strong>Opción activa:</strong> {activeOption.title}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center text-muted py-5">No hay opciones disponibles para tu rol.</div>
          )}
        </div>

        <div className="menu-card side-card">
          {nextOption ? (
            <>
              <img
                className="side-image"
                src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=60"
                alt={nextOption.title}
              />
              <div className="side-title">{nextOption.title}</div>
              <div className="side-sub">{nextOption.subtitle}</div>
              <p className="text-muted mt-3">{nextOption.description}</p>
            </>
          ) : (
            <div className="text-muted">No hay opción siguiente</div>
          )}
        </div>
      </div>

      {activeModal === 'create' && (
        <div className="modal d-block" tabIndex="-1" role="dialog" style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}>
          <div className="modal-dialog modal-xl modal-dialog-centered" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Crear nuevo proyecto</h5>
                <button type="button" className="btn-close" aria-label="Cerrar" onClick={handleCloseMenuModal}></button>
              </div>
              <div className="modal-body">
                <form onSubmit={handleCreate}>
                  <div className="mb-3">
                    <label className="form-label">Nombre del proyecto</label>
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="form-control"
                      placeholder="Ej. Análisis del sistema XYZ"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Administrador del proyecto</label>
                    <input
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      className="form-control mb-2"
                      placeholder="Username del administrador"
                    />
                    <input
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="form-control mb-3"
                      placeholder="Contraseña del administrador"
                      type="password"
                    />
                    <label className="form-label">Símbolos semilla</label>
                    {seedSymbols.map((symbol, index) => (
                      <div key={index} className="row g-2 align-items-end mb-2">
                        <div className="col-5">
                          <input
                            value={symbol.name}
                            onChange={(e) => handleSeedChange(index, 'name', e.target.value)}
                            className="form-control"
                            placeholder="Nombre del símbolo"
                          />
                        </div>
                        <div className="col-5">
                          <select
                            value={symbol.type}
                            onChange={(e) => handleSeedChange(index, 'type', e.target.value)}
                            className="form-select"
                          >
                            {typeOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-2">
                          <button type="button" className="btn btn-outline-danger w-100" onClick={() => handleRemoveSeedField(index)} disabled={seedSymbols.length === 1}>
                            Eliminar
                          </button>
                        </div>
                      </div>
                    ))}
                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={handleAddSeedField}>
                      Añadir símbolo semilla
                    </button>
                  </div>
                  <button type="submit" className="btn btn-primary">
                    Crear proyecto
                  </button>
                </form>

                <hr />

                <div>
                  <h5>Crear a partir de JSON</h5>
                  <p className="text-muted">Carga un archivo JSON para generar el proyecto en la base de datos.</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json,.json"
                    className="d-none"
                    onChange={handleSelectJsonFile}
                  />
                  <div className="mb-3 d-flex flex-wrap align-items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Seleccionar archivo JSON
                    </button>
                    {importJsonFile && (
                      <span className="small text-muted">{importJsonFile.name}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCreateFromJson}
                  >
                    Crear a partir de JSON
                  </button>
                  <div className="mt-3 bg-light rounded p-3">
                    <strong>Formato esperado:</strong>
                    <pre className="small bg-transparent p-2 rounded" style={{ overflowX: 'auto' }}>
{sampleProjectJson}
                    </pre>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCloseMenuModal}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'view' && (
        <div className="modal d-block" tabIndex="-1" role="dialog" style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}>
          <div className="modal-dialog modal-xl modal-dialog-centered" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Ver proyectos</h5>
                <button type="button" className="btn-close" aria-label="Cerrar" onClick={handleCloseMenuModal}></button>
              </div>
              <div className="modal-body">
                {isLoadingProjects ? (
                  <div className="d-flex justify-content-center my-4">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Cargando proyectos...</span>
                    </div>
                  </div>
                ) : projects.length === 0 ? (
                  <p className="text-muted">No hay proyectos aún.</p>
                ) : (
                  <div className="list-group">
                    {projects.map((project) => (
                      <div key={project._id} className="list-group-item d-flex justify-content-between align-items-center gap-3 flex-column flex-sm-row">
                        <div>
                          <h5 className="mb-1">{project.name}</h5>
                          <small className="text-muted">Creado el {new Date(project.createdAt).toLocaleDateString()}</small>
                        </div>
                        <div className="d-flex gap-2 flex-wrap">
                          {(project.isProjectAdmin || user?.role === 'super_admin') && (
                            <button type="button" onClick={() => handleOpenCode(project)} className="btn btn-outline-secondary btn-sm">
                              Ver código
                            </button>
                          )}
                          <Link to={`/project/${project._id}`} className="btn btn-outline-primary btn-sm">
                            Abrir
                          </Link>
                          {!project.hasSecurity && (
                            <button type="button" onClick={() => handleSetSecurity(project._id)} className="btn btn-outline-warning btn-sm">
                              Establecer código de seguridad
                            </button>
                          )}
                          <button onClick={() => handleDelete(project)} className="btn btn-outline-danger btn-sm">
                            Eliminar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCloseMenuModal}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'roles' && (
        <div className="modal d-block" tabIndex="-1" role="dialog" style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}>
          <div className="modal-dialog modal-xl modal-dialog-centered" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Administrar Roles</h5>
                <button type="button" className="btn-close" aria-label="Cerrar" onClick={handleCloseMenuModal}></button>
              </div>
              <div className="modal-body">
                <RoleManagement />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCloseMenuModal}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
