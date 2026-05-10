import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { getUsers, assignRole, fetchProjects, createUserInProject } from '../api.js';

const RoleManagement = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
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
        setSelectedProjectId(data[0]._id);
      }
    } catch (err) {
      setError('Error al cargar proyectos');
    }
  };

  const handleRoleChange = async (username, newRole) => {
    if (!selectedProjectId) {
      setError('Selecciona un proyecto primero.');
      return;
    }

    try {
      await assignRole(username, newRole, selectedProjectId);
      await loadUsers();
    } catch (err) {
      setError('Error al asignar rol');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!selectedProjectId) {
      setError('Selecciona un proyecto primero.');
      return;
    }

    try {
      await createUserInProject(newUser.username, newUser.email, newUser.password, newUser.role, selectedProjectId);
      setNewUser({ username: '', email: '', password: '', role: 'invitado' });
      setShowCreateModal(false);
      await loadUsers();
    } catch (err) {
      setError('Error al crear usuario');
    }
  };

  const canCreateUsers = useMemo(() => {
    if (user?.role === 'super_admin') return true;
    const projectRole = user?.projectRoles?.find(pr => pr.project?.toString() === selectedProjectId?.toString());
    return projectRole?.role === 'admin';
  }, [user, selectedProjectId]);

  const filteredUsers = useMemo(() => {
    if (!selectedProjectId) return [];

    let filtered = users.filter(u => {
      const projectRole = Array.isArray(u.projectRoles)
        ? u.projectRoles.find(pr => pr.project?.toString() === selectedProjectId?.toString())
        : null;
      return projectRole; // Only users with roles in this project
    });

    if (searchQuery) {
      filtered = filtered.filter(u => {
        const value = searchField === 'usuario' ? u.username :
                     searchField === 'email' ? u.email :
                     projects.find(p => p._id === selectedProjectId)?.name || '';
        return value.toLowerCase().includes(searchQuery.toLowerCase());
      });
    }

    filtered.sort((a, b) => {
      const aVal = a.username.toLowerCase();
      const bVal = b.username.toLowerCase();
      return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });

    return filtered;
  }, [users, selectedProjectId, searchQuery, searchField, sortOrder, projects]);

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredUsers.length / pageSize);

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
      <div className="mb-3">
        <label className="form-label">Proyecto</label>
        <select
          className="form-select"
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
        >
          {projects.map((project) => (
            <option key={project._id} value={project._id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      {!selectedProject ? (
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
                <th>Rol en proyecto</th>
                <th>Cambiar Rol</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.map((u) => {
                const projectRole = Array.isArray(u.projectRoles)
                  ? u.projectRoles.find((pr) => pr.project?.toString() === selectedProjectId?.toString())
                  : null;
                const currentRole = projectRole?.role || 'invitado';

                return (
                  <tr key={u._id}>
                    <td>{u.username}</td>
                    <td>{u.email}</td>
                    <td>{currentRole}</td>
                    <td>
                      <select
                        className="form-select"
                        value={currentRole}
                        onChange={(e) => handleRoleChange(u.username, e.target.value)}
                      >
                        <option value="invitado">Invitado</option>
                        <option value="usuario">Usuario</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
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