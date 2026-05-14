import Project from '../../models/Project.js';
import SymbolModel from '../../models/Symbol.js';
import Relation from '../../models/Relation.js';
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
  // Get ALL symbols for complete project analysis (not limited to 12)
  const symbols = await SymbolModel.find({ project: projectId }).sort({ createdAt: 1 }).lean();
  
  // Get ALL requirements for complete project analysis (not limited to 10)
  const allRequirements = project.requirements || [];
  
  // Get ALL relations for complete project analysis
  const relations = await Relation.find({ projectId }).lean();

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
    // Include ALL symbols for comprehensive agent analysis
    symbols: symbols.map((symbol) => ({
      id: symbol._id.toString(),
      name: symbol.name,
      type: symbol.type,
      notion: symbol.notion || '',
      impact: symbol.impact || '',
      embedding: symbol.embedding || null
    })),
    // Include ALL requirements for comprehensive agent analysis
    requirements: allRequirements.map((requirement) => ({
      id: requirement._id?.toString(),
      name: requirement.name,
      description: requirement.description || '',
      basis: requirement.basis || '',
      text: requirement.text || requirement.description || '',
      embedding: requirement.embedding || null
    })),
    // Include scenarios if available
    scenarios: (project.scenarios || []).map((scenario) => ({
      id: scenario._id?.toString(),
      name: scenario.name,
      description: scenario.description || '',
      stepsCount: scenario.steps?.length || 0
    })),
    // Include ALL relations for architecture analysis
    relations: relations.map((rel) => ({
      id: rel._id?.toString(),
      from: {
        id: rel.fromId?.toString(),
        type: rel.fromType,
        label: rel.fromLabel || ''
      },
      to: {
        id: rel.toId?.toString(),
        type: rel.toType,
        label: rel.toLabel || ''
      },
      description: rel.description || '',
      score: rel.score || 0
    })),
    // Summary metrics for architectural awareness
    architectureMetrics: {
      avgSymbolsPerRequirement: allRequirements.length > 0 
        ? Math.round((relations.length / allRequirements.length) * 10) / 10
        : 0,
      avgRelationsPerSymbol: symbols.length > 0
        ? Math.round((relations.length / symbols.length) * 10) / 10
        : 0,
      uniqueRelationTypes: [...new Set(relations.map(r => `${r.fromType}→${r.toType}`))].length,
      highScoreRelations: relations.filter(r => r.score > 0.7).length
    },
    recentTasks: (project.tasks || []).slice(-5).map((task) => ({
      id: task._id?.toString(),
      description: task.description,
      targetType: task.targetType,
      targetLabel: task.targetLabel || ''
    }))
  };
}
