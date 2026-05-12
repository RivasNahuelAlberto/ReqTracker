import Project from '../../models/Project.js';
import SymbolModel from '../../models/Symbol.js';
import { getProjectSummary } from './relations.tool.js';

export async function getProjectSnapshot({ projectId }) {
  if (!projectId) {
    throw new Error('projectId es obligatorio para obtener el snapshot del proyecto.');
  }

  const project = await Project.findById(projectId).lean();
  if (!project) {
    throw new Error('Proyecto no encontrado.');
  }

  const summary = await getProjectSummary({ projectId });
  const symbols = await SymbolModel.find({ project: projectId }).sort({ createdAt: 1 }).limit(12).lean();

  return {
    projectId: project._id.toString(),
    name: project.name,
    about: project.about || { intro: '', items: [] },
    counts: {
      symbols: summary.symbols.count,
      requirements: summary.requirements.count,
      scenarios: summary.scenarios.count,
      inspections: summary.inspections.count,
      tasks: summary.tasks.count,
      relations: summary.relations.count
    },
    sampleSymbols: symbols.map((symbol) => ({
      id: symbol._id.toString(),
      name: symbol.name,
      type: symbol.type,
      notion: symbol.notion || '',
      impact: symbol.impact || ''
    })),
    sampleRequirements: (project.requirements || []).slice(0, 10).map((requirement) => ({
      id: requirement._id?.toString(),
      name: requirement.name,
      description: requirement.description || '',
      basis: requirement.basis || ''
    })),
    recentTasks: (project.tasks || []).slice(-5).map((task) => ({
      id: task._id?.toString(),
      description: task.description,
      targetType: task.targetType,
      targetLabel: task.targetLabel || ''
    }))
  };
}
