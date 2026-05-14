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

**ORDEN DE DECISIÓN RECOMENDADO:**

a) Plan con muchos CREATEs:
   1. analyzeRequirement (cada requisito nuevo) → quality check
   2. findDuplicates (cada requisito nuevo) → existe?
   3. Crear solo si análisis es positivo

b) Plan con muchos DELETEs/UPDATEs:
   1. checkImpact (qué se afecta?)
   2. checkConsistency (crea conflictos?)
   3. Ejecutar si impacts son aceptables

c) Plan para ANÁLISIS del proyecto:
   1. clusterRequirementsAnalysis (entender estructura)
   2. generateRecommendations (sugerencias)
   3. semanticSearch (buscar elementos relacionados)

d) Plan para MEJORA de calidad:
   1. generateRecommendations (focusArea: 'quality')
   2. analyzeSymbolQuality (símbolos problemáticos)
   3. analyzeRequirement (requisitos problemáticos)
   4. checkConsistency (conflictos)

**CRITERIOS PARA USAR TOOLS:**

✅ ÚSALO si:
- Vas a modificar elemento que afecta otros (checkImpact)
- Vas a crear requisito y es tu primer paso (analyzeRequirement)
- Vas a borrar algo importante (checkImpact)
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

  const userPrompt = `OBJETIVO:\n${goal}\n\nPROYECTO:\n${JSON.stringify(snapshot, null, 2)}\n\nGRAFO DE RELACIONES:\n${JSON.stringify(graph, null, 2)}${analyticsPromptSection}\n\nSi recibís feedback, consideralo para ajustar el siguiente plan.\n\nRESPUESTA EN FORMATO JSON:\n{\n  "steps": [\n    {"description": "...", "tool": "analyzeRequirement|findDuplicates|...", "args": {...}}\n  ]\n}\n`;

  const promptMessages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  if (feedback) {
    promptMessages.push({ role: 'assistant', content: `Feedback anterior:\n${feedback}` });
  }

  const client = createOpenAIClient();
  const response = await client.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: promptMessages,
    temperature: 0.3  // Lower temperature for more deterministic planning
  });

  return response?.choices?.[0]?.message?.content?.trim() || '';
}
