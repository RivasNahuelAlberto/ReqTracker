import React from 'react';
import { useAuth } from './AuthContext';

const ReloadNotification = () => {
  const { reloadNotification, dismissReloadNotification, reloadApp } = useAuth();

  if (!reloadNotification) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      backgroundColor: 'var(--warning)',
      color: 'white',
      padding: '15px',
      borderRadius: '5px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
      zIndex: 1200,
      maxWidth: '300px'
    }}>
      <p style={{ margin: 0, marginBottom: '10px' }}>{reloadNotification.message}</p>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={reloadApp}
          style={{
            backgroundColor: 'var(--success)',
            color: 'white',
            border: 'none',
            padding: '5px 10px',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          Recargar
        </button>
        <button
          onClick={dismissReloadNotification}
          style={{
            backgroundColor: 'var(--danger)',
            color: 'white',
            border: 'none',
            padding: '5px 10px',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          Ignorar
        </button>
      </div>
    </div>
  );
};

export default ReloadNotification;