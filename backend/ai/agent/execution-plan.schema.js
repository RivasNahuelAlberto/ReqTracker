/**
 * EXECUTION PLAN SCHEMA - Formal Contract for Planner Output
 * 
 * This defines the STRICT contract between:
 * 1. Planner (generates)
 * 2. Controller (validates)
 * 3. Executor (executes)
 * 
 * The goal: Eliminate all ambiguity, ensure determinism, prevent token explosions
 * 
 * Philosophy: "Contrato formal del planner (tipo AST o execution plan estricto)" - IX.txt
 */

export const ExecutionPlanSchema = {
  // ============================================================
  // DECISION LAYER: What should be done
  // ============================================================
  
  // The planner's top-level decision
  mode: {
    type: 'enum',
    values: ['tools', 'chat_only', 'error'],
    required: true,
    description: 'What execution path to take'
  },

  // Why the planner made this decision
  reasoning: {
    type: 'string',
    required: true,
    maxLength: 500,
    description: 'Explanation of decision, for logging and debugging'
  },

  // ============================================================
  // EXECUTION LAYER (if mode === 'tools')
  // ============================================================

  steps: {
    type: 'array',
    required: true,
    items: {
      // Unique identifier for this step
      id: {
        type: 'string',
        required: true,
        description: 'Step ID (uuid or auto-generated)'
      },

      // What tool to execute
      tool: {
        type: 'string',
        required: true,
        enum: [
          // Existing tools
          'analyzeRequirement',
          'findSimilarRequirements',
          'findDuplicates',
          'checkConsistency',
          'checkImpact',
          'analyzeSymbolQuality',
          'clusterRequirementsAnalysis',
          'generateRecommendations',
          'semanticSearch',
          'findTransitiveDependencies',
          'detectDependencyCycles',
          'analyzeSytemicImpact',
          'analyzeInconsistencyRisk'
        ],
        description: 'Tool name (must be from allowed list)'
      },

      // What to do
      description: {
        type: 'string',
        required: true,
        maxLength: 200,
        description: 'Human-readable description of step'
      },

      // Arguments with schema validation
      args: {
        type: 'object',
        required: true,
        description: 'Tool arguments (must match tool schema)',
        // Note: Individual tool schemas defined below
      },

      // Execution order (for validation)
      sequence: {
        type: 'number',
        required: true,
        description: 'Execution order (0-indexed)'
      }
    }
  },

  // ============================================================
  // CONSTRAINTS (prevent token explosion and instability)
  // ============================================================

  constraints: {
    type: 'object',
    description: 'Execution constraints',
    fields: {
      maxTokens: {
        type: 'number',
        default: 2000,
        description: 'Max tokens for this execution (safety limit)'
      },

      maxExecutionTime: {
        type: 'number',
        default: 30000, // 30 seconds
        description: 'Max execution time in milliseconds'
      },

      maxSteps: {
        type: 'number',
        default: 5,
        description: 'Maximum number of steps to execute'
      },

      cacheResults: {
        type: 'boolean',
        default: true,
        description: 'Cache tool results'
      },

      cacheTTL: {
        type: 'number',
        default: 3600,
        description: 'Cache TTL in seconds'
      }
    }
  },

  // ============================================================
  // METADATA (for observability and debugging)
  // ============================================================

  metadata: {
    type: 'object',
    fields: {
      planGeneratedAt: {
        type: 'timestamp',
        required: true,
        description: 'When planner generated this plan'
      },

      plannerModel: {
        type: 'string',
        required: true,
        description: 'Which LLM model generated this'
      },

      inputGoal: {
        type: 'string',
        required: true,
        maxLength: 1000,
        description: 'Original user goal'
      },

      contextSize: {
        type: 'object',
        fields: {
          symbolsCount: { type: 'number' },
          relationsCount: { type: 'number' },
          requirementsCount: { type: 'number' },
          contextTokens: { type: 'number' }
        },
        description: 'Size of input context'
      }
    }
  },

  // ============================================================
  // ERROR HANDLING (if mode === 'error')
  // ============================================================

  error: {
    type: 'object',
    fields: {
      code: {
        type: 'enum',
        values: [
          'INVALID_GOAL',
          'INSUFFICIENT_CONTEXT',
          'TOKEN_LIMIT_EXCEEDED',
          'UNKNOWN_ERROR'
        ],
        description: 'Error code'
      },

      message: {
        type: 'string',
        required: true,
        description: 'Error message'
      },

      fallbackMode: {
        type: 'enum',
        values: ['chat_only', 'retry_with_reduced_context'],
        description: 'What to do when error occurs'
      }
    }
  }
};

