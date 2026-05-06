import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchProjects, createProject, createProjectFromJson, deleteProject, setProjectSecurity } from '../api.js';

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
      "_id": "64b8fa...",
      "name": "A",
      "type": "Sujeto",
      "isSeed": true,
      "order": "1"
    }
  ],
  "scenarios": [
    {
      "_id": "64b8fb...",
      "type": "Escenario",
      "title": "Login",
      "objective": "El usuario ingresa al sistema",
      "order": "1"
    }
  ],
  "tasks": [
    {
      "_id": "64b8fc...",
      "number": 1,
      "priority": 1,
      "description": "Verificar credenciales",
      "targetType": "scenario",
      "targetId": "64b8fb..."
    }
  ],
  "inspections": [],
  "resolveNotes": []
}`;

function Home() {
  const [projects, setProjects] = useState([]);
  const [newName, setNewName] = useState('');
  const [newSecurityCode, setNewSecurityCode] = useState('');
  const [seedSymbols, setSeedSymbols] = useState([{ name: '', type: 'Sujeto' }]);
  const [message, setMessage] = useState('');
  const [importJsonText, setImportJsonText] = useState('');

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const data = await fetchProjects();
      setProjects(data);
    } catch (error) {
      setMessage('Error al cargar proyectos');
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
    if (!newSecurityCode.trim()) {
      setMessage('El código de seguridad del proyecto es obligatorio.');
      return;
    }
    const filledSeeds = seedSymbols.map((item) => ({ name: item.name.trim(), type: item.type.trim() }));
    if (!filledSeeds.length || filledSeeds.some((item) => !item.name || !item.type)) {
      setMessage('Todos los símbolos semilla deben tener nombre y tipo.');
      return;
    }

    try {
      await createProject(newName.trim(), filledSeeds, newSecurityCode.trim());
      setNewName('');
      setNewSecurityCode('');
      setSeedSymbols([{ name: '', type: '' }]);
      setMessage('Proyecto creado con símbolos semilla.');
      loadProjects();
    } catch (error) {
      setMessage(error.response?.data?.message || 'No se pudo crear el proyecto.');
    }
  };

  const handleImportJson = async () => {
    if (!importJsonText.trim()) {
      setMessage('Pega un JSON válido para importar.');
      return;
    }

    try {
      const parsed = JSON.parse(importJsonText);
      await createProjectFromJson(parsed);
      setImportJsonText('');
      setMessage('Proyecto importado correctamente desde JSON.');
      loadProjects();
    } catch (error) {
      setMessage(error.response?.data?.message || error.message || 'JSON inválido o formato incorrecto.');
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
      <div className="text-center mb-4">
        <h1 className="display-5">ReqTracker</h1>
        <p className="text-secondary">Menú principal para seguimiento y especificación de requisitos.</p>
      </div>

      <div className="row g-4">
        <div className="col-lg-6">
          <div className="card shadow-sm h-100">
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
                  <label className="form-label">Código de seguridad</label>
                  <input
                    value={newSecurityCode}
                    onChange={(e) => setNewSecurityCode(e.target.value)}
                    className="form-control mb-3"
                    placeholder="Define un código de seguridad para el proyecto"
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
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card shadow-sm mb-4">
            <div className="card-body">
              <h2 className="card-title">Importar proyecto desde JSON</h2>
              <p className="text-muted">Crea un proyecto completo a partir de un archivo JSON con estructura autodocumentada.</p>
              <div className="mb-3">
                <label className="form-label">JSON del proyecto</label>
                <textarea
                  rows="10"
                  value={importJsonText}
                  onChange={(e) => setImportJsonText(e.target.value)}
                  className="form-control monospace"
                  placeholder="Pega aquí el JSON del proyecto..."
                />
              </div>
              <button className="btn btn-primary mb-3" onClick={handleImportJson}>
                Importar desde JSON
              </button>
              <div className="bg-light rounded p-3">
                <strong>Formato esperado:</strong>
                <pre className="small bg-transparent p-2 rounded" style={{ overflowX: 'auto' }}>
{sampleProjectJson}
                </pre>
              </div>
            </div>
          </div>

          <div className="card shadow-sm h-100">
            <div className="card-body">
              <h2 className="card-title">Ver proyectos</h2>
              {projects.length === 0 ? (
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
    </div>
  );
}

export default Home;
