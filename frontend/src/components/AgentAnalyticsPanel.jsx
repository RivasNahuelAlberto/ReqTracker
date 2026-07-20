/**
 * ETAPA 9: Agent Analytics Panel
 * 
 * Componente React para visualizar análisis específicos de agentes IA
 * - Tool efficiency matrix
 * - Planner confidence scores
 * - Reasoning path visualization
 * - Context pollution detection
 * - Hallucination risk estimation
 */

import React, { useState, useEffect, useCallback } from 'react';
import './AgentAnalyticsPanel.css';

const AgentAnalyticsPanel = ({ projectId, onClose }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [analyses, setAnalyses] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Cargar análisis al montar el componente
  useEffect(() => {
    if (projectId) {
      loadBatchAnalysis();
    }
  }, [projectId]);

  const loadBatchAnalysis = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${import.meta.env.VITE_API_BASE}/api/agent/batch-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          include_tool_efficiency: true,
          include_planner_confidence: true,
          include_reasoning_trace: true,
          include_context_pollution: true,
          include_hallucination_risk: true
        })
      });

      if (!response.ok) throw new Error('Failed to load batch analysis');

      const data = await response.json();
      setAnalyses(data.analyses || {});
    } catch (err) {
      setError(err.message);
      console.error('Error loading batch analysis:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Renderizar Tool Efficiency
  const renderToolEfficiency = () => {
    const data = analyses.tool_efficiency;
    if (!data || error) return <div className="empty-state">No tool efficiency data</div>;

    return (
      <div className="analysis-section tool-efficiency-section">
        <h3>🔧 Tool Efficiency Matrix</h3>
        
        <div className="efficiency-summary">
          <div className="metric-card">
            <span className="metric-label">Overall Efficiency</span>
            <span className={`metric-value ${getEfficiencyColor(data.overall_efficiency)}`}>
              {(data.overall_efficiency * 100).toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="tools-table">
          <table>
            <thead>
              <tr>
                <th>Tool</th>
                <th>Latency (ms)</th>
                <th>Quality</th>
                <th>Hallucination</th>
                <th>Usage</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.tools || {}).map(([toolName, metrics]) => (
                <tr key={toolName}>
                  <td className="tool-name">{toolName}</td>
                  <td>{metrics.latency_ms.toFixed(0)}ms</td>
                  <td>
                    <div className="quality-bar">
                      <div
                        className={`quality-fill ${getQualityClass(metrics.avg_result_quality)}`}
                        style={{ width: `${metrics.avg_result_quality * 100}%` }}
                      />
                      <span>{(metrics.avg_result_quality * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className={`hallucination-rate ${getHallucinationClass(metrics.hallucination_rate)}`}>
                    {(metrics.hallucination_rate * 100).toFixed(1)}%
                  </td>
                  <td>{metrics.frequency}x</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.recommendations && data.recommendations.length > 0 && (
          <div className="recommendations">
            <h4>Recommendations:</h4>
            <ul>
              {data.recommendations.map((rec, idx) => (
                <li key={idx}>{rec}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  // Renderizar Planner Confidence
  const renderPlannerConfidence = () => {
    const data = analyses.planner_confidence;
    if (!data || error) return <div className="empty-state">No planner confidence data</div>;

    return (
      <div className="analysis-section planner-confidence-section">
        <h3>📋 Planner Confidence Score</h3>

        <div className="confidence-radar">
          <div className="radar-chart">
            <div className="radar-item">
              <span className="radar-label">Confidence</span>
              <div className="radar-value" style={{ '--value': data.confidence }}>
                <span>{(data.confidence * 100).toFixed(0)}%</span>
              </div>
            </div>
            <div className="radar-item">
              <span className="radar-label">Stability</span>
              <div className="radar-value" style={{ '--value': data.stability }}>
                <span>{(data.stability * 100).toFixed(0)}%</span>
              </div>
            </div>
            <div className="radar-item">
              <span className="radar-label">Predictability</span>
              <div className="radar-value" style={{ '--value': data.predictability }}>
                <span>{(data.predictability * 100).toFixed(0)}%</span>
              </div>
            </div>
            <div className="radar-item">
              <span className="radar-label">Clarity</span>
              <div className="radar-value" style={{ '--value': data.reasoning_clarity }}>
                <span>{(data.reasoning_clarity * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>

          <div className="overall-score">
            <h4>Overall Score</h4>
            <div className={`score-badge ${getScoreClass(data.overall_score)}`}>
              {(data.overall_score * 100).toFixed(0)}%
            </div>
          </div>
        </div>

        {data.issues && data.issues.length > 0 && (
          <div className="issues-list">
            <h4>Issues Detected:</h4>
            <ul>
              {data.issues.map((issue, idx) => (
                <li key={idx} className="issue-item">{issue}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  // Renderizar Reasoning Trace
  const renderReasoningTrace = () => {
    const data = analyses.reasoning_trace;
    if (!data || error) return <div className="empty-state">No reasoning trace data</div>;

    return (
      <div className="analysis-section reasoning-trace-section">
        <h3>🧠 Reasoning Path Visualization</h3>

        {data.summary && (
          <div className="trace-summary">
            <div className="summary-item">
              <span className="label">Steps:</span>
              <span className="value">{data.summary.total_steps}</span>
            </div>
            <div className="summary-item">
              <span className="label">Total Time:</span>
              <span className="value">{data.summary.total_time_ms}ms</span>
            </div>
            <div className="summary-item">
              <span className="label">Tokens:</span>
              <span className="value">{data.summary.total_tokens}</span>
            </div>
            <div className="summary-item">
              <span className="label">Avg Confidence:</span>
              <span className="value">{(data.summary.average_confidence * 100).toFixed(0)}%</span>
            </div>
          </div>
        )}

        {data.reasoning_path && (
          <div className="reasoning-timeline">
            <h4>Execution Timeline:</h4>
            {data.reasoning_path.map((step, idx) => (
              <div key={idx} className="timeline-step">
                <div className="step-number">{idx + 1}</div>
                <div className="step-content">
                  <div className="step-action">{step.action}</div>
                  {step.tool_used && <span className="step-tool">{step.tool_used}</span>}
                  <span className="step-time">{step.time_ms}ms</span>
                </div>
                <div className="step-confidence">
                  <div className="conf-bar">
                    <div
                      className="conf-fill"
                      style={{ width: `${step.confidence * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {data.tools_called && data.tools_called.length > 0 && (
          <div className="tools-used">
            <h4>Tools Called:</h4>
            <div className="tool-tags">
              {data.tools_called.map((tool, idx) => (
                <span key={idx} className="tool-tag">{tool}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Renderizar Context Pollution
  const renderContextPollution = () => {
    const data = analyses.context_pollution;
    if (!data || error) return <div className="empty-state">No context pollution data</div>;

    return (
      <div className="analysis-section context-pollution-section">
        <h3>🔍 Context Pollution Detection</h3>

        <div className="pollution-summary">
          <div className={`pollution-indicator ${data.pollution_detected ? 'detected' : 'clean'}`}>
            <span className="status">{data.pollution_detected ? '⚠️  Pollution Detected' : '✅ Clean'}</span>
            <span className="ratio">{(data.pollution_ratio * 100).toFixed(1)}% irrelevant</span>
          </div>
          <div className="pollution-meter">
            <div className="meter-bar">
              <div
                className={`meter-fill ${getPollutionClass(data.pollution_ratio)}`}
                style={{ width: `${data.pollution_ratio * 100}%` }}
              />
            </div>
          </div>
        </div>

        {data.relevant_chunks && (
          <div className="chunks-info">
            <span className="chunk-stat relevant">
              ✅ {data.relevant_chunks.length} Relevant Chunks
            </span>
            <span className="chunk-stat irrelevant">
              ❌ {data.irrelevant_chunks.length} Irrelevant Chunks
            </span>
          </div>
        )}

        {data.recommendations && data.recommendations.length > 0 && (
          <div className="recommendations">
            <h4>Recommendations:</h4>
            <ul>
              {data.recommendations.map((rec, idx) => (
                <li key={idx}>{rec}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  // Renderizar Hallucination Risk
  const renderHallucinationRisk = () => {
    const data = analyses.hallucination_risk;
    if (!data || error) return <div className="empty-state">No hallucination risk data</div>;

    return (
      <div className="analysis-section hallucination-risk-section">
        <h3>👻 Hallucination Risk Estimation</h3>

        <div className="risk-summary">
          <div className={`risk-badge ${data.risk_level}`}>
            <span className="risk-level">{data.risk_level.toUpperCase()}</span>
            <span className="risk-score">{(data.risk_score * 100).toFixed(1)}%</span>
          </div>
        </div>

        {data.factors && (
          <div className="risk-factors">
            <h4>Risk Factors:</h4>
            <div className="factors-grid">
              <div className="factor-item">
                <span className="factor-label">Coverage</span>
                <div className="factor-bar">
                  <div className="factor-fill" style={{ width: `${data.factors.coverage * 100}%` }} />
                </div>
                <span className="factor-value">{(data.factors.coverage * 100).toFixed(0)}%</span>
              </div>
              <div className="factor-item">
                <span className="factor-label">Context Quality</span>
                <div className="factor-bar">
                  <div className="factor-fill" style={{ width: `${data.factors.context_quality * 100}%` }} />
                </div>
                <span className="factor-value">{(data.factors.context_quality * 100).toFixed(0)}%</span>
              </div>
              <div className="factor-item">
                <span className="factor-label">Semantic Confidence</span>
                <div className="factor-bar">
                  <div className="factor-fill" style={{ width: `${data.factors.semantic_confidence * 100}%` }} />
                </div>
                <span className="factor-value">{(data.factors.semantic_confidence * 100).toFixed(0)}%</span>
              </div>
              <div className="factor-item">
                <span className="factor-label">Retrieval Quality</span>
                <div className="factor-bar">
                  <div className="factor-fill" style={{ width: `${data.factors.retrieval_quality * 100}%` }} />
                </div>
                <span className="factor-value">{(data.factors.retrieval_quality * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>
        )}

        {data.recommendations && data.recommendations.length > 0 && (
          <div className="recommendations">
            <h4>Recommendations:</h4>
            <ul>
              {data.recommendations.map((rec, idx) => (
                <li key={idx}>{rec}</li>
              ))}
            </ul>
          </div>
        )}

        {data.mitigation_strategies && data.mitigation_strategies.length > 0 && (
          <div className="mitigation">
            <h4>Mitigation Strategies:</h4>
            <ul>
              {data.mitigation_strategies.map((strategy, idx) => (
                <li key={idx}>{strategy}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  // Renderizar Overview
  const renderOverview = () => {
    return (
      <div className="overview-section">
        <h3>📊 Agent Analytics Overview</h3>
        <p>Comprehensive analysis of AI agent behavior and performance</p>

        <div className="overview-grid">
          {analyses.tool_efficiency && (
            <div className="overview-card" onClick={() => setActiveTab('tools')}>
              <h4>🔧 Tools</h4>
              <p>{Object.keys(analyses.tool_efficiency.tools || {}).length} tools analyzed</p>
            </div>
          )}
          {analyses.planner_confidence && (
            <div className="overview-card" onClick={() => setActiveTab('planner')}>
              <h4>📋 Planner</h4>
              <p>Score: {(analyses.planner_confidence.overall_score * 100).toFixed(0)}%</p>
            </div>
          )}
          {analyses.reasoning_trace && (
            <div className="overview-card" onClick={() => setActiveTab('reasoning')}>
              <h4>🧠 Reasoning</h4>
              <p>{analyses.reasoning_trace.reasoning_path?.length || 0} steps traced</p>
            </div>
          )}
          {analyses.context_pollution && (
            <div className="overview-card" onClick={() => setActiveTab('context')}>
              <h4>🔍 Context</h4>
              <p>{(analyses.context_pollution.pollution_ratio * 100).toFixed(1)}% pollution</p>
            </div>
          )}
          {analyses.hallucination_risk && (
            <div className="overview-card" onClick={() => setActiveTab('hallucination')}>
              <h4>👻 Risk</h4>
              <p>Risk Level: {analyses.hallucination_risk.risk_level}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Funciones auxiliares para clases CSS
  const getEfficiencyColor = (val) => {
    if (val >= 0.8) return 'high';
    if (val >= 0.6) return 'medium';
    return 'low';
  };

  const getQualityClass = (val) => {
    if (val >= 0.8) return 'quality-high';
    if (val >= 0.5) return 'quality-medium';
    return 'quality-low';
  };

  const getHallucinationClass = (val) => {
    if (val > 0.3) return 'high-hallucination';
    if (val > 0.1) return 'medium-hallucination';
    return 'low-hallucination';
  };

  const getScoreClass = (val) => {
    if (val >= 0.8) return 'score-high';
    if (val >= 0.6) return 'score-medium';
    return 'score-low';
  };

  const getPollutionClass = (val) => {
    if (val > 0.6) return 'pollution-high';
    if (val > 0.3) return 'pollution-medium';
    return 'pollution-low';
  };

  return (
    <div className="agent-analytics-panel">
      <div className="panel-header">
        <h2>🤖 Agent-Specific Analytics</h2>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      {loading && <div className="loading-state">Loading analysis...</div>}
      {error && <div className="error-state">Error: {error}</div>}

      <div className="tabs-navigation">
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab-btn ${activeTab === 'tools' ? 'active' : ''}`}
          onClick={() => setActiveTab('tools')}
        >
          🔧 Tools
        </button>
        <button
          className={`tab-btn ${activeTab === 'planner' ? 'active' : ''}`}
          onClick={() => setActiveTab('planner')}
        >
          📋 Planner
        </button>
        <button
          className={`tab-btn ${activeTab === 'reasoning' ? 'active' : ''}`}
          onClick={() => setActiveTab('reasoning')}
        >
          🧠 Reasoning
        </button>
        <button
          className={`tab-btn ${activeTab === 'context' ? 'active' : ''}`}
          onClick={() => setActiveTab('context')}
        >
          🔍 Context
        </button>
        <button
          className={`tab-btn ${activeTab === 'hallucination' ? 'active' : ''}`}
          onClick={() => setActiveTab('hallucination')}
        >
          👻 Risk
        </button>
      </div>

      <div className="panel-content">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'tools' && renderToolEfficiency()}
        {activeTab === 'planner' && renderPlannerConfidence()}
        {activeTab === 'reasoning' && renderReasoningTrace()}
        {activeTab === 'context' && renderContextPollution()}
        {activeTab === 'hallucination' && renderHallucinationRisk()}
      </div>

      <div className="panel-footer">
        <button className="refresh-btn" onClick={loadBatchAnalysis} disabled={loading}>
          🔄 Refresh
        </button>
      </div>
    </div>
  );
};

export default AgentAnalyticsPanel;
