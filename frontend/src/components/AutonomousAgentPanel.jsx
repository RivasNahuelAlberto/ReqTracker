import { useState } from 'react';
import { runAgent } from '../api.js';

export default function AutonomousAgentPanel({ projectId, canRunAgent }) {
  const [goal, setGoal] = useState('');
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRunAgent = async () => {
    if (!projectId || !goal.trim()) {
      setError('Definí un objetivo antes de ejecutar el agente.');
      return;
    }
    if (!canRunAgent) return;

    setLoading(true);
    setError('');
    setTask(null);

    try {
      const result = await runAgent(projectId, goal.trim());
      setTask(result.task);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'No se pudo ejecutar el agente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card shadow-sm">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start mb-3">
          <div>
            <h5 className="card-title">Autonomous Agent</h5>
            <p className="text-muted mb-0">Planteá un objetivo y deja que el agente genere un plan ejecutable.</p>
          </div>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <div className="mb-3">
          <textarea
            className="form-control"
            rows={3}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Describe el objetivo del agente..."
          />
        </div>

        <button className="btn btn-primary" onClick={handleRunAgent} disabled={!canRunAgent || loading}>
          {loading ? 'Ejecutando agente...' : 'Ejecutar agente'}
        </button>

        {task && (
          <div className="mt-3">
            <h6>Resultado del agent</h6>
            <div className="alert alert-secondary">
              <div><strong>Estado:</strong> {task.status}</div>
              <div><strong>Objetivo:</strong> {task.goal}</div>
              <div><strong>Pasos:</strong></div>
              <ol>
                {task.steps?.map((step, index) => (
                  <li key={index}>
                    <div>{step.description}</div>
                    <div className="small text-muted">Tool: {step.tool} | Estado: {step.status}</div>
                    {step.error && <div className="text-danger">Error: {step.error}</div>}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
