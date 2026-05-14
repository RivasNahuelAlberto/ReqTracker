/**
 * UNIFIED PLANNER (Fase 3-XI)
 * 
 * ARQUITECTURA FINAL CERRADA:
 * - 1 solo LLM call por request
 * - 1 solo punto de decisión (no múltiples planners)
 * - Contexto comprimido (obligatorio)
 * - Ejecución determinista
 * 
 * Diferencia con X:
 * ❌ NO intent-planner separado
 * ❌ NO execution-planner separado
 * ✅ UN SOLO PLANNER que decide + planifica
 */

import OpenAI from 'openai';
import StructuredLogger from '../logger/structured.logger.js';

const logger = new StructuredLogger('unified-planner');

const openaiApiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
const openaiBaseURL = process.env.OPENAI_API_KEY
  ? 'https://api.openai.com/v1'
  : process.env.OPENROUTER_API_BASE_URL || 'https://openrouter.ai/api/v1';

function createOpenAIClient() {
  if (!openaiApiKey) {
    throw new Error('OpenAI o OpenRouter API key es requerida.');
  }
  return new OpenAI({ apiKey: openaiApiKey, baseURL: openaiBaseURL });
}

/**
 * UNIFIED PLANNER
 * 
 * 1 LLM call que hace TODO:
 * - Decide intención (CHAT vs EXECUTE)
 * - Genera plan (si EXECUTE)
 * 
 * Input: goal + contextPack (comprimido)
 * Output: {mode, intent, plan, confidence}
 */
export async function createUnifiedPlan({
  goal,
  contextPack,
  snapshot,
  analyticsContext
}) {
  if (!goal || !contextPack) {
    throw new Error('goal y contextPack son requeridos');
  }

  logger.info('🧠 UNIFIED PLANNER START', {
    goal: goal.substring(0, 80),
    contextNodes: contextPack.nodes?.length || 0,
    contextRelations: contextPack.relations?.length || 0
  });

  const systemPrompt = buildUnifiedSystemPrompt(snapshot);
  const userPrompt = buildUnifiedUserPrompt(goal, contextPack, snapshot, analyticsContext);

  try {
    const client = createOpenAIClient();
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    const planText = response?.choices?.[0]?.message?.content?.trim() || '';

    logger.info('🧠 UNIFIED PLANNER RESPONSE', {
      responseLength: planText.length,
      tokens: response.usage?.completion_tokens || 0
    });

    if (!planText) {
      throw new Error('Planner returned empty response');
    }

    return planText;

  } catch (error) {
    logger.error('❌ UNIFIED PLANNER ERROR', {
      error: error.message
    });
    throw error;
  }
}

/**
 * Build unified system prompt
 * 
 * Este prompt DEBE HACER TODO:
 * - Detectar intención
 * - Decidir CHAT vs EXECUTE
 * - Si EXECUTE: generar plan con tools
 */
function buildUnifiedSystemPrompt(snapshot) {
  return `Sos un sistema de decisión integral para análisis de requisitos.

Tu tarea: Responder 1 pregunta del usuario decidiendo:
1. ¿Necesito herramientas (EXECUTE) o solo conversación (CHAT)?
2. Si EXECUTE: ¿Cuál es el plan exacto?

HERRAMIENTAS DISPONIBLES (úsalas si son necesarias):
1. findTransitiveDependencies - Recorrer grafo hasta profundidad N
2. detectDependencyCycles - Detectar ciclos en dependencias
3. analyzeSytemicImpact - Análisis de cascada de cambios
4. analyzeInconsistencyRisk - Validación de riesgos
5. generateRecommendations - Sugerencias de mejora
6. clusterRequirementsAnalysis - Agrupar por semántica
7. analyzeSymbolQuality - Validar símbolos
8. semanticSearch - Búsqueda semántica
9. checkConsistency - Detectar conflictos
10. analyzeRequirement - Validar requisitos

CRITERIOS DE DECISIÓN:

### CHAT (conversational, sin tools):
- Preguntas conceptuales ("¿Qué es un requisito?")
- Comparaciones abstractas
- Explicaciones generales
- Si el usuario pide insights sin análisis específico

### EXECUTE (requiere tools):
- "Mostrame dependencias" → findTransitiveDependencies
- "Hay ciclos?" → detectDependencyCycles
- "¿Qué pasa si cambio X?" → analyzeSytemicImpact
- "Recomendaciones" → generateRecommendations
- Cualquier pregunta que requiera datos/análisis real del proyecto

DATOS DEL PROYECTO:
- Símbolos: ${snapshot.counts?.symbols || 0}
- Requisitos: ${snapshot.counts?.requirements || 0}
- Escenarios: ${snapshot.counts?.scenarios || 0}

FORMATO DE RESPUESTA (OBLIGATORIO JSON):

{
  "mode": "CHAT" | "EXECUTE",
  "intent": "GRAPH_QUERY" | "CHAT" | "ANALYTICS",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation (max 200 chars)",
  "plan": [
    {
      "tool": "exact_tool_name",
      "description": "What this does",
      "args": { specific args for tool }
    }
  ]
}

REGLAS CRÍTICAS:
1. Si mode="CHAT", plan DEBE ser []
2. Si mode="EXECUTE", plan DEBE tener al menos 1 tool
3. Tool names MUST match exactly (case-sensitive)
4. JSON MUST be valid and parseable
5. NO markdown, SOLO JSON en respuesta`;
}

/**
 * Build unified user prompt with compressed context
 */
function buildUnifiedUserPrompt(goal, contextPack, snapshot, analyticsContext) {
  const contextInfo = contextPack.summary 
    ? `\nCONTEXTO COMPILADO:\n${contextPack.summary}`
    : '';

  const topRelations = contextPack.relations?.slice(0, 5)
    .map(r => `${r.fromName} → ${r.toName} (${r.type})`)
    .join('\n') || 'No disponibles';

  return `USUARIO PREGUNTA:
${goal}

CONTEXTO DISPONIBLE:
- Nodos relevantes: ${contextPack.nodes?.length || 0}
- Relaciones compiladas: ${contextPack.relations?.length || 0}
- Top relations:
${topRelations}
${contextInfo}
${analyticsContext ? `\nCONTEXTO ANALÍTICO:\n${analyticsContext}` : ''}

AHORA: Responde SOLO con JSON. Decide mode (CHAT o EXECUTE) y genera plan si es necesario.`;
}

/**
 * Backward compatibility - support old signature
 */
export async function createPlan(params) {
  // If has contextPack (new unified style), use unified planner
  if (params.contextPack) {
    return createUnifiedPlan(params);
  }

  // Legacy: convert old signature to unified
  logger.warn('⚠️  Legacy createPlan call detected, converting to unified');
  
  const legacyContextPack = {
    nodes: params.graph?.slice(0, 30).map(r => ({ name: r.fromName })) || [],
    relations: params.graph?.slice(0, 30) || [],
    summary: `${params.graph?.length || 0} relaciones disponibles`
  };

  return createUnifiedPlan({
    goal: params.goal,
    contextPack: legacyContextPack,
    snapshot: params.snapshot,
    analyticsContext: params.analyticsContext
  });
}
