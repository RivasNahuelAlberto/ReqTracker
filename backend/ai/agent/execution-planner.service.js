/**
 * EXECUTION PLANNER (Capa 3 de arquitectura 4-capas)
 * 
 * Responsabilidad: Convertir intención → ExecutionPlan formal
 * 
 * Input:
 * - intent: {intent, complexity, strategyHint} (de Intent Planner)
 * - contextPack: {nodes, relations, summary} (de Context Compiler)
 * - goal: user goal
 * - snapshot: project data
 * 
 * Output:
 * - planText: JSON string matching ExecutionPlanSchema
 * 
 * Diferencia con planner.service.js:
 * ✅ Recibe intent (ya decidido) → NO repite decisión
 * ✅ Recibe contextPack reducido → NO procesa 438 relaciones
 * ✅ Genera SOLO steps (no decide chat vs tools)
 * ✅ Más pequeño, más enfocado, más determinista
 */

import OpenAI from 'openai';

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
 * Create execution plan from intent and reduced context
 */
export async function createPlan({
  goal,
  intent,
  contextPack,
  snapshot,
  analyticsContext
}) {
  // Validate required inputs
  if (!goal || !intent || !contextPack) {
    throw new Error('goal, intent, y contextPack son requeridos.');
  }

  // Build system prompt based on INTENT
  const systemPrompt = buildSystemPrompt(intent, snapshot);

  // Build user prompt with reduced context
  const userPrompt = buildUserPrompt(goal, intent, contextPack, snapshot, analyticsContext);

  const client = createOpenAIClient();
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.3,     // Deterministic planning
    max_tokens: 2000      // Strict limit
  });

  const planText = response?.choices?.[0]?.message?.content?.trim() || '';

  if (!planText) {
    throw new Error('Execution planner returned empty response');
  }

  return planText;
}

/**
 * Build system prompt based on detected intent
 * 
 * This is MUCH simpler than the old planner because:
 * - Intent is already decided
 * - We don't need to explain all tools
 * - We only focus on tools relevant to this intent
 */
function buildSystemPrompt(intent, snapshot) {
  const intentType = intent.intent || 'UNKNOWN';

  // Base instructions common to all intents
  const baseInstructions = `Sos un planificador de ejecución especializado en análisis de requisitos.
Tu tarea: Convertir un objetivo en un plan formal de steps ejecutables.

REGLA CRÍTICA: Tu respuesta DEBE ser JSON válido. No markdown, no explicación, SOLO JSON.`;

  // Intent-specific tooling
  const toolingByIntent = {
    'GRAPH_QUERY': `
INTENT: GRAPH_QUERY
Objetivo: Navegar y analizar el grafo de dependencias

HERRAMIENTAS DISPONIBLES (solo las relevantes):
1. findTransitiveDependencies - Recorre el grafo hasta profundidad N
2. detectDependencyCycles - Detecta ciclos/loops
3. semanticSearch - Búsqueda semántica
4. analyzeSytemicImpact - Análisis de cascada de cambios
5. analyzeInconsistencyRisk - Validación de riesgos

ESTRATEGIA TÍPICA:
- findTransitiveDependencies (para recorridos)
- detectDependencyCycles (si preguntan sobre ciclos)
- analyzeSytemicImpact (si preguntan sobre impacto)`,

    'ANALYTICS': `
INTENT: ANALYTICS
Objetivo: Analizar métricas, calidad y generar recomendaciones

HERRAMIENTAS DISPONIBLES (solo las relevantes):
1. generateRecommendations - Sugerencias de mejora (focusArea: quality|structure|consistency)
2. clusterRequirementsAnalysis - Agrupar requisitos por semántica
3. analyzeSymbolQuality - Validar definición de símbolos
4. analyzeRequirement - Validar calidad de requisitos
5. checkConsistency - Detectar conflictos

ESTRATEGIA TÍPICA:
- clusterRequirementsAnalysis (entender estructura)
- generateRecommendations (obtener insights)
- analyzeSymbolQuality (si preguntan de símbolos específicos)`,

    'UNKNOWN': `
INTENT: UNKNOWN
Objetivo: Indeterminado - default a chat_only

DECISIÓN: Si no entiendes intent claramente, usa mode: "chat_only"
No intentes forzar tools si el objetivo es conceptual.`
  };

  const intentTools = toolingByIntent[intentType] || toolingByIntent['UNKNOWN'];

  return `${baseInstructions}

${intentTools}

DATOS DEL PROYECTO:
- Símbolos: ${snapshot.counts?.symbols || 0}
- Requisitos: ${snapshot.counts?.requirements || 0}
- Escenarios: ${snapshot.counts?.scenarios || 0}

FORMATO DE RESPUESTA (OBLIGATORIO):
{
  "mode": "tools" | "chat_only",
  "reasoning": "Explicación breve (max 500 chars)",
  "steps": [
    {
      "id": "step-N",
      "tool": "nombre_herramienta_exacto",
      "description": "Qué hace este step",
      "args": { ...argumentos específicos... },
      "sequence": 0
    }
  ],
  "constraints": {
    "maxTokens": 2000,
    "maxExecutionTime": 30000,
    "maxSteps": 5,
    "cacheResults": true,
    "cacheTTL": 3600
  },
  "metadata": {
    "plannerModel": "gpt-4o-mini",
    "inputGoal": "goal truncado"
  }
}

REGLAS:
1. Si no hay pasos claros, usa mode: "chat_only" con steps: []
2. Si mode: "tools", DEBE haber al menos 1 step
3. Nombres de tools: case-sensitive, deben coincidir exactamente
4. JSON DEBE ser válido (parseableJSON.parse())`;
}

