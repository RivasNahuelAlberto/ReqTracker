import React, { useState } from 'react';
import { 
  qualityScore, 
  similarityScore, 
  getAnalyticsRecommendations, 
  predictImpact, 
  checkConsistency 
} from '../api.js';
import './AdvancedAnalyticsPanel.css';

const AdvancedAnalyticsPanel = ({ projectId }) => {
  const [activeTab, setActiveTab] = useState('quality');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  // --- Quality Tab ---
  const [qualityText, setQualityText] = useState('El sistema debería responder rápidamente.');
  const handleQuality = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await qualityScore(qualityText, projectId);
      setResults(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Similarity Tab ---
  const [text1, setText1] = useState('El sistema debe permitir login.');
  const [text2, setText2] = useState('El usuario puede autenticarse.');
  const handleSimilarity = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await similarityScore(text1, text2, 0.85, projectId);
      setResults(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Recommendation Tab ---
  const [recText, setRecText] = useState('Reset de contraseña');
  const handleRecommendation = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAnalyticsRecommendations(recText, 5, projectId);
      setResults(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Impact Tab ---
  const [impactText, setImpactText] = useState('Cambiar la política de contraseñas');
  const handleImpact = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await predictImpact(impactText, projectId);
      setResults(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Consistency Tab ---
  const [consText, setConsText] = useState('Password mínima 8 chars\nPassword mínima 12 chars');
  const handleConsistency = async () => {
    setLoading(true);
    setError(null);
    try {
      const reqs = consText.split('\n').filter(line => line.trim());
      const data = await checkConsistency(reqs, projectId);
      setResults(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="advanced-analytics-panel">
      <h2>🧠 Advanced AI/ML Analytics</h2>
      
      <div className="tabs-header">
        {['quality', 'similarity', 'recommendation', 'impact', 'consistency'].map(tab => (
          <button
            key={tab}
            className={`tab-button ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {/* Quality Tab */}
        {activeTab === 'quality' && (
          <div className="tab-pane">
            <h3>📊 Quality Score</h3>
            <p className="help-text">Analiza la calidad de un requisito (ambigüedad, atomicidad, métricas)</p>
            <textarea
              value={qualityText}
              onChange={(e) => setQualityText(e.target.value)}
              placeholder="Ingresa un requisito..."
              rows={3}
            />
            <button onClick={handleQuality} disabled={loading}>
              {loading ? 'Analizando...' : 'Analizar Calidad'}
            </button>
            {results?.quality_score !== undefined && (
              <div className="results">
                <div className="score-box">
                  <span className="label">Quality Score:</span>
                  <span className="value">{(results.quality_score * 100).toFixed(1)}%</span>
                </div>
                <div className="score-box">
                  <span className="label">Ambiguity:</span>
                  <span className="value">{(results.ambiguity_score * 100).toFixed(1)}%</span>
                </div>
                <div className="score-box">
                  <span className="label">Atomicity:</span>
                  <span className="value">{(results.atomicity_score * 100).toFixed(1)}%</span>
                </div>
                {results.problems?.length > 0 && (
                  <div className="problems">
                    <strong>Problemas detectados:</strong>
                    <ul>
                      {results.problems.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Similarity Tab */}
        {activeTab === 'similarity' && (
          <div className="tab-pane">
            <h3>🔗 Similarity Analysis</h3>
            <p className="help-text">Compara la similitud entre dos requisitos (semántica, tokens, entidades)</p>
            <textarea
              value={text1}
              onChange={(e) => setText1(e.target.value)}
              placeholder="Requisito 1..."
              rows={2}
            />
            <textarea
              value={text2}
              onChange={(e) => setText2(e.target.value)}
              placeholder="Requisito 2..."
              rows={2}
            />
            <button onClick={handleSimilarity} disabled={loading}>
              {loading ? 'Comparando...' : 'Comparar Similitud'}
            </button>
            {results?.combined_similarity !== undefined && (
              <div className="results">
                <div className="score-box">
                  <span className="label">Similitud Combinada:</span>
                  <span className="value">{(results.combined_similarity * 100).toFixed(1)}%</span>
                </div>
                <div className="score-box">
                  <span className="label">Semántica:</span>
                  <span className="value">{(results.semantic_similarity * 100).toFixed(1)}%</span>
                </div>
                <div className="score-box">
                  <span className="label">Tokens:</span>
                  <span className="value">{(results.token_similarity * 100).toFixed(1)}%</span>
                </div>
                <div className="score-box">
                  <span className="label">Entidades:</span>
                  <span className="value">{(results.entity_similarity * 100).toFixed(1)}%</span>
                </div>
                {results.is_duplicate && (
                  <div className="alert alert-warning">
                    ⚠️ Posible duplicado detectado
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Recommendation Tab */}
        {activeTab === 'recommendation' && (
          <div className="tab-pane">
            <h3>💡 Recommendations</h3>
            <p className="help-text">Sugiere requisitos relacionados basados en dominio y contexto</p>
            <textarea
              value={recText}
              onChange={(e) => setRecText(e.target.value)}
              placeholder="Requisito para analizar..."
              rows={3}
            />
            <button onClick={handleRecommendation} disabled={loading}>
              {loading ? 'Recomendando...' : 'Obtener Recomendaciones'}
            </button>
            {results?.recommendations?.length > 0 && (
              <div className="results">
                <strong>Requisitos Recomendados:</strong>
                <ul className="recommendations-list">
                  {results.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
                {results.context?.length > 0 && (
                  <div className="context">
                    <strong>Contexto (Entidades):</strong>
                    <ul>
                      {results.context.map((ctx, i) => (
                        <li key={i}>{ctx.text} ({ctx.label})</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Impact Tab */}
        {activeTab === 'impact' && (
          <div className="tab-pane">
            <h3>⚡ Impact Prediction</h3>
            <p className="help-text">Predice módulos afectados y riesgo de cambios</p>
            <textarea
              value={impactText}
              onChange={(e) => setImpactText(e.target.value)}
              placeholder="Descripción del cambio..."
              rows={3}
            />
            <button onClick={handleImpact} disabled={loading}>
              {loading ? 'Prediciendo...' : 'Predecir Impacto'}
            </button>
            {results?.impacted_modules && (
              <div className="results">
                <div className="score-box">
                  <span className="label">Risk Score:</span>
                  <span className={`value risk-${Math.round(results.risk_score * 10)}`}>
                    {(results.risk_score * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="score-box">
                  <span className="label">Complexity:</span>
                  <span className="value">{(results.complexity_score * 100).toFixed(1)}%</span>
                </div>
                <div className="modules">
                  <strong>Módulos Afectados:</strong>
                  <ul>
                    {results.impacted_modules.map((mod, i) => (
                      <li key={i}>{mod}</li>
                    ))}
                  </ul>
                </div>
                {results.risk_factors?.length > 0 && (
                  <div className="risk-factors">
                    <strong>Factores de Riesgo:</strong>
                    <ul>
                      {results.risk_factors.map((factor, i) => (
                        <li key={i}>{factor}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Consistency Tab */}
        {activeTab === 'consistency' && (
          <div className="tab-pane">
            <h3>✅ Consistency Check</h3>
            <p className="help-text">Detecta conflictos y contradicciones entre requisitos</p>
            <textarea
              value={consText}
              onChange={(e) => setConsText(e.target.value)}
              placeholder="Requisitos (uno por línea)..."
              rows={4}
            />
            <button onClick={handleConsistency} disabled={loading}>
              {loading ? 'Verificando...' : 'Verificar Consistencia'}
            </button>
            {results?.is_consistent !== undefined && (
              <div className="results">
                {results.is_consistent ? (
                  <div className="alert alert-success">
                    ✅ Los requisitos son consistentes
                  </div>
                ) : (
                  <div className="alert alert-danger">
                    ❌ Se detectaron conflictos
                  </div>
                )}
                {results.conflicts?.length > 0 && (
                  <div className="conflicts">
                    <strong>Conflictos Detectados:</strong>
                    {results.conflicts.map((conflict, i) => (
                      <div key={i} className="conflict-item">
                        <p><strong>Tipo:</strong> {conflict.type}</p>
                        {conflict.req1_idx !== undefined && (
                          <>
                            <p><strong>Req 1:</strong> {results.input?.[conflict.req1_idx] || 'N/A'}</p>
                            <p><strong>Req 2:</strong> {results.input?.[conflict.req2_idx] || 'N/A'}</p>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {results.contradiction_pairs?.length > 0 && (
                  <div className="pairs">
                    <strong>Pares Similares (Potencial Duplicado):</strong>
                    {results.contradiction_pairs.map((pair, i) => (
                      <div key={i} className="pair-item">
                        <p>Similitud: {(pair.similarity * 100).toFixed(1)}%</p>
                        <p>"{pair.req1}"</p>
                        <p>"{pair.req2}"</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="alert alert-danger">
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
};

export default AdvancedAnalyticsPanel;
