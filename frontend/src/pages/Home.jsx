import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchProjects, createProject, deleteProject } from '../api.js';

function Home() {
  const [projects, setProjects] = useState([]);
  const [newName, setNewName] = useState('');
  const [seedSymbols, setSeedSymbols] = useState([{ name: '', type: '' }]);
  const [message, setMessage] = useState('');

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
    const filledSeeds = seedSymbols.map((item) => ({ name: item.name.trim(), type: item.type.trim() }));
    if (!filledSeeds.length || filledSeeds.some((item) => !item.name || !item.type)) {
      setMessage('Todos los símbolos semilla deben tener nombre y tipo.');
      return;
    }

    try {
      await createProject(newName.trim(), filledSeeds);
      setNewName('');
      setSeedSymbols([{ name: '', type: '' }]);
      setMessage('Proyecto creado con símbolos semilla.');
      loadProjects();
    } catch (error) {
      setMessage(error.response?.data?.message || 'No se pudo crear el proyecto.');
    }
  };

  const handleDelete = async (projectId) => {
    if (!window.confirm('¿Eliminar este proyecto?')) return;
    try {
      await deleteProject(projectId);
      loadProjects();
    } catch (error) {
      setMessage('Error al eliminar el proyecto');
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
                        <input
                          value={symbol.type}
                          onChange={(e) => handleSeedChange(index, 'type', e.target.value)}
                          className="form-control"
                          placeholder="Tipo de símbolo"
                        />
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
                        <button onClick={() => handleDelete(project._id)} className="btn btn-outline-danger btn-sm">
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