/**
 * Build user prompt with reduced context and intent info
 */
function buildUserPrompt(goal, intent, contextPack, snapshot, analyticsContext) {
  const contextNodesInfo = contextPack.nodes?.length 
    ? `${contextPack.nodes.length} nodos (reducido de 438 totales)`
    : 'contexto reducido';

  const intentInfo = `
INTENT DETECTADO: ${intent.intent}
Complejidad: ${intent.complexity}
Confianza: ${Math.round(intent.confidence * 100)}%
Estrategia sugerida: ${intent.strategyHint}`;

  const contextInfo = contextPack.summary 
    ? `\nCONTEXTO COMPILADO:\n${contextPack.summary}`
    : '';

  /**
   * Format relation for display (safety: handles missing fields)
   */
  function formatRelation(r) {
    if (!r || typeof r !== 'object') return 'relación-inválida';
    const from = r.fromName || 'origen?';
    const to = r.toName || 'destino?';
    const type = r.type || 'tipo?';
    return `${from} → ${to} (${type})`;
  }

  const topRelations = contextPack.relations?.slice(0, 5)
    .map(formatRelation)
    .join('\n') || 'No disponibles';

  return `OBJETIVO DEL USUARIO:
${goal}

${intentInfo}

CONTEXTO DEL PROYECTO (compilado):
- Nodos incluidos: ${contextNodesInfo}
- Relaciones compiladas:
${topRelations}

${contextInfo}

${analyticsContext ? `\nCONTEXTO ANALÍTICO:\n${analyticsContext}` : ''}

AHORA: Genera un plan JSON formal para ejecutar este objetivo.
Basado en el INTENT detectado, elige las herramientas y steps apropiados.`;
}

// ────────────────────────────────────────────────────────────────────
// BACKWARD COMPATIBILITY: Support old calling signature
// ────────────────────────────────────────────────────────────────────

/**
 * Legacy support: if called with old signature (goal, snapshot, graph)
 * convert to new signature (goal, intent, contextPack)
 */
export async function createPlanLegacy({
  goal,
  snapshot,
  graph,
  analyticsContext,
  feedback
}) {
  // Simulate intent detection for legacy calls
  const legacyIntent = {
    intent: 'GRAPH_QUERY',  // Assume graph operations for legacy
    complexity: 'medium',
    confidence: 0.5,
    strategyHint: 'Legacy call - using default intent'
  };

  // Convert legacy graph to contextPack format (with safety checks)
  const legacyContextPack = {
    nodes: graph?.slice(0, 30).map(r => ({ 
      name: (r && r.fromName) ? r.fromName : 'nodo-desconocido' 
    })) || [],
    relations: graph?.slice(0, 30) || [],
    summary: `${graph?.length || 0} relaciones disponibles (legacy mode)`
  };

  return createPlan({
    goal,
    intent: legacyIntent,
    contextPack: legacyContextPack,
    snapshot,
    analyticsContext
  });
}

// Keep backward compatibility - export as default planner
export async function createPlanWrapper(params) {
  // If has intent and contextPack, use new architecture
  if (params.intent && params.contextPack) {
    return createPlan(params);
  }

  // Otherwise use legacy path
  return createPlanLegacy(params);
}
