import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { fetchProjectUsers, assignRole, removeUserProjectRole, createUserInProject } from '../api.js';

const ProjectUserManagement = ({ projectId }) => {
  const { user } = useAuth();
  const [projectUsers, setProjectUsers] = useState([]);
  const [existingUsername, setExistingUsername] = useState('');
  const [existingRole, setExistingRole] = useState('usuario');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '', role: 'invitado' });

  useEffect(() => {
    if (user && projectId) {
      loadProjectUsers();
    }
  }, [user, projectId]);

  const loadProjectUsers = async () => {
    try {
      const data = await fetchProjectUsers(projectId);
      setProjectUsers(data.users || []);
    } catch (err) {
      setError('Error al cargar usuarios del proyecto');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (username, newRole) => {
    try {
      await assignRole(username, newRole, projectId);
      await loadProjectUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al asignar rol');
    }
  };

  const handleAssignExistingUser = async (e) => {
    e.preventDefault();
    if (!existingUsername.trim()) {
      setError('Username es obligatorio.');
      return;
    }

    try {
      await assignRole(existingUsername.trim(), existingRole, projectId);
      setExistingUsername('');
      setExistingRole('usuario');
      setError(null);
      await loadProjectUsers();
    } catch (err) {
      const status = err.response?.status;
      const serverMessage = err.response?.data?.error || err.response?.data?.message;
      if (status === 404) {
        setError('Usuario inexistente. Verifica el nombre y vuelve a intentar.');
      } else {
        setError(serverMessage || 'Error al asignar el rol al usuario.');
      }
    }
  };

  const handleRemoveRole = async (username) => {
    try {
      await removeUserProjectRole(username, projectId);
      await loadProjectUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al eliminar el rol asignado.');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();

    try {
      await createUserInProject(newUser.username, newUser.email, newUser.password, newUser.role, projectId);
      setNewUser({ username: '', email: '', password: '', role: 'invitado' });
      setShowCreateModal(false);
      await loadProjectUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Error al crear usuario');
    }
  };

  const canCreateUsers = useMemo(() => {
    if (user?.role === 'super_admin') return true;
    const projectRole = user?.projectRoles?.find(pr => pr.project?.toString() === projectId?.toString());
    return projectRole?.role === 'admin';
  }, [user, projectId]);

  const projectAssignments = useMemo(() => {
    return projectUsers.map((userItem) => ({
      userId: userItem.id,
      username: userItem.username,
      email: userItem.email,
      projectRole: userItem.role
    }));
  }, [projectUsers]);

  if (loading) {
    return <div className="text-center p-4">Cargando usuarios...</div>;
  }

  return (
    <div className="container-fluid">
      <div className="row">
        <div className="col-12">
          <h4>Usuarios del Proyecto</h4>

          {error && (
            <div className="alert alert-danger alert-dismissible fade show" role="alert">
              {error}
              <button type="button" className="btn-close" onClick={() => setError(null)}></button>
            </div>
          )}

          {/* Lista de usuarios asignados */}
          <div className="card mb-4">
            <div className="card-header">
              <h5>Usuarios Asignados</h5>
            </div>
            <div className="card-body">
              {projectAssignments.length === 0 ? (
                <p>No hay usuarios asignados a este proyecto.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-striped">
                    <thead>
                      <tr>
                        <th>Usuario</th>
                        <th>Email</th>
                        <th>Rol en Proyecto</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectAssignments.map((assignment) => (
                        <tr key={`${assignment.userId}-${assignment.projectRole}`}>
                          <td>{assignment.username}</td>
                          <td>{assignment.email}</td>
                          <td>
                            <select
                              className="form-select form-select-sm"
                              value={assignment.projectRole}
                              onChange={(e) => handleRoleChange(assignment.username, e.target.value)}
                              disabled={!canCreateUsers}
                            >
                              <option value="invitado">Invitado</option>
                              <option value="usuario">Usuario</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                          <td>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleRemoveRole(assignment.username)}
                              disabled={!canCreateUsers}
                            >
                              Remover
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Asignar usuario existente */}
          {canCreateUsers && (
            <div className="card mb-4">
              <div className="card-header">
                <h5>Asignar Usuario Existente</h5>
              </div>
              <div className="card-body">
                <form onSubmit={handleAssignExistingUser}>
                  <div className="row">
                    <div className="col-md-6">
                      <label htmlFor="existingUsername" className="form-label">Nombre de Usuario</label>
                      <input
                        type="text"
                        className="form-control"
                        id="existingUsername"
                        value={existingUsername}
                        onChange={(e) => setExistingUsername(e.target.value)}
                        placeholder="Ingresa el nombre de usuario"
                        required
                      />
                    </div>
                    <div className="col-md-4">
                      <label htmlFor="existingRole" className="form-label">Rol</label>
                      <select
                        className="form-select"
                        id="existingRole"
                        value={existingRole}
                        onChange={(e) => setExistingRole(e.target.value)}
                      >
                        <option value="invitado">Invitado</option>
                        <option value="usuario">Usuario</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div className="col-md-2 d-flex align-items-end">
                      <button type="submit" className="btn btn-primary w-100">
                        Asignar
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Crear nuevo usuario */}
          {canCreateUsers && (
            <div className="card">
              <div className="card-header">
                <h5>Crear Nuevo Usuario</h5>
              </div>
              <div className="card-body">
                <button
                  className="btn btn-success mb-3"
                  onClick={() => setShowCreateModal(true)}
                >
                  Crear Usuario
                </button>

                {showCreateModal && (
                  <div className="modal show d-block" tabIndex="-1">
                    <div className="modal-dialog">
                      <div className="modal-content">
                        <div className="modal-header">
                          <h5 className="modal-title">Crear Nuevo Usuario</h5>
                          <button
                            type="button"
                            className="btn-close"
                            onClick={() => setShowCreateModal(false)}
                          ></button>
                        </div>
                        <form onSubmit={handleCreateUser}>
                          <div className="modal-body">
                            <div className="mb-3">
                              <label htmlFor="newUsername" className="form-label">Nombre de Usuario</label>
                              <input
                                type="text"
                                className="form-control"
                                id="newUsername"
                                value={newUser.username}
                                onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                                required
                              />
                            </div>
                            <div className="mb-3">
                              <label htmlFor="newEmail" className="form-label">Email</label>
                              <input
                                type="email"
                                className="form-control"
                                id="newEmail"
                                value={newUser.email}
                                onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                                required
                              />
                            </div>
                            <div className="mb-3">
                              <label htmlFor="newPassword" className="form-label">Contraseña</label>
                              <input
                                type="password"
                                className="form-control"
                                id="newPassword"
                                value={newUser.password}
                                onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                                required
                              />
                            </div>
                            <div className="mb-3">
                              <label htmlFor="newRole" className="form-label">Rol Inicial</label>
                              <select
                                className="form-select"
                                id="newRole"
                                value={newUser.role}
                                onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                              >
                                <option value="invitado">Invitado</option>
                                <option value="usuario">Usuario</option>
                                <option value="admin">Admin</option>
                              </select>
                            </div>
                          </div>
                          <div className="modal-footer">
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => setShowCreateModal(false)}
                            >
                              Cancelar
                            </button>
                            <button type="submit" className="btn btn-primary">
                              Crear Usuario
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectUserManagement;