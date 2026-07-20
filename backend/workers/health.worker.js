import Project from '../models/Project.js';
import HealthIssue from '../models/HealthIssue.js';
import { getProjectSnapshot } from '../ai/tools/projectSnapshot.tool.js';
import { getProjectGraph } from '../ai/tools/graph.tool.js';
import { analyzeHealth } from '../ai/health.service.js';

export async function runHealthCycle() {
  const projects = await Project.find().lean();

  for (const project of projects) {
    try {
      const snapshot = await getProjectSnapshot({ projectId: project._id });
      const graph = await getProjectGraph({ projectId: project._id });
      const analysis = await analyzeHealth({ snapshot, graph });

      await HealthIssue.findOneAndUpdate(
        { projectId: project._id, type: 'architecture_issue', status: 'open' },
        {
          projectId: project._id,
          type: 'architecture_issue',
          severity: 'medium',
          description: analysis,
          suggestedFix: 'Revisá el análisis y aplica mejoras según la arquitectura del proyecto.',
          status: 'open'
        },
        { upsert: true }
      );
    } catch (error) {
      console.error(`Health cycle failed for project ${project._id}:`, error);
    }
  }
}
