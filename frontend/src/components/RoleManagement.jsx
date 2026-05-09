import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { getUsers, assignRole } from '../api';

const RoleManagement = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user?.role === 'super_admin') {
      loadUsers();
    }
  }, [user]);

  const loadUsers = async () => {
    try {
      const data = await getUsers();
      setUsers(data.users);
    } catch (err) {
      setError('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (username, newRole) => {
    try {
      await assignRole(username, newRole);
      await loadUsers(); // Reload users to show updated roles
    } catch (err) {
      setError('Error al asignar rol');
    }
  };

  if (user?.role !== 'super_admin') {
    return <div>No tienes permisos para acceder a esta sección.</div>;
  }

  if (loading) return <div>Cargando...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h2>Administración de Roles</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#f5f5f5' }}>
            <th style={{ padding: '10px', border: '1px solid #ddd' }}>Usuario</th>
            <th style={{ padding: '10px', border: '1px solid #ddd' }}>Email</th>
            <th style={{ padding: '10px', border: '1px solid #ddd' }}>Rol Actual</th>
            <th style={{ padding: '10px', border: '1px solid #ddd' }}>Cambiar Rol</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u._id}>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}>{u.username}</td>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}>{u.email}</td>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}>{u.role}</td>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                <select
                  value={u.role}
                  onChange={(e) => handleRoleChange(u.username, e.target.value)}
                  style={{ padding: '5px' }}
                >
                  <option value="invitado">Invitado</option>
                  <option value="usuario">Usuario</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RoleManagement;