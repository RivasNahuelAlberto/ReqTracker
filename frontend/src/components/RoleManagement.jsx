import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { getUsers, assignRole, removeUserProjectRole, fetchProjects, createUserInProject } from '../api.js';

const ALL_PROJECTS_VALUE = 'all';

const RoleManagement = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(ALL_PROJECTS_VALUE);
  const [assignProjectId, setAssignProjectId] = useState('');
  const [existingUsername, setExistingUsername] = useState('');
  const [existingRole, setExistingRole] = useState('usuario');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState('asc');
  const [searchField, setSearchField] = useState('usuario');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '', role: 'invitado' });

  useEffect(() => {
    if (user?.role === 'super_admin') {
      loadUsers();
      loadProjects();
    }
  }, [user]);

  useEffect(() => {
    if (selectedProjectId !== ALL_PROJECTS_VALUE && selectedProjectId) {
      setAssignProjectId(selectedProjectId);
    }
  }, [selectedProjectId]);

  const loadUsers = async () => {
    try {
      const data = await getUsers();
      setUsers(data.users || []);
    } catch (err) {
      setError('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      const data = await fetchProjects();
      setProjects(data || []);
      if (data?.length) {
        setSelectedProjectId(ALL_PROJECTS_VALUE);
        setAssignProjectId((prev) => prev || data[0]._id);
      }
    } catch (err) {
      setError('Error al cargar proyectos');
    }
  };

  const handleRoleChange = async (username, newRole, projectId) => {
    const targetProjectId = projectId || (selectedProjectId !== ALL_PROJECTS_VALUE ? selectedProjectId : '');
    if (!targetProjectId) {
      setError('Selecciona un proyecto válido para cambiar el rol.');
      return;
    }

    try {
      await assignRole(username, newRole, targetProjectId);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al asignar rol');
    }
  };

  const handleAssignExistingUser = async (e) => {
    e.preventDefault();
    const targetProjectId = assignProjectId || (selectedProjectId !== ALL_PROJECTS_VALUE ? selectedProjectId : '');
    if (!existingUsername.trim() || !targetProjectId) {
      setError('Username y proyecto son obligatorios.');
      return;
    }

    try {
      await assignRole(existingUsername.trim(), existingRole, targetProjectId);
      setExistingUsername('');
      setExistingRole('usuario');
      setError(null);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al asignar el rol al usuario.');
    }
  };

  const handleRemoveRole = async (username, projectId) => {
    try {
      await removeUserProjectRole(username, projectId);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al eliminar el rol asignado.');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const targetProjectId = selectedProjectId !== ALL_PROJECTS_VALUE ? selectedProjectId : assignProjectId;
    if (!targetProjectId) {
      setError('Selecciona un proyecto primero.');
      return;
    }

    try {
      await createUserInProject(newUser.username, newUser.email, newUser.password, newUser.role, targetProjectId);
      setNewUser({ username: '', email: '', password: '', role: 'invitado' });
      setShowCreateModal(false);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Error al crear usuario');
    }
  };

  const canCreateUsers = useMemo(() => {
    if (user?.role === 'super_admin') return true;
    const projectRole = user?.projectRoles?.find(pr => pr.project?.toString() === selectedProjectId?.toString());
    return projectRole?.role === 'admin';
  }, [user, selectedProjectId]);

  const filteredAssignments = useMemo(() => {
    const entries = [];

    users.forEach((u) => {
      if (!Array.isArray(u.projectRoles)) return;
      u.projectRoles.forEach((pr) => {
        const projectId = pr.project?.toString();
        if (!projectId) return;
        if (selectedProjectId !== ALL_PROJECTS_VALUE && projectId !== selectedProjectId) return;

        const projectName = projects.find((project) => project._id === projectId)?.name || 'Proyecto desconocido';
        entries.push({ user: u, projectId, projectName, role: pr.role });
      });
    });

    let filtered = entries;
    if (searchQuery) {
      filtered = filtered.filter((entry) => {
        const value = searchField === 'usuario'
          ? entry.user.username
          : searchField === 'email'
            ? entry.user.email
            : entry.projectName;
        return value.toLowerCase().includes(searchQuery.toLowerCase());
      });
    }

    filtered.sort((a, b) => {
      const aVal = a.user.username.toLowerCase();
      const bVal = b.user.username.toLowerCase();
      return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });

    return filtered;
  }, [users, selectedProjectId, searchQuery, searchField, sortOrder, projects]);

  const paginatedAssignments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAssignments.slice(start, start + pageSize);
  }, [filteredAssignments, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredAssignments.length / pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedProjectId, searchQuery, searchField]);

  if (user?.role !== 'super_admin') {
    return <div>No tienes permisos para acceder a esta sección.</div>;
  }

  if (loading) return <div>Cargando...</div>;
  if (error) return <div>Error: {error}</div>;

  const selectedProject = projects.find((project) => project._id === selectedProjectId);

  return (
    <div style={{ padding: '20px' }}>
      <h2>Administración de Roles</h2>
      <div className="mb-3 row g-3 align-items-end">
        <div className="col-sm-6 col-lg-4">
          <label className="form-label">Proyecto</label>
          <select
            className="form-select"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            <option value={ALL_PROJECTS_VALUE}>Todos</option>
            {projects.map((project) => (
              <option key={project._id} value={project._id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-sm-6 col-lg-4">
          <label className="form-label">Proyecto para asignación</label>
          <select
            className="form-select"
            value={assignProjectId}
            onChange={(e) => setAssignProjectId(e.target.value)}
          >
            {projects.map((project) => (
              <option key={project._id} value={project._id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4 p-3 bg-light rounded">
        <h5 className="mb-3">Asignar usuario existente a un proyecto</h5>
        <form className="row g-3 align-items-end" onSubmit={handleAssignExistingUser}>
          <div className="col-sm-6 col-lg-4">
            <label className="form-label">Username</label>
            <input
              type="text"
              className="form-control"
              value={existingUsername}
              onChange={(e) => setExistingUsername(e.target.value)}
              placeholder="Nombre de usuario existente"
              required
            />
          </div>
          <div className="col-sm-6 col-lg-4">
            <label className="form-label">Rol</label>
            <select
              className="form-select"
              value={existingRole}
              onChange={(e) => setExistingRole(e.target.value)}
            >
              <option value="usuario">Usuario</option>
              <option value="admin">Admin</option>
              <option value="invitado">Invitado</option>
            </select>
          </div>
          <div className="col-sm-12 col-lg-4 d-grid">
            <button type="submit" className="btn btn-primary">
              Asignar rol
            </button>
          </div>
        </form>
      </div>

      {projects.length === 0 ? (
        <div>No hay proyectos para seleccionar.</div>
      ) : (
        <>
          {canCreateUsers && (
            <button
              type="button"
              className="btn btn-primary mb-3"
              onClick={() => setShowCreateModal(true)}
            >
              Agregar usuario a un proyecto
            </button>
          )}

          <div className="mb-3 d-flex gap-3 align-items-center">
            <div>
              <label className="form-label me-2">Buscar por:</label>
              <select
                className="form-select d-inline-block w-auto"
                value={searchField}
                onChange={(e) => setSearchField(e.target.value)}
              >
                <option value="usuario">Usuario</option>
                <option value="email">Email</option>
                <option value="proyecto">Proyecto</option>
              </select>
            </div>
            <div className="flex-grow-1">
              <input
                type="text"
                className="form-control"
                placeholder={`Buscar por ${searchField}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label me-2">Orden:</label>
              <select
                className="form-select d-inline-block w-auto"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              >
                <option value="asc">Ascendente</option>
                <option value="desc">Descendente</option>
              </select>
            </div>
            <div>
              <label className="form-label me-2">Mostrar:</label>
              <select
                className="form-select d-inline-block w-auto"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <table className="table table-striped">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Email</th>
                <th>Proyecto</th>
                <th>Rol asignado</th>
                <th>Cambiar Rol</th>
                <th>Eliminar</th>
              </tr>
            </thead>
            <tbody>
              {paginatedAssignments.map((entry) => (
                <tr key={`${entry.user._id}-${entry.projectId}`}>
                  <td>{entry.user.username}</td>
                  <td>{entry.user.email}</td>
                  <td>{entry.projectName}</td>
                  <td>{entry.role}</td>
                  <td>
                    <select
                      className="form-select"
                      value={entry.role}
                      onChange={(e) => handleRoleChange(entry.user.username, e.target.value, entry.projectId)}
                    >
                      <option value="invitado">Invitado</option>
                      <option value="usuario">Usuario</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => handleRemoveRole(entry.user.username, entry.projectId)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <nav>
              <ul className="pagination justify-content-center">
                <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setCurrentPage(currentPage - 1)}>Anterior</button>
                </li>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <li key={page} className={`page-item ${page === currentPage ? 'active' : ''}`}>
                    <button className="page-link" onClick={() => setCurrentPage(page)}>{page}</button>
                  </li>
                ))}
                <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setCurrentPage(currentPage + 1)}>Siguiente</button>
                </li>
              </ul>
            </nav>
          )}
        </>
      )}

      {showCreateModal && (
        <div className="modal d-block" tabIndex="-1" role="dialog" style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}>
          <div className="modal-dialog" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Crear usuario en proyecto {selectedProject?.name}</h5>
                <button type="button" className="btn-close" aria-label="Cerrar" onClick={() => setShowCreateModal(false)}></button>
              </div>
              <div className="modal-body">
                <form onSubmit={handleCreateUser}>
                  <div className="mb-3">
                    <label className="form-label">Username</label>
                    <input
                      type="text"
                      className="form-control"
                      value={newUser.username}
                      onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-control"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Password</label>
                    <input
                      type="password"
                      className="form-control"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Rol en proyecto</label>
                    <select
                      className="form-select"
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    >
                      <option value="invitado">Invitado</option>
                      <option value="usuario">Usuario</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <button type="submit" className="btn btn-primary">Crear usuario</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleManagement;