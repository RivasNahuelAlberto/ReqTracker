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
    return <div className="project-user-management empty-state">Cargando usuarios...</div>;
  }

  return (
    <div className="project-user-management">
      {error && (
        <div className="alert alert-danger alert-dismissible fade show mb-4" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError(null)}></button>
        </div>
      )}

      <div className="card section-card mb-4">
        <div className="card-body">
          <div className="section-toolbar mb-3">
            <div>
              <h5 className="section-title mb-1">Usuarios asignados</h5>
              <p className="section-subtitle mb-0">Revisa y ajusta permisos de acceso para este proyecto.</p>
            </div>
          </div>

          {projectAssignments.length === 0 ? (
            <div className="empty-state">No hay usuarios asignados a este proyecto.</div>
          ) : (
            <div className="table-responsive">
              <table className="table user-management-table align-middle mb-0">
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

      {canCreateUsers && (
        <div className="card section-card mb-4">
          <div className="card-body">
            <div className="section-toolbar mb-3">
              <div>
                <h5 className="section-title mb-1">Asignar usuario existente</h5>
                <p className="section-subtitle mb-0">Agrega alguien ya registrado para que participe del proyecto.</p>
              </div>
            </div>
            <form onSubmit={handleAssignExistingUser}>
              <div className="row gy-3 align-items-end">
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
                <div className="col-md-2">
                  <button type="submit" className="btn btn-primary w-100">
                    Asignar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {canCreateUsers && (
        <div className="card section-card">
          <div className="card-body">
            <div className="section-toolbar mb-3">
              <div>
                <h5 className="section-title mb-1">Crear nuevo usuario</h5>
                <p className="section-subtitle mb-0">Da de alta un participante con acceso inmediato al proyecto.</p>
              </div>
              <button className="btn btn-sm btn-primary" onClick={() => setShowCreateModal(true)}>
                Crear Usuario
              </button>
            </div>

            {showCreateModal && (
              <div className="modal show d-block" tabIndex="-1" role="dialog">
                <div className="modal-dialog" role="document">
                  <div className="modal-content">
                    <div className="modal-header">
                      <h5 className="modal-title">Crear Nuevo Usuario</h5>
                      <button type="button" className="btn-close" onClick={() => setShowCreateModal(false)}></button>
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
                            onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
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
                            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
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
                            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                            required
                          />
                        </div>
                        <div className="mb-3">
                          <label htmlFor="newRole" className="form-label">Rol Inicial</label>
                          <select
                            className="form-select"
                            id="newRole"
                            value={newUser.role}
                            onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                          >
                            <option value="invitado">Invitado</option>
                            <option value="usuario">Usuario</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                      </div>
                      <div className="modal-footer">
                        <button type="button" className="btn btn-outline-secondary" onClick={() => setShowCreateModal(false)}>
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
  );
};

export default ProjectUserManagement;