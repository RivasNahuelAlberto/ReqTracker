# Integración Agente ↔ Analytics

## 🎯 Objetivo
Cerrar la brecha entre el agente autónomo y el microservicio de analytics, permitiendo que el agente tome decisiones basadas en análisis semántico real, detección de duplicados, scoring de calidad y evaluación de riesgos.

## ✅ Estado: IMPLEMENTADO

### Cambios Realizados

#### 1. **Controller Enriquecido** (`agent/controller.js`)
```javascript
// Agregado: generar contexto analítico antes de planear
const analysis = await generateAgentContext(snapshot);
const analyticsContext = formatAnalysisForPrompt(analysis);

const planText = await createPlan({ goal, snapshot, graph, analyticsContext });
```

**Beneficio**: El LLM recibe en el primer paso:
- Insights de calidad (requisitos con baja calidad)
- Insights de riesgo (requisitos con riesgos críticos)
- Advertencias de duplicados (requisitos potencialmente duplicados)
- Acciones recomendadas por analytics
- Resumen de clustering (estructura del proyecto)

#### 2. **Planner Mejorado** (`agent/planner.service.js`)
```javascript
export async function createPlan({ goal, snapshot, graph, analyticsContext, feedback })
```

**Cambios**:
- Nuevo parámetro `analyticsContext`
- System prompt mejorado: menciona análisis semántico explícitamente
- User prompt incluye sección "ANÁLISIS SEMÁNTICO DEL PROYECTO" con contexto real
- El LLM genera pasos basados en análisis, no solo en el grafo

**Beneficio**: El plan generado es más inteligente:
- Evita crear requisitos que analytics identifica como duplicados
- Prioriza la calidad (no crea requisitos con vaguedad detectada)
- Considera riesgos técnicos reales
- Sigue recomendaciones del análisis semántico

#### 3. **Tres Nuevas Tools** (`agent/toolImplementations.js`)

##### Tool: `analyzeRequirement`
```javascript
analyzeRequirement: async ({ requirementText, projectId, context = {} })
```
- Llama a `/agent/analyze` de analytics
- Retorna: quality_score, risk_level, duplicates_found, recommendations
- El agente puede usarla para validar un requisito ANTES de crearlo

##### Tool: `findDuplicates`
```javascript
findDuplicates: async ({ requirementText, projectId, threshold = 0.65, limit = 5 })
```
- Búsqueda semántica en analytics
- Retorna: lista de requisitos similares con similarity_score
- El agente puede detectar si un requisito ya existe conceptualmente

##### Tool: `checkConsistency`
```javascript
checkConsistency: async ({ requirements, projectId })
```
- Análisis de consistencia entre requisitos
- Detecta conflictos, redundancias, lógica contradictoria
- El agente puede verificar que sus cambios no creen inconsistencias

**Beneficio**: El agente puede ahora consultar analytics DURANTE la ejecución:
```
Paso 1: Generar idea para nuevo requisito
Paso 2: Usar analyzeRequirement para verificar calidad
Paso 3: Usar findDuplicates para evitar duplicados
Paso 4: Usar checkConsistency para validar
Paso 5: Crear el requisito si todo valida
```

#### 4. **Snapshot Completo** (`tools/projectSnapshot.tool.js`)

**Antes**:
```
- sampleSymbols: máximo 12
- sampleRequirements: máximo 10
```

**Ahora**:
```
- symbols: TODOS los símbolos del proyecto
- requirements: TODOS los requisitos del proyecto  
- scenarios: TODOS los escenarios (nuevo)
- Cada elemento incluye embeddings para análisis posterior
```

**Beneficio**: El agente tiene visibilidad total del proyecto:
- Análisis arquitectónico completo sin muestreo
- Detección real de duplicados y redundancias
- Identificación de entidades centrales vs. débiles
- Mejor razonamiento sobre refactorizaciones

## 🔄 Flujo Completo (Antes vs. Después)

