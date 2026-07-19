import { useEffect, useState } from 'react';
import { analyzeProjectHealth, fetchHealthIssues } from '../api.js';

export default function HealthMonitorPanel({ projectId, canRunHealth }) {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analysisMessage, setAnalysisMessage] = useState('');

  useEffect(() => {
    if (!projectId) return;
    fetchHealthIssues(projectId).then((data) => {
      setIssues(data.issues || []);
    }).catch((err) => {
      console.error(err);
      setError(err.response?.data?.error || err.message || 'No se pudo cargar los issues de salud.');
    });
  }, [projectId]);

  const handleRunHealth = async () => {
    if (!projectId || !canRunHealth) return;
    setLoading(true);
    setError('');
    setAnalysisMessage('');

    try {
      const data = await analyzeProjectHealth(projectId);
      setAnalysisMessage(data.analysis || 'Análisis completado.');
      setIssues(data.issue ? [data.issue] : []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'No se pudo ejecutar el análisis de salud.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card shadow-sm">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start mb-3">
          <div>
            <h5 className="card-title">Auto-Healing Health</h5>
            <p className="text-muted mb-0">Detecta inconsistencias estructurales y genera diagnósticos automáticos.</p>
          </div>
          <button className="btn btn-sm btn-outline-primary" onClick={handleRunHealth} disabled={!canRunHealth || loading}>
            {loading ? 'Analizando...' : 'Ejecutar análisis'}
          </button>
        </div>
        {error && <div className="alert alert-danger">{error}</div>}
        {analysisMessage && <div className="alert alert-success">{analysisMessage}</div>}
        <div style={{ maxHeight: 240, overflowY: 'auto' }}>
          {issues.length === 0 ? (
            <div className="text-muted">No hay issues de salud activos.</div>
          ) : (
            issues.map((issue) => (
              <div key={issue.id} className="card mb-2">
                <div className="card-body p-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="badge bg-secondary text-uppercase">{issue.type}</span>
                    <span className={`badge ${issue.severity === 'high' ? 'bg-danger' : issue.severity === 'medium' ? 'bg-warning text-dark' : 'bg-info text-dark'}`}>{issue.severity}</span>
                  </div>
                  <div className="mb-2">{issue.description}</div>
                  {issue.suggestedFix && <div className="text-muted">Fix: {issue.suggestedFix}</div>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
