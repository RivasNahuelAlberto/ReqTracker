import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { getUsers, assignRole, fetchProjects } from '../api.js';

const RoleManagement = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f5f5f5' }}>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>Usuario</th>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>Email</th>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>Rol en proyecto</th>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>Cambiar Rol</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const projectRole = Array.isArray(u.projectRoles)
                ? u.projectRoles.find((pr) => pr.project?.toString() === selectedProjectId?.toString())
                : null;
              const currentRole = projectRole?.role || 'invitado';

              return (
                <tr key={u._id}>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{u.username}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{u.email}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{currentRole}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    <select
                      value={currentRole}
                      onChange={(e) => handleRoleChange(u.username, e.target.value)}
                      style={{ padding: '5px' }}
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
      )}
    </div>
  );
};

export default RoleManagement;