### ANTES: Sistema Desconectado
```
[Agent] → Plan (solo con LLM reasoning)
       → Ejecuta tools (CRUD básicas)
       → No consulta analytics nunca
       ❌ Decisiones sin datos semánticos reales
```

### DESPUÉS: Sistema Integrado
```
[Snapshot] ← Incluye TODOS los elementos
        ↓
[generateAgentContext] ← Llama analytics para análisis
        ↓
[createPlan] ← Plan enriquecido con insights
        ↓
[executePlan]
    ├─ createRequirement / updateSymbol / etc (como antes)
    ├─ analyzeRequirement ← Valida con analytics
    ├─ findDuplicates ← Verifica no crear duplicados
    └─ checkConsistency ← Evita inconsistencias
        ↓
✅ Decisiones basadas en datos semánticos reales
```

## 📊 Impacto en Prompts (10 ejemplos del documento anterior)

| Prompt | Antes | Después |
|--------|-------|---------|
| 1. Análisis completo | Opinión del LLM | **Métricas reales + LLM** |
| 2. Reorganización estructural | Muestra de 12 símbolos | **Todos los símbolos** |
| 3. Análisis arquitectónico | Parcial | **Completo + clustering real** |
| 4. Plan de simplificación | Genérico | **Basado en análisis real** |
| 5. Elementos sobre-modelados | Intuición | **Detección semántica** |
| 6. Impacto indirecto | No disponible | **Grafo completo + analytics** |
| 7. Dependencias directas | Muestra parcial | **Datos completos** |
| 8. Calidad de símbolo | Sin score | **Quality score real** |
| 9. Riesgos técnicos | Heurística | **Impact analysis real** |
| 10. Calidad de requisito | Vaguedad detectada por LLM | **Quality score + NER + checks** |

## 🚀 Ciclo de Aprendizaje (Futuro)

Próximo paso (cuando se implemente base de conocimiento):
```
[Analytics Analysis]
    ↓
[Validación: quality_score > 0.85 && is_consistent]
    ↓
[Guardar como KnowledgeEntry en MongoDB]
    ↓
[Próximas sesiones consultan KB para ejemplos positivos]
    ↓
✨ El sistema mejora con cada análisis exitoso
```

## 📋 Checklist de Validación

- [ ] Backend redeploy exitoso (sin errores de sintaxis)
- [ ] `/agent/run` recibe analytics context en el plan
- [ ] Las 3 nuevas tools (`analyzeRequirement`, `findDuplicates`, `checkConsistency`) ejecutan sin error
- [ ] El snapshot incluye TODOS los símbolos/requisitos (verificar en logs)
- [ ] Analytics service está corriendo (`ANALYTICS_URL` configurado)
- [ ] Redis está corriendo (para cacheo de embeddings)
- [ ] Tests manuales: enviar 3 goals distintos y verificar planes

## 🔧 Configuración Requerida

```env
# En .env del backend
ANALYTICS_URL=http://localhost:8000  # o URL de producción en Render
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=... # o OPENROUTER_API_BASE_URL
```

```env
# En analytics (Python, si está en local)
REDIS_URL=redis://localhost:6379
MODEL_NAME=all-MiniLM-L6-v2
```

## 🐛 Troubleshooting

**Problema**: Analytics context es null/vacío
- Verificar que `/agent/analyze` endpoint de analytics responde
- Revisar logs de analytics para errores

**Problema**: Las nuevas tools lanzan error
- Verificar `ANALYTICS_URL` está configurado
- Revisar que analytics está running

**Problema**: Snapshot es muy grande y causa timeout
- Esto es normal para proyectos grandes
- Considerar paginación si > 1000 elementos

## 📝 Notas Técnicas

- **generateAgentContext**: Muestrea los primeros 5 requisitos para análisis inicial (no todos, para velocidad)
- **formatAnalysisForPrompt**: Transforma respuesta de analytics en formato legible para el LLM
- **Fallback**: Si analytics no responde, el agente continúa sin contexto (degradado pero funcional)
- **Embeddings**: Se incluyen en snapshot pero no se envían al LLM (demasiado volumen)
