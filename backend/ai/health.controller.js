import { getProjectSnapshot } from './tools/projectSnapshot.tool.js';
import { getProjectGraph } from './tools/graph.tool.js';
import { analyzeHealth } from './health.service.js';
import HealthIssue from '../models/HealthIssue.js';

export async function analyzeProjectHealth(req, res) {
  try {
    const { projectId } = req.body;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId es requerido.' });
    }

    const snapshot = await getProjectSnapshot({ projectId });
    const graph = await getProjectGraph({ projectId });
    const analysis = await analyzeHealth({ snapshot, graph });

    const issue = await HealthIssue.findOneAndUpdate(
      { projectId, status: 'open', type: 'architecture_issue' },
      {
        projectId,
        type: 'architecture_issue',
        severity: 'medium',
        description: analysis,
        suggestedFix: 'Revisá el análisis y aplica mejoras según la arquitectura del proyecto.',
        status: 'open'
      },
      { upsert: true, new: true }
    );

    res.json({ analysis, issue });
  } catch (error) {
    console.error('Error en análisis de salud:', error);
    res.status(500).json({ error: error.message || 'Error interno en análisis de salud.' });
  }
}

export async function getHealthIssues(req, res) {
  try {
    const { projectId } = req.params;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId es requerido.' });
    }

    const issues = await HealthIssue.find({ projectId }).sort({ createdAt: -1 }).lean();
    res.json({ issues: issues.map((issue) => ({
      id: issue._id.toString(),
      type: issue.type,
      severity: issue.severity,
      description: issue.description,
      suggestedFix: issue.suggestedFix,
      status: issue.status,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt
    })) });
  } catch (error) {
    console.error('Error obteniendo issues de salud:', error);
    res.status(500).json({ error: error.message || 'Error interno al obtener issues de salud.' });
  }
}
