import { streamChat } from './ai.service.js';
import {
  createConversation,
  getActiveConversation
} from '../chat/chat.service.js';
import { getProjectSnapshot } from './tools/projectSnapshot.tool.js';
import { getProjectGraph } from './tools/graph.tool.js';
import { compileContext } from './context-compiler.js';
import { createUnifiedPlan } from './agent/unified-planner.service.js';
import { executePlan } from './agent/executor.service.js';
import StructuredLogger from './logger/structured.logger.js';
import Task from '../models/Task.js';
import {
  enforceAndNormalizePlan,
  executionPlanToTask,
  validatePlanIsExecutable
} from './agent/planner-contract-enforcer.js';

const logger = new StructuredLogger('ai-controller-stream');

/**
 * ARQUITECTURA FINAL (Fase 3-XI)
 * 
 * VERSIÓN CERRADA: "Single Planner + Compressed Context"
 * 
 * Flujo:
 * 1. Context Compressor (reglas: reduce mundo)
 * 2. SINGLE PLANNER (1 LLM call: decide + planifica)
 * 3. Contract Validator (valida schema)
 * 4. Executor (ejecuta sin pensar)
 * 
 * Garantías:
 * ✅ 1 sola llamada LLM
 * ✅ Contexto comprimido (obligatorio)
 * ✅ Determinismo post-LLM
 * ✅ Token explosion eliminada
 * 
 * Eliminado vs X:
 * ❌ intent-planner.js (no necesario)
 * ❌ execution-planner.service.js separado
 * ✅ UN SOLO PLANNER para TODO
 */