/**
 * TOOL-SPECIFIC ARGUMENT SCHEMAS
 * 
 * Each tool has strict input/output contracts
 */

export const ToolSchemas = {
  findTransitiveDependencies: {
    args: {
      projectId: { type: 'string', required: true },
      symbolName: { type: 'string', required: true },
      maxDepth: { type: 'number', required: true, min: 1, max: 5 }
    },
    output: {
      paths: { type: 'array' },
      depth: { type: 'number' },
      pathsFound: { type: 'number' }
    }
  },

  detectDependencyCycles: {
    args: {
      projectId: { type: 'string', required: true },
      symbolName: { type: 'string', required: true }
    },
    output: {
      cyclesFound: { type: 'number' },
      cycles: { type: 'array' }
    }
  },

  analyzeSytemicImpact: {
    args: {
      projectId: { type: 'string', required: true },
      symbolName: { type: 'string', required: true },
      changeDescription: { type: 'string', required: true, maxLength: 500 }
    },
    output: {
      impactScore: { type: 'number' },
      affectedSymbols: { type: 'array' },
      mitigationStrategies: { type: 'array' }
    }
  },

  analyzeInconsistencyRisk: {
    args: {
      projectId: { type: 'string', required: true },
      affectedSymbols: { type: 'array', required: true }
    },
    output: {
      riskLevel: { type: 'enum', values: ['LOW', 'MEDIUM', 'HIGH'] },
      conflicts: { type: 'array' },
      redundancies: { type: 'array' }
    }
  }
};

/**
 * VALIDATION FUNCTION
 * 
 * Strictly validates that a planner output matches the contract
 */

export function validateExecutionPlan(plan) {
  const errors = [];

  // Required fields
  if (!plan.mode) errors.push('mode is required');
  if (!['tools', 'chat_only', 'error'].includes(plan.mode)) {
    errors.push(`Invalid mode: ${plan.mode}`);
  }

  if (!plan.reasoning) errors.push('reasoning is required');
  if (typeof plan.reasoning !== 'string') errors.push('reasoning must be string');
  if (plan.reasoning.length > 500) errors.push('reasoning exceeds 500 chars');

  // Mode-specific validation
  if (plan.mode === 'tools') {
    if (!Array.isArray(plan.steps)) {
      errors.push('steps must be array when mode is tools');
    } else {
      if (plan.steps.length === 0) errors.push('steps array cannot be empty');
      if (plan.steps.length > (plan.constraints?.maxSteps || 5)) {
        errors.push(`too many steps (max ${plan.constraints?.maxSteps || 5})`);
      }

      plan.steps.forEach((step, idx) => {
        if (!step.tool) errors.push(`step ${idx}: tool is required`);
        if (!step.description) errors.push(`step ${idx}: description is required`);
        if (!step.args || typeof step.args !== 'object') {
          errors.push(`step ${idx}: args must be object`);
        }
      });
    }
  } else if (plan.mode === 'error') {
    if (!plan.error) errors.push('error object required when mode is error');
    if (!plan.error?.code) errors.push('error.code is required');
    if (!plan.error?.message) errors.push('error.message is required');
  }

  // Metadata should exist
  if (!plan.metadata) errors.push('metadata is recommended but missing');

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * EXAMPLE: What a valid execution plan looks like
 */

export const ExampleExecutionPlan = {
  mode: 'tools',
  reasoning: 'Query requires graph traversal to find transitive dependencies',

  steps: [
    {
      id: 'step-1',
      tool: 'findTransitiveDependencies',
      description: 'Find all transitive dependencies from Proceso de Compra depth 3',
      args: {
        projectId: '6a02c4455ff60ae6052d4153',
        symbolName: 'Proceso de Compra',
        maxDepth: 3
      },
      sequence: 0
    }
  ],

  constraints: {
    maxTokens: 2000,
    maxExecutionTime: 30000,
    maxSteps: 5,
    cacheResults: true,
    cacheTTL: 3600
  },

  metadata: {
    planGeneratedAt: new Date().toISOString(),
    plannerModel: 'gpt-4o-mini',
    inputGoal: 'Mostrame todas las dependencias transitivas de profundidad 3 de Proceso de Compra',
    contextSize: {
      symbolsCount: 28,
      relationsCount: 438,
      requirementsCount: 2,
      contextTokens: 1234
    }
  }
};
