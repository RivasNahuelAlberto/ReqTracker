import { streamChat } from './ai.service.js';
import {
  createConversation,
  getActiveConversation
} from '../chat/chat.service.js';
import { getProjectSnapshot } from './tools/projectSnapshot.tool.js';
import { getProjectGraph } from './tools/graph.tool.js';
import { createPlan } from './agent/planner.service.js';
import { executePlan } from './agent/executor.service.js';
import StructuredLogger from './logger/structured.logger.js';
import Task from '../models/Task.js';

const logger = new StructuredLogger('ai-controller-stream');

// NOTE: Removed keyword routing (AGENT_TRIGGER_KEYWORDS, shouldUseAgent)
// The planner now decides for ALL queries whether to use tools or chat
// This is the Single Decision Layer architectural fix from Phase 3-VIII

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

    // UNIFIED DECISION LAYER: ALL queries go through planner
    logger.info('=== UNIFIED STREAM PIPELINE ENTRY ===', {
      message: messageText.substring(0, 100),
      context,
      note: 'ALL queries now use planner to decide: tools or chat_only'
    });

    // ALL queries: Let planner decide (this is the architectural fix)
    if (context.projectId) {
      logger.info('🧠 SENDING TO UNIFIED PLANNER (decision layer)', {
        projectId: context.projectId,
        messageLength: messageText.length
      });

      try {
        // Get project snapshot and graph
        logger.info('Fetching project snapshot and graph...');
        const snapshot = await getProjectSnapshot({ projectId: context.projectId });
        const graph = await getProjectGraph({ projectId: context.projectId });

        logger.info('📊 Project loaded', {
          symbols: snapshot.counts?.symbols || 0,
          requirements: snapshot.counts?.requirements || 0,
          relations: snapshot.counts?.relations || 0
        });

        // Create plan
        logger.info('🔷 PLANNER START - Creating plan', {
          goal: messageText.substring(0, 50)
        });

        const planText = await createPlan({
          goal: messageText,
          snapshot,
          graph,
          analyticsContext: ''
        });

        logger.info('🔷 PLANNER COMPLETE - Plan created', {
          planLength: planText.length
        });

        // Parse plan
        let parsedPlan;
        try {
          const jsonMatch = planText.match(/\{[\s\S]*\}/m);
          if (!jsonMatch) {
            throw new Error('No JSON in plan');
          }
          parsedPlan = JSON.parse(jsonMatch[0]);
          logger.info('📋 Plan parsed', {
            mode: parsedPlan.mode || 'unknown',
            steps: parsedPlan.steps?.length || 0,
            reasoning: parsedPlan.reasoning
          });
        } catch (parseError) {
          logger.error('❌ Plan parsing failed', {
            error: parseError.message,
            planLength: planText.length
          });
          throw parseError;
        }

        // Validate plan
        if (!parsedPlan) {
          logger.error('❌ Invalid plan structure', { parsedPlan });
          throw new Error('Plan structure invalid');
        }

        // DECISION POINT: Check planner decision
        const planMode = parsedPlan.mode || 'tools';
        
        if (planMode === 'chat_only') {
          logger.info('💬 PLANNER DECIDED: chat_only mode', {
            reasoning: parsedPlan.reasoning
          });
          throw new Error('CHAT_ONLY_MODE');
        }

        // Mode is tools: Validate tool execution
        if (!Array.isArray(parsedPlan.steps) || parsedPlan.steps.length === 0) {
          logger.info('⚠️  Plan has no steps, falling back to chat');
          throw new Error('CHAT_ONLY_MODE');
        }

        logger.info('✅ Plan valid (tool mode), creating task');

        // Create task
        const task = await Task.create({
          projectId: context.projectId,
          userId: context.userId,
          steps: parsedPlan.steps.map((step, idx) => ({
            index: idx,
            description: step.description,
            tool: step.tool,
            args: step.args || {},
            status: 'pending'
          })),
          status: 'created'
        });

        logger.info('🔶 EXECUTOR START - Executing task', {
          taskId: task._id?.toString(),
          stepCount: task.steps.length
        });

        // Execute plan
        const executedTask = await executePlan(task);

        logger.info('🔶 EXECUTOR COMPLETE - Task executed', {
          taskId: executedTask._id?.toString(),
          status: executedTask.status,
          completedSteps: executedTask.steps.filter(s => s.status === 'done').length
        });

        // Aggregate results from all steps
        const allResults = executedTask.steps
          .filter(step => step.status === 'done')
          .map(step => ({
            tool: step.tool,
            description: step.description,
            result: step.result
          }));

        logger.info('✅ ORCHESTRATION COMPLETE', {
          executionTime: 'recorded in logs',
          toolsExecuted: allResults.length
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

        // Log the fact that we succeeded
        logger.info('✨ RESPONSE GENERATED FROM REAL TOOLS', {
          responseLength: assistantResponse.length
        });
      } catch (agentError) {
        // Check if it is an intentional chat_only mode decision vs actual error
        if (agentError.message === 'CHAT_ONLY_MODE') {
          logger.info('💬 CHAT_ONLY: Planner decided no tools needed', {
            error: agentError.message
          });
        } else {
          logger.error('❌ AGENT PIPELINE ERROR - Falling back to chat', {
            error: agentError.message,
            stack: agentError.stack?.substring(0, 200)
          });
        }

        // Fallback to regular chat
        logger.info('💬 CHAT STREAM (planner mode or error fallback)');
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
      // No projectId: Direct chat (no planner context needed)
      logger.info('💬 DIRECT CHAT STREAM (no project context)', {
        reason: 'No projectId provided'
      });

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
