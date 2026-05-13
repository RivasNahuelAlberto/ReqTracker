import { useState } from 'react';
import { compareEntities, analyzeText, generateEmbeddings, compareRequirements, getAnalyticsHealth, getAnalyticsInfo, getAnalyticsHistory, getAnalyticsStats, cleanAnalyticsCache } from '../api.js';

export default function AnalyticsPanel({ projectId }) {
  const [activeTab, setActiveTab] = useState('health');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // Form states
  const [entity1, setEntity1] = useState('');
  const [entity2, setEntity2] = useState('');
  const [text, setText] = useState('');
  const [analysisType, setAnalysisType] = useState('entities');
  const [texts, setTexts] = useState('');
  const [requirement1, setRequirement1] = useState('');
  const [requirement2, setRequirement2] = useState('');

  const handleHealthCheck = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAnalyticsHealth();
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInfoCheck = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAnalyticsInfo();
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCompareEntities = async () => {
    if (!entity1 || !entity2) {
      setError('Por favor ingresa ambas entidades');
      return;
    }
    setLoading(true);
    setError('');
    try {
        const data = await compareEntities(entity1, entity2, projectId);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeText = async () => {
    if (!text) {
      setError('Por favor ingresa un texto para analizar');
      return;
    }
    setLoading(true);
    setError('');
    try {
        const data = await analyzeText(text, analysisType, projectId);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateEmbeddings = async () => {
    if (!texts) {
      setError('Por favor ingresa textos para generar embeddings');
      return;
    }
    const textsArray = texts.split('\n').filter(t => t.trim());
    if (textsArray.length === 0) {
      setError('Por favor ingresa al menos un texto');
      return;
    }
    setLoading(true);
    setError('');
    try {
        const data = await generateEmbeddings(textsArray, projectId);
    } finally {
      setLoading(false);
    }
  };

  const handleCompareRequirements = async () => {
    if (!requirement1 || !requirement2) {
      setError('Por favor ingresa ambos requerimientos');
      return;
    }
    setLoading(true);
    setError('');
    try {
        const data = await compareRequirements(requirement1, requirement2, projectId);
    } finally {
      setLoading(false);
    }
  };

  const handleGetHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAnalyticsHistory({ projectId });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGetStats = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAnalyticsStats();
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCleanCache = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await cleanAnalyticsCache();
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderResultDisplay = () => {
    if (!result) return null;

    if (activeTab === 'history' && result.results) {
      return (
        <div className="mt-3">
          <h6>Historial de análisis</h6>
          <div className="table-responsive">
            <table className="table table-sm table-hover">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Proyecto</th>
                  <th>Estado</th>
                  <th>Tiempo ms</th>
                </tr>
              </thead>
              <tbody>
                {result.results.map((item) => (
                  <tr key={item._id || item.id}>
                    <td>{new Date(item.metadata.timestamp).toLocaleString()}</td>
                    <td>{item.analysisType}</td>
                    <td>{item.metadata.projectId?.name || 'N/A'}</td>
                    <td>{item.metadata.status}</td>
                    <td>{item.metadata.processingTime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-muted">
            Página {result.pagination?.page} de {result.pagination?.pages} · Total {result.pagination?.total}
          </div>
        </div>
      );
    }

    if (activeTab === 'stats' && result.stats) {
      return (
        <div className="mt-3">
          <h6>Estadísticas de análisis</h6>
          <div className="row gy-2">
            {result.stats.map((stat) => (
              <div className="col-12 col-md-6" key={stat._id}>
                <div className="card border-secondary p-3">
                  <div className="fw-bold">{stat._id}</div>
                  <div>Total: {stat.total}</div>
                  <div>Correctos: {stat.successful}</div>
                  <div>Fallidos: {stat.failed}</div>
                  <div>Tiempo promedio: {Math.round(stat.avgProcessingTime)} ms</div>
                  <div>Último análisis: {new Date(stat.lastAnalysis).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="mt-3">
        <h6>Resultado:</h6>
        <pre
          className="bg-light p-3 rounded"
          style={{
            maxHeight: '400px',
            overflow: 'auto',
            fontSize: '0.9em'
          }}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'health':
        return (
          <div className="p-3">
            <h6>Estado del Servicio Analytics</h6>
            <button
              className="btn btn-primary me-2"
              onClick={handleHealthCheck}
              disabled={loading}
            >
              {loading ? 'Verificando...' : 'Verificar Health'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleInfoCheck}
              disabled={loading}
            >
              {loading ? 'Cargando...' : 'Ver Información'}
            </button>
          </div>
        );

      case 'entities':
        return (
          <div className="p-3">
            <h6>Comparar Entidades</h6>
            <div className="mb-3">
              <label className="form-label">Entidad 1</label>
              <input
                type="text"
                className="form-control"
                value={entity1}
                onChange={(e) => setEntity1(e.target.value)}
                placeholder="Ej: usuario, sistema, base de datos"
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Entidad 2</label>
              <input
                type="text"
                className="form-control"
                value={entity2}
                onChange={(e) => setEntity2(e.target.value)}
                placeholder="Ej: cliente, aplicación, servidor"
              />
            </div>
            <button
              className="btn btn-success"
              onClick={handleCompareEntities}
              disabled={loading}
            >
              {loading ? 'Comparando...' : 'Comparar Entidades'}
            </button>
          </div>
        );

      case 'text':
        return (
          <div className="p-3">
            <h6>Analizar Texto</h6>
            <div className="mb-3">
              <label className="form-label">Tipo de análisis</label>
              <select
                className="form-select"
                value={analysisType}
                onChange={(e) => setAnalysisType(e.target.value)}
              >
                <option value="entities">Entidades</option>
                <option value="keywords">Keywords</option>
                <option value="sentiment">Sentimiento</option>
                <option value="summary">Resumen</option>
                <option value="topics">Topic Modeling</option>
                <option value="all">Todo</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="form-label">Texto a analizar</label>
              <textarea
                className="form-control"
                rows="4"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Ingresa el texto que quieres analizar"
              />
            </div>
            <button
              className="btn btn-info"
              onClick={handleAnalyzeText}
              disabled={loading}
            >
              {loading ? 'Analizando...' : 'Analizar Texto'}
            </button>
          </div>
        );

      case 'embeddings':
        return (
          <div className="p-3">
            <h6>Generar Embeddings</h6>
            <div className="mb-3">
              <label className="form-label">Textos (uno por línea)</label>
              <textarea
                className="form-control"
                rows="6"
                value={texts}
                onChange={(e) => setTexts(e.target.value)}
                placeholder="Texto 1&#10;Texto 2&#10;Texto 3"
              />
            </div>
            <button
              className="btn btn-warning"
              onClick={handleGenerateEmbeddings}
              disabled={loading}
            >
              {loading ? 'Generando...' : 'Generar Embeddings'}
            </button>
          </div>
        );

      case 'requirements':
        return (
          <div className="p-3">
            <h6>Comparar Requerimientos</h6>
            <div className="mb-3">
              <label className="form-label">Requerimiento 1</label>
              <textarea
                className="form-control"
                rows="3"
                value={requirement1}
                onChange={(e) => setRequirement1(e.target.value)}
                placeholder="El sistema debe permitir login de usuarios"
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Requerimiento 2</label>
              <textarea
                className="form-control"
                rows="3"
                value={requirement2}
                onChange={(e) => setRequirement2(e.target.value)}
                placeholder="Los usuarios podrán autenticarse en la aplicación"
              />
            </div>
            <button
              className="btn btn-dark"
              onClick={handleCompareRequirements}
              disabled={loading}
            >
              {loading ? 'Comparando...' : 'Comparar Requerimientos'}
            </button>
          </div>
        );

      case 'history':
        return (
          <div className="p-3">
            <h6>Historial de Análisis</h6>
            <p className="text-muted">Ver todos los análisis realizados anteriormente</p>
            <button
              className="btn btn-secondary"
              onClick={handleGetHistory}
              disabled={loading}
            >
              {loading ? 'Cargando...' : 'Ver Historial'}
            </button>
          </div>
        );

      case 'stats':
        return (
          <div className="p-3">
            <h6>Estadísticas de Análisis</h6>
            <p className="text-muted">Ver estadísticas de uso del servicio de analytics</p>
            <div className="d-flex gap-2">
              <button
                className="btn btn-info"
                onClick={handleGetStats}
                disabled={loading}
              >
                {loading ? 'Cargando...' : 'Ver Estadísticas'}
              </button>
              <button
                className="btn btn-warning"
                onClick={handleCleanCache}
                disabled={loading}
              >
                {loading ? 'Limpiando...' : 'Limpiar Cache'}
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="card shadow-sm">
      <div className="card-header">
        <h5 className="card-title mb-0">Analytics IA/NLP</h5>
      </div>
      <div className="card-body">
        {/* Tabs */}
        <ul className="nav nav-tabs mb-3">
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'health' ? 'active' : ''}`}
              onClick={() => setActiveTab('health')}
            >
              Estado
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'entities' ? 'active' : ''}`}
              onClick={() => setActiveTab('entities')}
            >
              Entidades
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'text' ? 'active' : ''}`}
              onClick={() => setActiveTab('text')}
            >
              Texto
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'embeddings' ? 'active' : ''}`}
              onClick={() => setActiveTab('embeddings')}
            >
              Embeddings
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'requirements' ? 'active' : ''}`}
              onClick={() => setActiveTab('requirements')}
            >
              Requerimientos
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              Historial
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'stats' ? 'active' : ''}`}
              onClick={() => setActiveTab('stats')}
            >
              Estadísticas
            </button>
          </li>
        </ul>

        {/* Tab Content */}
        {renderTabContent()}

        {/* Error Display */}
        {error && (
          <div className="alert alert-danger mt-3">
            <strong>Error:</strong> {error}
          </div>
        )}

        {renderResultDisplay()}
      </div>
    </div>
  );
}