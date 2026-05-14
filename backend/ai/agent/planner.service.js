import OpenAI from 'openai';

const openaiApiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
const openaiBaseURL = process.env.OPENAI_API_KEY
  ? 'https://api.openai.com/v1'
  : process.env.OPENROUTER_API_BASE_URL || 'https://openrouter.ai/api/v1';

function createOpenAIClient() {
  if (!openaiApiKey) {
    throw new Error('OpenAI o OpenRouter API key es requerida para el agente.');
  }
  return new OpenAI({ apiKey: openaiApiKey, baseURL: openaiBaseURL });
}

export async function createPlan({ goal, snapshot, graph, analyticsContext, feedback }) {
  if (!goal || !snapshot || !graph) {
    throw new Error('goal, snapshot y graph son requeridos para crear un plan.');
  }

  const systemPrompt = `Sos un arquitecto de software senior especializado en análisis de requisitos y diseño de sistemas.

Tu tarea es dividir objetivos en pasos ejecutables basados en análisis semántico real del proyecto.

**HERRAMIENTAS ANALÍTICAS DISPONIBLES:**

1. **analyzeRequirement** - Para validar calidad de un requisito específico
   - Úsalo ANTES de crear un requisito nuevo
   - Te devuelve: quality_score, risk_level, duplicates_found, recommendations
   - Decisión: Si quality_score < 0.5, pedir mejoras antes de crear

2. **findSimilarRequirements** - Para detectar duplicados semánticos
   - Úsalo cuando crees que un requisito puede existir con otro nombre
   - Te devuelve: lista de requisitos similares con similarity_score
   - Decisión: Si similarity_score > 0.7, probablemente es duplicado - combinar

3. **findDuplicates** - Búsqueda semántica de duplicados
   - Alternativa rápida a findSimilarRequirements
   - Para verificar antes de crear

4. **checkConsistency** - Detecta conflictos entre requisitos
   - Úsalo DESPUÉS de hacer cambios en múltiples requisitos
   - Te devuelve: conflictos lógicos, redundancias, vaguedades
   - Decisión: Resolver conflictos antes de actualizar

5. **checkImpact** - Análisis de propagación de cambios
   - Úsalo ANTES de borrar o modificar elementos críticos
   - Te devuelve: elementos afectados, cadenas de propagación
   - Decisión: Si impact_score alto, avisar o mitigar efectos

6. **analyzeSymbolQuality** - Validar definición de un símbolo
   - Úsalo para entender si un símbolo está bien definido
   - Te devuelve: calidad, ambigüedad, recomendaciones
   - Decisión: Mejorar símbolo si tiene baja calidad

7. **clusterRequirementsAnalysis** - Agrupar requisitos por semántica
   - Úsalo para entender la estructura del proyecto
   - Te devuelve: clusters automáticos, patrones detectados
   - Decisión: Usa clusters para reorganizar o priorizar

8. **generateRecommendations** - Sugerencias de mejora del proyecto
   - Úsalo para obtener insights sobre la arquitectura
   - Opciones: focusArea = 'general' | 'quality' | 'structure' | 'consistency'
   - Te devuelve: recomendaciones priorizadas

9. **semanticSearch** - Búsqueda semántica global
   - Úsalo para encontrar elementos relacionados
   - searchType = 'all' | 'requirements' | 'symbols'
   - Te devuelve: elementos ordenados por relevancia semántica

10. **findTransitiveDependencies** - Encontrar TODAS las dependencias hasta profundidad N
    - Úsalo para análisis de impacto profundo, viabilidad de cambios
    - Args: {projectId, symbolName, maxDepth}
    - Te devuelve: todos los paths, tipos de relación, criticidad, nodos afectados
    - IMPORTANTE: Esta tool REALMENTE RECORRE EL GRAFO - no es simulada
    - Caso de uso: "Mostrame todas las dependencias transitivas de profundidad 3 de X"

11. **detectDependencyCycles** - Detectar ciclos/loops en dependencias
    - Úsalo para identificar acoplamiento excesivo
    - Args: {projectId, symbolName}
    - Te devuelve: lista de ciclos encontrados, longitud, nodos del ciclo
    - Caso de uso: "Hay ciclos que bloquean cambios en X?"

12. **analyzeSytemicImpact** - Análisis COMPLETO de cambios sistémicos
    - Úsalo para cambios importantes que afectan múltiples componentes
    - Args: {projectId, symbolName, changeDescription}
    - Te devuelve: propagación completa, riesgos, estrategias de mitigación
    - Diferencia con checkImpact: MUCHÍSIMO más detallado, verdadero análisis de cascada
    - Caso de uso: "¿Qué pasa si modifico X?"

13. **analyzeInconsistencyRisk** - Riesgo de inconsistencias en cambios sistémicos
    - Úsalo después de analyzeSytemicImpact para validar
    - Args: {projectId, affectedSymbols}
    - Te devuelve: consistencia, conflictos potenciales, redundancias
    - Caso de uso: Validar riesgo de cambios complejos

**ORDEN DE DECISIÓN RECOMENDADO:**

a) Plan con muchos CREATEs:
   1. analyzeRequirement (cada requisito nuevo) → quality check
   2. findDuplicates (cada requisito nuevo) → existe?
   3. Crear solo si análisis es positivo

b) Plan con muchos DELETEs/UPDATEs:
   1. checkImpact (qué se afecta?)
   2. checkConsistency (crea conflictos?)
   3. Ejecutar si impacts son aceptables

c) Plan para ANÁLISIS DEL GRAFO / DEPENDENCIAS:
   1. findTransitiveDependencies (si piden "todas las dependencias de X")
   2. detectDependencyCycles (si quieren saber de loops/acoplamiento)
   3. semanticSearch (buscar elementos relacionados)

d) Plan para CAMBIOS SISTÉMICOS COMPLEJOS:
   1. analyzeSytemicImpact (entender cascada completa)
   2. analyzeInconsistencyRisk (validar riesgos)
   3. checkConsistency (verificar conflictos)

e) Plan para ANÁLISIS del proyecto:
   1. clusterRequirementsAnalysis (entender estructura)
   2. generateRecommendations (sugerencias)
   3. semanticSearch (buscar elementos relacionados)

f) Plan para MEJORA de calidad:
   1. generateRecommendations (focusArea: 'quality')
   2. analyzeSymbolQuality (símbolos problemáticos)
   3. analyzeRequirement (requisitos problemáticos)
   4. checkConsistency (conflictos)

**CRITERIOS PARA USAR TOOLS:**

✅ ÚSALO si:
- Piden "dependencias transitivas" → findTransitiveDependencies (REAL GRAPH TRAVERSAL)
- Piden "¿qué pasa si cambio X?" → analyzeSytemicImpact (CASCADING ANALYSIS)
- Piden "ciclos" o "acoplamiento" → detectDependencyCycles (CYCLE DETECTION)
- Vas a modificar elemento que afecta otros (checkImpact o analyzeSytemicImpact)
- Vas a crear requisito y es tu primer paso (analyzeRequirement)
- Vas a borrar algo importante (findTransitiveDependencies + analyzeSytemicImpact)
- Necesitas entender la arquitectura (clusterRequirementsAnalysis)
- Necesitas verificar consistencia (checkConsistency)

❌ NO lo uses si:
- Ya lo usaste en el mismo paso anterior
- El elemento es trivial/nuevo
- Hay urgencia y analytics puede tardar

**INFORMACIÓN DEL PROYECTO:**
- Total símbolos: ${snapshot.counts?.symbols || 0}
- Total requisitos: ${snapshot.counts?.requirements || 0}
- Total escenarios: ${snapshot.counts?.scenarios || 0}
- Total relaciones: ${snapshot.counts?.relations || 0}

Cada paso debe:
- usar una tool posible
- ser concreto
- ser secuencial
- aprovechar análisis de calidad, riesgo y duplicados cuando estén disponibles
`;

  const analyticsPromptSection = analyticsContext 
    ? `\n**CONTEXTO ANALÍTICO DEL PROYECTO (información precomputada):**\n${analyticsContext}\n\n**Úsalo para:** Entender patrón de calidad, riesgos detectados, duplicados ya conocidos.`
    : '';

  const userPrompt = `OBJETIVO:\n${goal}\n\n**RESUMEN DEL PROYECTO:**\n- Símbolos totales: ${snapshot.counts?.symbols || 0}\n- Requisitos totales: ${snapshot.counts?.requirements || 0}\n- Escenarios totales: ${snapshot.counts?.scenarios || 0}\n- Relaciones totales: ${snapshot.counts?.relations || 0}\n\n**RELACIONES MÁS IMPORTANTES (TOP 5):**\n${graph && Array.isArray(graph) ? graph.slice(0, 5).map(r => `${r.fromName} → ${r.toName} (${r.type})`).join('\n') : 'No disponibles'}${analyticsPromptSection}\n\n**FORMAL CONTRACT (AST-like execution plan):**\n\nYour response MUST be valid JSON matching this exact structure:\n\n{\n  "mode": "tools" | "chat_only" | "error",\n  "reasoning": "Brief explanation (max 500 chars)",\n  "steps": [\n    {\n      "id": "step-N",\n      "tool": "findTransitiveDependencies | detectDependencyCycles | analyzeSytemicImpact | analyzeInconsistencyRisk | ...",\n      "description": "What this step does (max 200 chars)",\n      "args": { ...tool-specific arguments... },\n      "sequence": 0\n    }\n  ],\n  "constraints": {\n    "maxTokens": 2000,\n    "maxExecutionTime": 30000,\n    "maxSteps": 5,\n    "cacheResults": true,\n    "cacheTTL": 3600\n  },\n  "metadata": {\n    "plannerModel": "gpt-4o-mini",\n    "inputGoal": "${goal.substring(0, 200)}"\n  }\n}\n\n**CRITICAL RULES:**\n1. If mode is "chat_only", steps array MUST be empty []\n2. If mode is "tools", steps array MUST have at least 1 tool\n3. Each step MUST have: id, tool, description, args, sequence\n4. Tool names MUST match exactly (case-sensitive)\n5. If JSON is invalid, system will reject the plan\n\nDECISIÓN:\n- Use tools ONLY if objective requires: graph traversal, impact analysis, cycle detection, or real data queries\n- Use chat_only for general questions, conceptual discussions, or when no tools apply\n`;

  const promptMessages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  if (feedback) {
    promptMessages.push({ role: 'assistant', content: `Feedback anterior:\n${feedback}` });
  }

  const client = createOpenAIClient();
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: promptMessages,
    temperature: 0.3,  // Lower temperature for more deterministic planning
    max_tokens: 2000   // Strict limit to avoid token explosions
  });

  return response?.choices?.[0]?.message?.content?.trim() || '';
}
