/**
 * INTENT PLANNER
 * 
 * Capa 2 de la arquitectura estable de 4 capas (X.txt)
 * 
 * Responsabilidad ÚNICA: Decidir intención del usuario
 * 
 * ❌ NO HACE:
 * - No genera steps
 * - No elige tools específicos
 * - No maneja constraints complejos
 * - No ve el grafo completo
 * 
 * ✅ SOLO DEVUELVE:
 * {
 *   intent: "GRAPH_QUERY" | "CHAT" | "ANALYTICS" | "UNKNOWN",
 *   requiresExecution: boolean,
 *   complexity: "low" | "medium" | "high",
 *   strategyHint: string
 * }
 */

import OpenAI from 'openai';
import StructuredLogger from './logger/structured.logger.js';

const logger = new StructuredLogger('intent-planner');

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
 * Detect user intent with minimal context
 * 
 * This is a THIN layer - pure intention detection
 * No reasoning, no planning, no tool selection
 */
export async function detectIntent(goal, contextSummary) {
  logger.info('🧠 INTENT DETECTION START', {
    goal: goal.substring(0, 100),
    summaryLength: contextSummary?.length || 0
  });

  try {
    const systemPrompt = `Sos un clasificador de intenciones de usuario.

Tu ÚNICA tarea: Clasificar qué tipo de problema es la pregunta del usuario.

INTENCIONES POSIBLES:
1. GRAPH_QUERY: Navegación de grafo, dependencias, relaciones, estructuras
   Ejemplos: "dependencias de X", "ciclos", "paths más largos", "impacto de cambiar"
   
2. CHAT: Conversación general, conceptual, sin análisis específico
   Ejemplos: "cuéntame sobre", "explica", "comparación de conceptos"
   
3. ANALYTICS: Análisis de calidad, métricas, sugerencias
   Ejemplos: "recomendaciones", "problemas", "calidad del proyecto"
   
4. UNKNOWN: No se puede clasificar

REGLAS:
- Si mencionan "dependencias", "transitivo", "paths", "grafo", ciclos", "propagación" → GRAPH_QUERY
- Si pregunta conceptual o descriptiva → CHAT
- Si pregunta sobre "calidad", "recomendaciones", "problemas" → ANALYTICS
- Si es ambiguo → UNKNOWN (dejarás que otra capa decida)

RESPUESTA EN JSON (estricto):
{
  "intent": "GRAPH_QUERY" | "CHAT" | "ANALYTICS" | "UNKNOWN",
  "requiresExecution": boolean,
  "complexity": "low" | "medium" | "high",
  "strategyHint": "brief hint for execution planner",
  "confidence": 0.0 to 1.0
}

REGLA CRÍTICA: Responde SOLO JSON válido.`;

    const userPrompt = `Clasifica esta intención:

USUARIO PREGUNTA:
${goal}

${contextSummary ? `CONTEXTO DISPONIBLE:\n${contextSummary}` : 'SIN CONTEXTO PRE-COMPILADO'}

Responde SOLO JSON (sin markdown, sin explicación, sin preamble).`;

    const client = createOpenAIClient();
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,     // More deterministic classification
      max_tokens: 500       // Very small, just JSON
    });

    const intentText = response?.choices?.[0]?.message?.content?.trim() || '';

    logger.info('📤 INTENT PLANNER RESPONSE', {
      responseLength: intentText.length,
      tokens: response.usage?.completion_tokens || 0
    });

    // Parse intent JSON
    let intent;
    try {
      // Try direct JSON first
      intent = JSON.parse(intentText);
    } catch (e) {
      // Try extracting JSON from response
      const jsonMatch = intentText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        intent = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No valid JSON in intent planner response');
      }
    }

    // Validate intent structure
    const validated = validateIntentStructure(intent);
    
    logger.info('✅ INTENT DETECTED', {
      intent: validated.intent,
      complexity: validated.complexity,
      requiresExecution: validated.requiresExecution,
      confidence: validated.confidence,
      strategyHint: validated.strategyHint.substring(0, 100)
    });

    return validated;

  } catch (error) {
    logger.error('❌ INTENT DETECTION FAILED', {
      error: error.message,
      goal: goal.substring(0, 100)
    });

    // Fallback: return UNKNOWN intent
    return createUnknownIntent(goal);
  }
}

/**
 * Validate intent has required structure
 */
function validateIntentStructure(intent) {
  const valid = {
    intent: intent?.intent || 'UNKNOWN',
    requiresExecution: intent?.requiresExecution ?? false,
    complexity: intent?.complexity || 'low',
    strategyHint: intent?.strategyHint || 'No hint',
    confidence: intent?.confidence ?? 0.5
  };

  // Validate enum values
  if (!['GRAPH_QUERY', 'CHAT', 'ANALYTICS', 'UNKNOWN'].includes(valid.intent)) {
    valid.intent = 'UNKNOWN';
  }

  if (!['low', 'medium', 'high'].includes(valid.complexity)) {
    valid.complexity = 'low';
  }

  // Clamp confidence
  valid.confidence = Math.max(0, Math.min(1, valid.confidence));

  return valid;
}

/**
 * Create fallback UNKNOWN intent
 */
function createUnknownIntent(goal) {
  logger.warn('⚠️  Could not determine intent, using UNKNOWN fallback', {
    goal: goal.substring(0, 100)
  });

  return {
    intent: 'UNKNOWN',
    requiresExecution: false,
    complexity: 'low',
    strategyHint: 'Could not classify intent. Will default to chat.',
    confidence: 0.0
  };
}

/**
 * Helper: Check if intent requires execution
 */
export function intentRequiresExecution(intent) {
  return intent?.intent === 'GRAPH_QUERY' || intent?.intent === 'ANALYTICS';
}

/**
 * Helper: Convert intent to human readable string
 */
export function intentToString(intent) {
  const purposeMap = {
    'GRAPH_QUERY': 'Análisis de grafo y relaciones',
    'CHAT': 'Conversación y análisis conceptual',
    'ANALYTICS': 'Análisis de métricas y recomendaciones',
    'UNKNOWN': 'Intención desconocida'
  };

  return purposeMap[intent?.intent] || 'Unknown';
}
