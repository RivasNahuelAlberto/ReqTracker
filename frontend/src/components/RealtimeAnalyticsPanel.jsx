import React from 'react';
import { useAuth } from './AuthContext.jsx';

export default function RealtimeAnalyticsPanel() {
  const { analyticsEvents } = useAuth();

  return (
    <div className="realtime-analytics-panel card shadow-sm mb-3">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h2>📡 Realtime Analytics Events</h2>
            <p className="text-muted mb-0">Eventos generados por el motor analytics y actualización de modelos en tiempo real.</p>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-sm table-hover mb-0">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Evento</th>
                <th>Mensaje</th>
                <th>Detalles</th>
              </tr>
            </thead>
            <tbody>
              {analyticsEvents?.length > 0 ? (
                analyticsEvents.map((event, index) => (
                  <tr key={`${event.eventType}-${event.timestamp}-${index}`}>
                    <td>{new Date(event.timestamp).toLocaleTimeString()}</td>
                    <td>{event.eventType}</td>
                    <td>{event.message}</td>
                    <td>
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', maxHeight: '120px', overflow: 'auto' }}>
                        {JSON.stringify(event.payload || {}, null, 2)}
                      </pre>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="text-center text-muted">
                    No hay eventos de analytics recientes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