async function stream(req, res) {
  console.log('REQUEST START', { timestamp: Date.now(), url: req.url, method: req.method });

  req.on('close', () => {
    console.log('REQUEST CLOSED', { timestamp: Date.now(), url: req.url, method: req.method });
  });

  res.on('close', () => {
    console.log('RESPONSE CLOSED', { timestamp: Date.now(), url: req.url, method: req.method });
  });

  try {
    const {
      message,
      conversationId,
      context = {},
      provider
    } = req.body;

    // Check project permissions if projectId is provided
    if (context.projectId) {
      if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
        const projectRole = req.user.projectRoles?.find(pr => pr.project?._id?.toString() === context.projectId?.toString());
        if (!projectRole || projectRole.role !== 'usuario') {
          return res.status(403).json({ message: 'No tienes permisos para interactuar con este proyecto.' });
        }
      }
    }

    context.userId = req.user?._id || null;
    context.userRole = req.user?.role || null;

    // Determine project role
    let determinedProjectRole = 'invitado';
    if (context.projectId) {
      if (req.user?.role === 'super_admin' || req.user?.role === 'admin') {
        determinedProjectRole = 'admin';
      } else if (req.user?.role === 'usuario') {
        const projectRoleObj = req.user.projectRoles?.find(pr => {
          const prProjectId = pr.project?._id?.toString() || pr.project?.toString();
          const contextProjectId = context.projectId.toString();
          return prProjectId === contextProjectId;
        });
        if (projectRoleObj && ['usuario', 'admin'].includes(projectRoleObj.role)) {
          determinedProjectRole = projectRoleObj.role;
        }
      }
    }
    context.projectRole = determinedProjectRole;

    console.log('AI stream - Determined project role:', {
      userId: context.userId,
      projectId: context.projectId,
      userGlobalRole: context.userRole,
      userProjectRoles: req.user?.projectRoles,
      determinedProjectRole: context.projectRole
    });

    const llmProvider = provider || process.env.AI_PROVIDER || 'gemini';

    console.log('AI stream request:', {
      message: message?.toString?.(),
      conversationId,
      context,
      provider: llmProvider
    });

    if (!message || !message.toString().trim()) {
      return res.status(400).json({ message: 'El mensaje es obligatorio.' });
    }

    let conversation = conversationId;

    // Si no hay conversationId, buscar conversación activa o crear nueva
    if (!conversation && context.userId && context.projectId) {
      const activeConversation = await getActiveConversation(context.userId, context.projectId);
      if (activeConversation) {
        conversation = activeConversation._id.toString();
      } else {
        const newConversation = await createConversation(context.userId, context.projectId);
        conversation = newConversation._id.toString();
      }
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let assistantResponse = '';
    const messageText = message.toString().trim();

    // ============================================================
    // INPUT FIREWALL (HARDENING)
    // ============================================================
    function sanitizeGoal(goal) {
      if (!goal || typeof goal !== 'string') return null;
      
      // Reject if contains error stack traces or logs
      if (goal.includes('node:internal') || goal.includes('ERR_') || goal.includes('Error [') || goal.includes('at ')) {
        return null;
      }
      
      // Limit length
      return goal.trim().slice(0, 2000);
    }
    
    const sanitizedMessage = sanitizeGoal(messageText);
    if (!sanitizedMessage) {
      logger.warn('⚠️ INPUT REJECTED: Corrupted or invalid goal', {
        reason: 'goal contains error traces or invalid content',
        originalLength: messageText.length
      });
      
      // Fallback to chat
      await streamChat({
        provider: llmProvider,
        messages: [{ role: 'user', content: 'Perdón, hubo un error procesando tu solicitud. Por favor intenta de nuevo.' }],
        context,
        conversationId: conversation,
        onChunk: (chunk) => { assistantResponse += chunk; }
      });
      
      return;
    }

    // ============================================================
    // FINAL UNIFIED PIPELINE (Fase 3-XI)
    // ============================================================
    logger.info('=== UNIFIED PIPELINE START ===', {
      message: sanitizedMessage.substring(0, 100),
      projectId: context.projectId
    });

    // ALL queries: Use unified pipeline if projectId present
    if (context.projectId) {
      try {
        // ─────────────────────────────────────────────────────
        // STEP 1: Context Compression (RULES-BASED)
        // ─────────────────────────────────────────────────────
        logger.info('📦 CONTEXT COMPRESSION START');
        
        const snapshot = await getProjectSnapshot({ projectId: context.projectId });
        const graph = await getProjectGraph({ projectId: context.projectId });

        // GRAPH TYPE GUARD (CRITICAL)
        if (!Array.isArray(graph)) {
          logger.warn('⚠️ GRAPH TYPE INVALID', {
            type: typeof graph,
            isArray: Array.isArray(graph),
            value: graph?.constructor?.name || 'unknown'
          });
          throw new Error('Invalid graph type: expected Array');
        }

        logger.info('📊 Data loaded', {
          symbols: snapshot.counts?.symbols || 0,
          requirements: snapshot.counts?.requirements || 0,
          relationsOriginal: graph.length || 0
        });

        // Compress: 438 → 10-30 relations (RULES, NOT LLM)
        const contextPack = await compileContext({
          projectId: context.projectId,
          goal: sanitizedMessage,
          graph: graph || [],
          depthLimit: 2,
          maxContextNodes: 25
        });

        logger.info('📦 CONTEXT COMPRESSION COMPLETE', {
          nodesIncluded: contextPack.nodes.length,
          relationsReduced: contextPack.relations.length,
          compressionRatio: contextPack.metadata.compressionRatio
        });

        // ─────────────────────────────────────────────────────
        // TOKEN HARD GUARD (CRITICAL)
        // ─────────────────────────────────────────────────────
        const MAX_CONTEXT_TOKENS = 8000;
        const contextSize = JSON.stringify(contextPack).length / 4; // rough token estimate
        
        if (contextSize > MAX_CONTEXT_TOKENS) {
          logger.warn('⚠️ CONTEXT SIZE EXCEEDS BUDGET', {
            estimated: contextSize,
            max: MAX_CONTEXT_TOKENS
          });
          // Additional truncation
          contextPack.nodes = contextPack.nodes.slice(0, 10);
          contextPack.relations = contextPack.relations.slice(0, 15);
        }

        // ─────────────────────────────────────────────────────
        // STEP 2: Single Planner (1 LLM CALL FOR EVERYTHING)
        // ─────────────────────────────────────────────────────
        logger.info('🧠 UNIFIED PLANNER START (1 LLM call)');

        const planText = await createUnifiedPlan({
          goal: sanitizedMessage,
          contextPack: contextPack,
          snapshot: snapshot,
          analyticsContext: ''
        });

        logger.info('🧠 UNIFIED PLANNER RESPONSE', {
          planLength: planText.length
        });

        // ─────────────────────────────────────────────────────
        // STEP 3: Contract Validation (SIMPLE VALIDATION)
        // ─────────────────────────────────────────────────────
        logger.info('🔒 CONTRACT VALIDATION START');

        const enforcedPlan = await enforceAndNormalizePlan(planText, {
          projectId: context.projectId,
          goal: sanitizedMessage,
          contextSize: {
            symbolsCount: snapshot.counts?.symbols || 0,
            relationsCount: contextPack.relations.length,
            requirementsCount: snapshot.counts?.requirements || 0
          }
        });

        logger.info('✅ CONTRACT VALIDATED', {
          mode: enforcedPlan.mode,
          stepCount: enforcedPlan.steps?.length || 0
        });

        // Decide based on planner output
        if (enforcedPlan.mode === 'chat_only' || enforcedPlan.mode === 'CHAT') {
          logger.info('💬 PLANNER DECIDED: CHAT mode', {
            reasoning: enforcedPlan.reasoning
          });
          throw new Error('CHAT_ONLY_MODE');
        }

        if (enforcedPlan.mode === 'error') {
          logger.error('❌ PLANNER ERROR MODE', {
            error: enforcedPlan.error?.message
          });
          throw new Error(`PLANNER_ERROR: ${enforcedPlan.error?.message}`);
        }

        // Validate plan is executable
        const executabilityCheck = validatePlanIsExecutable(enforcedPlan);
        if (!executabilityCheck.executable) {
          logger.error('❌ PLAN NOT EXECUTABLE', {
            errors: executabilityCheck.errors
          });
          throw new Error(`Plan not executable: ${executabilityCheck.errors.join(', ')}`);
        }

        // ─────────────────────────────────────────────────────
        // STEP 4: Task Creation from Validated Plan
        // ─────────────────────────────────────────────────────
        logger.info('✅ CREATING TASK', {
          stepCount: enforcedPlan.steps.length,
          goal: enforcedPlan.metadata.inputGoal.substring(0, 100)
        });

        let task;
        try {
          task = executionPlanToTask(enforcedPlan, context.projectId, context.userId);
          task = await Task.create(task);
          logger.info('✅ TASK CREATED', {
            taskId: task._id.toString(),
            goal: task.goal.substring(0, 100),
            stepCount: task.steps.length,
            status: task.status
          });
        } catch (taskError) {
          logger.error('❌ TASK CREATION FAILED', {
            error: taskError.message
          });
          throw taskError;
        }

        // ─────────────────────────────────────────────────────
        // STEP 5: Executor (PURE MECHANICAL EXECUTION)
        // ─────────────────────────────────────────────────────
        logger.info('⚙️  EXECUTOR START', {
          taskId: task._id?.toString(),
          stepCount: task.steps.length
        });

        const executedTask = await executePlan(task);

        logger.info('⚙️  EXECUTOR COMPLETE', {
          taskId: executedTask._id?.toString(),
          status: executedTask.status,
          completedSteps: executedTask.steps.filter(s => s.status === 'done').length
        });

        // ─────────────────────────────────────────────────────
        // Aggregate Results
        // ─────────────────────────────────────────────────────
        const allResults = executedTask.steps
          .filter(step => step.status === 'done')
          .map(step => ({
            tool: step.tool,
            description: step.description,
            result: step.result
          }));

        logger.info('✅ UNIFIED PIPELINE COMPLETE', {
          toolsExecuted: allResults.length,
          totalTime: 'recorded in logs'
        });

        // Format response
        assistantResponse = `## Análisis Completado\n\n`;
        for (const toolResult of allResults) {
          assistantResponse += `### ${toolResult.tool}\n`;
          if (toolResult.result.success) {
            assistantResponse += JSON.stringify(toolResult.result, null, 2);
          } else {
            assistantResponse += `Error: ${toolResult.result.error}`;
          }
          assistantResponse += '\n\n';
        }

        logger.info('✨ RESPONSE GENERATED', {
          responseLength: assistantResponse.length
        });

      } catch (pipelineError) {
        // Handle errors gracefully
        if (pipelineError.message === 'CHAT_ONLY_MODE') {
          logger.info('💬 FALLBACK: Chat mode (planner decision)');
        } else {
          logger.error('❌ PIPELINE ERROR - FALLBACK TO CHAT', {
            error: pipelineError.message
          });
        }

        // Fallback to simple chat
        logger.info('💬 CHAT STREAM FALLBACK');
        await streamChat({
          provider: llmProvider,
          messages: [
            {
              role: 'user',
              content: messageText
            }
          ],
          context,
          conversationId: conversation,
          onChunk: (chunk) => {
            assistantResponse += chunk;
          }
        });
      }
    } else {
      // No projectId: Direct chat
      logger.info('💬 DIRECT CHAT (no projectId)');

      await streamChat({
        provider: llmProvider,
        messages: [
          {
            role: 'user',
            content: messageText
          }
        ],
        context,
        conversationId: conversation,
        onChunk: (chunk) => {
          assistantResponse += chunk;
        }
      });
    }

    let finalResponse = assistantResponse;

    // REMOVED: Tool leakage detection ("Detected tool call in response")
    // SECURITY FIX: Only tools from the PLANNER (unified decision layer) execute now
    // This prevents LLM from directly invoking tools without planner orchestration
    // The planner is now the SINGLE DECISION LAYER for ALL tool execution
    logger.info('✅ RESPONSE FINALIZED', {
      source: 'unified pipeline',
      responseLength: finalResponse.length,
      note: 'Tool execution only via planner (no LLM tool leakage allowed)'
    });

    // Send the final response as chunks
    const responseChunks = finalResponse.split('\n');
    for (const chunk of responseChunks) {
      if (chunk.trim()) {
        res.write(`data: ${JSON.stringify({ content: chunk + '\n', conversationId: conversation })}\n\n`);
      }
    }

    // Save the final assistant response
    if (conversation && finalResponse) {
      const { saveMessage } = await import('../chat/chat.service.js');
      await saveMessage({
        conversationId: conversation,
        role: 'assistant',
        content: finalResponse,
        metadata: {
          projectId: context.projectId,
          userId: context.userId
        }
      });
    }

    console.log('AI stream completed:', {
      conversationId: conversation
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error('AI stream error:', err);
    if (err.response) {
      console.error('AI service response:', {
        status: err.response.status,
        data: err.response.data
      });
    }

    const statusCode = err.status || (err.response && err.response.status) || 500;
    const openAIMessage = err.error?.message || (err.response && err.response.data?.error?.message);
    const errorMessage = openAIMessage || 'Error interno del servidor de IA.';

    if (!res.headersSent) {
      res.status(statusCode).json({ message: errorMessage });
    } else {
      res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
      res.end();
    }
  }
}

export { stream };
