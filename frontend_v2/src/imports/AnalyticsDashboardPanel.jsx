import React, { useState } from 'react';
import { getAnalyticsDashboard, getAnalyticsGraph, getAnalyticsRisk, getAnalyticsSemantic } from '../api.js';

export default function AnalyticsDashboardPanel({ projectId }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hours, setHours] = useState(24);
  const [data, setData] = useState(null);

  const loadData = async (endpoint) => {
    if (!projectId) {
      setError('Project ID is required');
      return;
    }

    setLoading(true);
    setError('');
    setData(null);

    try {
      let response;
      const params = { hours };

      switch (endpoint) {
        case 'graph':
          response = await getAnalyticsGraph(projectId, params);
          break;
        case 'risk':
          response = await getAnalyticsRisk(projectId, params);
          break;
        case 'semantic':
          response = await getAnalyticsSemantic(projectId, params);
          break;
        default:
          response = await getAnalyticsDashboard(projectId, params);
      }
      setData(response);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || err.message || 'Error cargando datos de dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleTabClick = (tab) => {
    setActiveTab(tab);
    loadData(tab);
  };

  const renderSummaryCards = () => {
    if (!data) return null;

    const snapshot = data.snapshot || data.raw_snapshot || {};
    const trends = data.trends || {};
    const alerts = data.alerts || data.active_alerts || [];

    return (
      <div className="row g-3">
        <div className="col-12 col-md-6 col-xl-3">
          <div className="card border-secondary p-3 h-100">
            <div className="text-muted">Meta/Periodo</div>
            <div className="h4 mt-2">{snapshot.summary || snapshot.overview || 'N/A'}</div>
          </div>
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <div className="card border-secondary p-3 h-100">
            <div className="text-muted">Riesgo</div>
            <div className="h4 mt-2">{snapshot.risk_score !== undefined ? `${(snapshot.risk_score * 100).toFixed(1)}%` : 'N/A'}</div>
          </div>
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <div className="card border-secondary p-3 h-100">
            <div className="text-muted">Consistencia</div>
            <div className="h4 mt-2">{snapshot.consistency_score !== undefined ? `${(snapshot.consistency_score * 100).toFixed(1)}%` : 'N/A'}</div>
          </div>
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <div className="card border-secondary p-3 h-100">
            <div className="text-muted">Alertas activas</div>
            <div className="h4 mt-2">{Array.isArray(alerts) ? alerts.length : 'N/A'}</div>
          </div>
        </div>
      </div>
    );
  };

  const renderDataSummary = () => {
    if (!data) return null;

    switch (activeTab) {
      case 'graph':
        return (
          <div>
            <h5>Graph Metrics</h5>
            <pre className="bg-light p-3 rounded" style={{ whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(data.graph_metrics || data.snapshot?.graph_metrics || {}, null, 2)}
            </pre>
          </div>
        );
      case 'risk':
        return (
          <div>
            <h5>Risk Summary</h5>
            <pre className="bg-light p-3 rounded" style={{ whiteSpace: 'pre-wrap' }}>
              {JSON.stringify({
                risk_score: data.risk_score ?? data.snapshot?.risk_score,
                consistency_score: data.consistency_score ?? data.snapshot?.consistency_score,
                trend: data.trend ?? data.trends?.risk_score,
                active_alerts: data.active_alerts || data.alerts || [],
              }, null, 2)}
            </pre>
          </div>
        );
      case 'semantic':
        return (
          <div>
            <h5>Semantic Health</h5>
            <pre className="bg-light p-3 rounded" style={{ whiteSpace: 'pre-wrap' }}>
              {JSON.stringify({
                semantic_health: data.semantic_health ?? data.snapshot?.semantic_health,
                predictions: data.predictions || data.snapshot?.predictions || {},
                quality_history: data.quality_history || data.metrics?.quality_history || [],
                trends: data.trends || {},
              }, null, 2)}
            </pre>
          </div>
        );
      default:
        return (
          <div>
            <h5>Dashboard Snapshot</h5>
            <pre className="bg-light p-3 rounded" style={{ whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        );
    }
  };

  return (
    <div className="analytics-dashboard-panel card shadow-sm mb-3">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start mb-3">
          <div>
            <h2>📈 Analytics Dashboard</h2>
            <p className="text-muted mb-0">Visualiza métricas de dashboard, grafo, riesgos y salud semántica.</p>
          </div>
          <div className="d-flex gap-2 align-items-center">
            <label className="mb-0 small">Horas:</label>
            <input
              type="number"
              min="1"
              max="168"
              value={hours}
              onChange={(e) => setHours(Number(e.target.value) || 24)}
              className="form-control form-control-sm"
              style={{ width: '80px' }}
            />
            <button className="btn btn-outline-primary btn-sm" onClick={() => loadData(activeTab)} disabled={loading}>
              {loading ? 'Actualizando...' : 'Refrescar'}
            </button>
          </div>
        </div>

        <div className="btn-group mb-3" role="group">
          {['dashboard', 'graph', 'risk', 'semantic'].map((tab) => (
            <button
              key={tab}
              type="button"
              className={`btn btn-sm ${activeTab === tab ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => handleTabClick(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {error && (
          <div className="alert alert-danger">
            <strong>Error:</strong> {error}
          </div>
        )}

        {loading && (
          <div className="alert alert-info">Cargando datos de dashboard...</div>
        )}

        {!loading && renderSummaryCards()}

        {!loading && renderDataSummary()}
      </div>
    </div>
  );
}
