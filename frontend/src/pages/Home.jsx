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
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadProjects();
  }, []);

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
    <div className="container py-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="display-5">ReqTracker</h1>
          <p className="text-secondary">Menú principal para seguimiento y especificación de requisitos.</p>
        </div>
        <div>
          <span className="me-3">Welcome, {user?.username}</span>
          {user?.role === 'super_admin' && (
            <span className="badge bg-primary me-3">Super Admin</span>
          )}
          <button onClick={signOut} className="btn btn-outline-secondary">Logout</button>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-6">
          <div className="card shadow-sm">
            <div className="card-body">
              <h2 className="card-title">Crear nuevo proyecto</h2>
              {message && <div className="alert alert-info">{message}</div>}
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
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card shadow-sm">
            <div className="card-body">
              <h2 className="card-title">Ver proyectos</h2>
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
                      <div className="d-flex gap-2">
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
          </div>
        </div>
      </div>

      {showCodeModal && (
        <div className="modal d-block" tabIndex="-1" role="dialog" style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}>
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Código del proyecto {modalProjectName}</h5>
                <button type="button" className="btn-close" aria-label="Cerrar" onClick={handleCloseModal}></button>
              </div>
              <div className="modal-body">
                {modalLoading ? (
                  <div className="d-flex justify-content-center py-4">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Cargando...</span>
                    </div>
                  </div>
                ) : modalError ? (
                  <div className="alert alert-danger">{modalError}</div>
                ) : (
                  <div>
                    <p>Comparte este código con los usuarios del proyecto para la gestión de roles.</p>
                    <div className="input-group mb-3">
                      <input type="text" readOnly className="form-control" value={modalCode} />
                      <button type="button" className="btn btn-outline-primary" onClick={handleCopyCode}>
                        Copiar
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                  Volver
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {user?.role === 'super_admin' && (
        <div className="mt-4">
          <RoleManagement />
        </div>
      )}
    </div>
  );
}

export default Home;
