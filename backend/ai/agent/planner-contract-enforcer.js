/**
 * PLANNER CONTRACT ENFORCER
 * 
 * Validates and enforces the formal contract between:
 * 1. LLM Planner output
 * 2. Execution Plan schema
 * 3. Task model
 * 
 * This is the "single source of truth" that prevents the controller
 * from having to interpret or guess about planner output.
 */

import StructuredLogger from '../logger/structured.logger.js';
import { validateExecutionPlan } from './execution-plan.schema.js';

const logger = new StructuredLogger('planner-contract-enforcer');

/**
 * Parse planner output and enforce contract
 * 
 * Takes raw LLM output, validates it, and produces a normalized execution plan
 * that can be safely passed to executor
 */
export async function enforceAndNormalizePlan(rawPlanText, context) {
  logger.info('🧱 CONTRACT ENFORCEMENT START', {
    planLength: rawPlanText?.length,
    context: {
      projectId: context.projectId,
      goal: context.goal?.substring(0, 100)
    }
  });

  try {
    // Step 1: Parse JSON from LLM output
    let parsedPlan;
    try {
      const jsonMatch = rawPlanText.match(/\{[\s\S]*\}/m);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in planner output');
      }
      parsedPlan = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      logger.error('❌ PARSE FAILED - Invalid JSON from planner', {
        error: parseError.message
      });
      return createErrorPlan('INVALID_GOAL', 'Planner output is not valid JSON');
    }

    const convertedPlan = convertLegacyPlannerOutput(parsedPlan);

    // Step 2: Validate against schema
    const validation = validateExecutionPlan(convertedPlan);
    if (!validation.valid) {
      logger.warn('⚠️ VALIDATION WARNINGS - Recovering with normalization', {
        errors: validation.errors,
        detectedLegacyFormat: convertedPlan !== parsedPlan
      });
    }

    // Step 3: Normalize the plan (fill in required fields)
    const normalizedPlan = normalizePlan(convertedPlan, context);

    logger.info('✅ PLAN NORMALIZED', {
      mode: normalizedPlan.mode,
      goal: normalizedPlan.metadata.inputGoal.substring(0, 100),
      stepCount: normalizedPlan.steps?.length || 0,
      constraints: normalizedPlan.constraints
    });

    return normalizedPlan;
  } catch (error) {
    logger.error('❌ CONTRACT ENFORCEMENT FAILED', {
      error: error.message,
      stack: error.stack?.substring(0, 200)
    });
    return createErrorPlan('UNKNOWN_ERROR', error.message);
  }
}

function convertLegacyPlannerOutput(plan) {
  if (!plan || typeof plan !== 'object') return plan;

  const normalizedMode = plan.mode === 'EXECUTE' ? 'tools' : plan.mode === 'CHAT' ? 'chat_only' : plan.mode;
  const legacyPlan = Array.isArray(plan.plan) ? plan.plan : [];

  const convertedSteps = legacyPlan.map((step, idx) => ({
    id: step.id || `step-${idx}`,
    tool: step.tool,
    description: step.description || `Execute ${step.tool || 'tool'}`,
    args: step.args || {},
    sequence: step.sequence ?? idx
  }));

  return {
    ...plan,
    mode: normalizedMode,
    reasoning: plan.reasoning || 'Recovered from legacy planner format',
    steps: normalizedMode === 'tools' ? convertedSteps : [],
    constraints: plan.constraints || {
      maxTokens: 2000,
      maxExecutionTime: 30000,
      maxSteps: 5,
      cacheResults: true,
      cacheTTL: 3600
    },
    metadata: plan.metadata || {
      planGeneratedAt: new Date().toISOString(),
      plannerModel: 'gpt-4o-mini',
      inputGoal: '',
      contextSize: {}
    }
  };
}

/**
 * Normalize plan by filling in required fields
 * and ensuring consistency
 */
