import { getProjectSnapshot } from './tools/projectSnapshot.tool.js';
import { getProjectGraph } from './tools/graph.tool.js';
import { analyzeHealth } from './health.service.js';
import HealthIssue from '../models/HealthIssue.js';
import StructuredLogger from './logger/structured.logger.js';

const logger = new StructuredLogger('health-controller');

export async function analyzeProjectHealth(req, res) {
  try {
    const { projectId } = req.body;
    if (!projectId) {
      logger.warn('Invalid request: missing projectId', {});
      return res.status(400).json({ error: 'projectId es requerido.' });
    }

    logger.info('Starting project health analysis', { projectId });

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

    logger.info('Project health analysis completed', { projectId });
    res.json({ analysis, issue });
  } catch (error) {
    logger.error('Project health analysis failed', { 
      projectId: req.body?.projectId,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: error.message || 'Error interno en análisis de salud.' });
  }
}

export async function getHealthIssues(req, res) {
  try {
    const { projectId } = req.params;
    if (!projectId) {
      logger.warn('Invalid request: missing projectId', {});
      return res.status(400).json({ error: 'projectId es requerido.' });
    }

    logger.info('Fetching health issues', { projectId });

    const issues = await HealthIssue.find({ projectId }).sort({ createdAt: -1 }).lean();
    logger.info('Health issues retrieved', { projectId, count: issues.length });

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
    logger.error('Failed to fetch health issues', { 
      projectId: req.params?.projectId,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: error.message || 'Error interno al obtener issues de salud.' });
  }
}