function normalizePlan(plan, context) {
  const normalized = {
    ...plan,

    // Ensure mode is always present
    mode: plan.mode || 'chat_only',

    // Ensure reasoning is present
    reasoning: plan.reasoning || 'No reasoning provided',

    // Ensure steps array exists
    steps: (plan.steps || []).map((step, idx) => ({
      ...step,
      id: step.id || `step-${idx}`,
      description: step.description || `Execute ${step.tool || 'tool'}`,
      args: step.args || {},
      sequence: step.sequence ?? idx
    })),

    // Ensure constraints exist with defaults
    constraints: {
      maxTokens: plan.constraints?.maxTokens ?? 2000,
      maxExecutionTime: plan.constraints?.maxExecutionTime ?? 30000,
      maxSteps: plan.constraints?.maxSteps ?? 5,
      cacheResults: plan.constraints?.cacheResults ?? true,
      cacheTTL: plan.constraints?.cacheTTL ?? 3600
    },

    // Ensure metadata exists with context
    metadata: {
      planGeneratedAt: new Date().toISOString(),
      plannerModel: plan.metadata?.plannerModel || 'gpt-4o-mini',
      inputGoal: context.goal || plan.metadata?.inputGoal || 'Unknown goal',
      contextSize: {
        symbolsCount: context.contextSize?.symbolsCount || 0,
        relationsCount: context.contextSize?.relationsCount || 0,
        requirementsCount: context.contextSize?.requirementsCount || 0,
        contextTokens: context.contextSize?.contextTokens || 0
      }
    }
  };

  return normalized;
}

/**
 * Create an error plan (mode: 'error')
 * This ensures consistent error handling
 */
function createErrorPlan(code, message) {
  return {
    mode: 'error',
    reasoning: `Error occurred: ${message}`,
    steps: [],
    constraints: {
      maxTokens: 2000,
      maxExecutionTime: 30000,
      maxSteps: 5,
      cacheResults: false,
      cacheTTL: 0
    },
    error: {
      code,
      message,
      fallbackMode: 'chat_only'
    },
    metadata: {
      planGeneratedAt: new Date().toISOString(),
      plannerModel: 'error-handler',
      inputGoal: 'Error recovery',
      contextSize: {}
    }
  };
}

/**
 * Convert execution plan to Task model
 * 
 * This bridges the execution plan (logical) to Task (database)
 * ensuring the schema contract is maintained
 */
export function executionPlanToTask(plan, projectId, userId) {
  logger.info('🔄 CONVERTING PLAN TO TASK', {
    planMode: plan.mode,
    stepCount: plan.steps?.length || 0
  });

  if (plan.mode === 'error') {
    logger.error('❌ Cannot create task from error plan', {
      error: plan.error?.message
    });
    throw new Error(`Cannot execute error plan: ${plan.error?.message}`);
  }

  if (plan.mode === 'chat_only') {
    logger.info('💬 Chat-only plan - no task needed', {
      reasoning: plan.reasoning
    });
    throw new Error('CHAT_ONLY_MODE'); // Expected signal
  }

  // Create task from normalized plan
  const task = {
    projectId,
    userId,
    goal: plan.metadata.inputGoal, // ← THIS FIXES "goal required" error
    status: 'pending', // ← THIS FIXES "status enum" error (using valid enum value)
    explanation: plan.reasoning,
    steps: plan.steps.map(step => ({
      description: step.description,
      tool: step.tool,
      args: step.args || {},
      status: 'pending' // Valid enum value
    }))
  };

  logger.info('✅ TASK CREATED FROM PLAN', {
    taskId: task._id || '[new]',
    goal: task.goal.substring(0, 100),
    stepCount: task.steps.length,
    status: task.status
  });

  return task;
}

/**
 * Validate that a plan is executable
 * 
 * Additional validation before executor runs
 */
export function validatePlanIsExecutable(plan) {
  const errors = [];

  if (!plan.mode) errors.push('mode is required');
  if (plan.mode === 'error') errors.push('Cannot execute error plan');
  if (plan.mode === 'chat_only') errors.push('chat_only plans do not execute tools');

  if (plan.mode === 'tools') {
    if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
      errors.push('tools mode requires at least one step');
    }

    // Validate each step has required tool
    plan.steps.forEach((step, idx) => {
      if (!step.tool) errors.push(`step ${idx}: tool is required`);
      if (!step.args || typeof step.args !== 'object') {
        errors.push(`step ${idx}: args must be object`);
      }
    });
  }

  // Validate constraints
  if (plan.constraints?.maxSteps && plan.steps?.length > plan.constraints.maxSteps) {
    errors.push(`too many steps (max ${plan.constraints.maxSteps})`);
  }

  return {
    executable: errors.length === 0,
    errors
  };
}
