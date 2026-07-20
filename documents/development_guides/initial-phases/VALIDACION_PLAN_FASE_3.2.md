# MATRIZ DE ANÁLISIS: ESTADO ACTUAL vs. PLAN FASE 3.2

## 📊 ANÁLISIS ARQUITECTÓNICO

### Stack Actual (Confirmado)

```
FRONTEND
  ↓
Node Backend (Agent Runtime) ✅ COMPLETO
  ├─ agent/ (planner, executor, controller)
  ├─ tools/ (13 tools integradas)
  ├─ routes/
  ├─ models/
  ├─ ai/ (embeddings, cache, etc.)
  └─ socket.js (realtime)
  ↓
Analytics Proxy (routes/analytics.js) ✅ BÁSICO
  └─ Simple HTTP pass-through (sin retry, sin circuit breaker)
  ↓
Python FastAPI (analytics/app.py) ✅ BÁSICO
  ├─ /quality
  ├─ /similarity
  ├─ /recommendation
  ├─ /impact
  ├─ /consistency
  └─ /health
  ↓
Cache (Redis) ✅ 
Database (MongoDB) ✅
```

---

## 🔄 FLUJOS ACTUALES

### 1. Agent → Analytics (Actual)

```
controller.js
  ↓
generateAgentContext() ← Llama analytics PARA contexto
  ├─ Fetch a /quality (múltiples requisitos)
  ├─ Fetch a /similarity (detectar duplicados)
  └─ Fetch a /impact (análisis de impacto)
  ↓
createPlan() ← Planner recibe contexto enriquecido
  ↓
executePlan() ← Executor ejecuta tools
```

**Problema actual**: Sin circuit breaker → Si analytics cae, cae todo el agente

---

### 2. Tools → Analytics (Actual)

Tres tools consultan analytics:
- `analyzeRequirement` → /quality
- `findDuplicates` → /similarity
- `checkConsistency` → /consistency

**Problema actual**: Sin retry, sin timeout dinámico

---

## ✅ LO QUE FUNCIONA (NO TOCAR)

| Componente | Estado | Razón |
|-----------|--------|-------|
| Agent orchestration | ✅ Sólido | FASE 3.1 completada |
| Planner + Executor | ✅ Sólido | Testeado y documentado |
| Agent tools (13) | ✅ Sólido | Integración validada |
| Frontend consumption | ✅ Sólido | APIs estables |
| Socket.io realtime | ✅ Sólido | Streaming base funciona |
| MongoDB persistence | ✅ Sólido | Schemas estables |
| Python basic analytics | ✅ Funcional | Endpoints básicos ok |

---

## ⚠️ LO QUE NECESITA MEJORA

| Componente | Problema | Impacto | Solución |
|-----------|----------|--------|----------|
| analytics.js proxy | Sin circuit breaker | Cascading failures | Crear analytics.client.js |
| analytics.js proxy | Sin retry | Falsos timeouts | Agregar p-retry |
| analytics.js proxy | Sin cache | Latencia repetida | Integrar Redis |
| analytics.js proxy | Sin timeout dinámico | Timeouts en proyectos grandes | Fórmula adaptativa |
| Python analytics | Endpoints limitados | Funcionalidad incompleta | Agregar semantic, graph, prediction |
| Python analytics | No hay persistencia | No hay audit trail | AnalyticsSnapshot model |
| Frontend | No consume analytics avanzado | Dashboards básicos | APIs agregadas |
| Realtime | No hay eventos de analytics | Actualizaciones lentas | Socket eventos nuevos |

---

## 🚀 IMPACTO DE PLAN FASE 3.2

### Por Etapa

| Etapa | Agrega | Mejora | Requiere |
|-------|--------|--------|----------|
| 1: Gateway | Circuit breaker, retry, cache, timeout | Estabilidad 10x | opossum, p-retry |
| 2: Semantic | Ambiguity detection, topics, drift | Calidad análisis | BERTopic |
| 3: Graph | Centrality, communities, propagation | Arquitectónica | NetworkX, igraph |
| 4: Prediction | Risk, missing reqs, anomalies | Predictiva | XGBoost, LightGBM |
| 5: Advanced | Clustering, forecasting, explainability | ML avanzado | UMAP, Prophet |
| 6: Persistencia | Snapshots, histórico | Auditoria | 3 nuevos models |
| 7: APIs | Dashboard aggregation | UX | 4 nuevos endpoints |
| 8: Realtime | Socket events | UX time | socket.js upgrade |

---

## 📋 CHECKLIST PRE-ETAPA 1

### Validaciones Necesarias

- [ ] `npm list | grep redis` → Confirmar Redis disponible
- [ ] `curl http://localhost:8000/health` → Python service funciona
- [ ] `npm test` → Test suite pasa en Node
- [ ] Confirmar FASE 3.1 sin breaking changes
- [ ] Confirmar agent funciona sin analytics (fallback)

### Dependencias a Instalar (para Etapa 1)

```bash
# Node
npm install opossum p-retry p-queue

# Python (requirements.txt)
# (No hay nuevas para etapa 1)
```

### Files Afectados (Etapa 1)

```
NEW:
  backend/ai/analytics.client.js
  backend/ai/analytics/retry-config.js
  backend/ai/analytics/circuit-breaker.js
  backend/ai/analytics/metrics-collector.js

MODIFY:
  backend/ai/agent/controller.js
  backend/routes/analytics.js
  
  backend/models/AnalyticsSnapshot.js (NUEVO)
  backend/models/PredictionLog.js (NUEVO)
  backend/models/GraphMetrics.js (NUEVO)
```

---

## 🔐 GARANTÍAS DE ESTABILIDAD

### Principio: No romper lo existente

**Gateway Fallback**:
```javascript
// Si analytics cae:
try {
  const analysis = await analyticsClient.analyze(...);
} catch (error) {
  // Fallback: usar último snapshot en cache
  const analysis = await getLastAnalyticsSnapshot(projectId);
  if (!analysis) {
    // Fallback final: continuar sin análisis
    return await createPlan({ goal, snapshot, graph }); // Sin analyticsContext
  }
}
```

**Agent continúa**: Sin analytics, agent planea con menos contexto pero no falla.

---

## 📈 ROADMAP VISUALIZADO

```
AHORA (Mayo 15)
├─ Node: FASE 3.1 ✅
├─ Python: Endpoints básicos ✅
├─ Gateway: Sin robustez ⚠️
└─ Analytics: Incompleto ⚠️

ETAPA 1 (1-2 días)
├─ Node: Gateway robusto ✅
├─ Stability: Circuit breaker, retry ✅
└─ Fallbacks: Funcionales ✅

ETAPA 2-3 (3-5 días)
├─ Python: Semantic + Graph ✅
├─ Agent: Usa análisis avanzado ✅
└─ Features: Diferencial ✅

ETAPA 4-5 (2-3 días)
├─ Python: Prediction + Advanced ✅
├─ ML: Integrado ✅
└─ Capabilities: Completo ✅

ETAPA 6-8 (2-3 días)
├─ Persistencia: Implementada ✅
├─ Visualización: Dashboards ✅
├─ Realtime: Socket events ✅
└─ MVP: Completo ✅

FUTURO (Post-MVP)
├─ Etapa 9: ML avanzado
├─ Optimizaciones
└─ Features adicionales
```

---

## 💡 DECISIONES CLAVE TOMADAS

### 1. **Analytics.client.js en Node (no en Python)**
- ✅ Pro: Circuit breaker en Node, fallback elegante
- ✅ Pro: Cache Redis cerca del agente
- ✅ Pro: Métricas distribuidas sencillas
- ❌ Con: Duplicación de lógica (mitigable)

### 2. **Modularizar Python en carpetas temáticas**
- ✅ Pro: Fácil de mantener
- ✅ Pro: Escalable a más features
- ✅ Pro: Tests por módulo
- ❌ Con: Más archivos (mitigable)

### 3. **Persistir AnalyticsSnapshot en MongoDB**
- ✅ Pro: Histórico disponible
- ✅ Pro: Audit trail completo
- ❌ Con: Más writes a Mongo (ok con batching)

### 4. **Realtime via Socket (no Server-Sent Events)**
- ✅ Pro: Ya existe socket.js
- ✅ Pro: Bidireccional (para futuro)
- ❌ Con: Más banda (mitigable con throttling)

### 5. **No incluir ML avanzado en MVP**
- ✅ Pro: Enfoque (completar 80% core)
- ✅ Pro: Timeline realista
- ✅ Pro: Puedo agregar después
- ❌ Con: Algunos features faltan (ok, futura)

---

## 🧪 TESTING STRATEGY

### Por Etapa

| Etapa | Unit Tests | Integration | E2E |
|-------|-----------|-------------|-----|
| 1 | analytics.client.js | Gateway ↔ Python | Agent ↔ Analytics |
| 2 | semantic.py | Routes ↔ Analyzer | Agent ↔ Semantic |
| 3 | graph.py | Routes ↔ Analyzer | Agent ↔ Graph |
| 4 | predictor.py | Routes ↔ Models | Agent ↔ Prediction |
| 5 | clustering.py | Routes ↔ Algorithms | Agent ↔ Advanced |
| 6 | models.js | MongoDB ↔ Storage | Persistence cycle |
| 7 | api.js | Aggregation | Dashboard consumption |
| 8 | socket.js | Event flow | Realtime updates |

---

## 📊 MÉTRICAS DE ÉXITO

### Etapa 1 (Gateway)
- [ ] Circuit breaker trips when Python down
- [ ] Retry attempts 3 veces antes de fallar
- [ ] Cache hit rate > 50% en llamadas repetidas
- [ ] Agent funciona 100% sin analytics
- [ ] Latencia promedio < 200ms (cached) vs 800ms (uncached)

### Etapa 2 (Semantic)
- [ ] 4 nuevos endpoints responden < 500ms
- [ ] Topic extraction agrupa similar concepts
- [ ] Ambiguity detection mejora quality scoring en 15%
- [ ] Semantic drift detects cambios conceptuales

### Etapa 3 (Graph)
- [ ] Centrality calcula en < 1s para proyectos 1000 nodos
- [ ] Community detection agrupa lógicamente
- [ ] Impact propagation simula cambios correctamente
- [ ] Agent evita cambios con alto impacto propagado

### Etapa 4 (Prediction)
- [ ] Risk predictor accuracy > 75%
- [ ] Missing relations detection recall > 80%
- [ ] Agent usa predictions para evitar errores

### Final (MVP)
- [ ] Zero agent failures debidos a analytics
- [ ] Dashboard carga en < 2s
- [ ] Realtime events < 100ms latency
- [ ] Historical snapshots consultables

---

## 🎯 CRITERIOS DE ACEPTACIÓN POR ETAPA

### Etapa 1: DONE cuando
- analytics.client.js existe y es usado por agent
- Circuit breaker detiene requests fallidas
- Retry logic reintenta automáticamente
- Timeout dinámico se calcula correctamente
- Redis cache tiene hit rate > 40%
- Agent continúa sin analytics si falla
- No hay regresiones en agent performance

### Etapa 2: DONE cuando
- /semantic/health funciona
- /semantic/topics extrae temas coherentes
- /semantic/ambiguity detecta problemas
- Planner consulta semantic health antes de plan
- BERTopic model carga correctamente
- Tests pasan para semantic analyzer

### Etapa 3: DONE cuando
- /graph/centrality calcula correctamente
- /graph/communities detecta agrupaciones
- /graph/propagation simula impacto
- NetworkX + igraph están instaladas
- Agent tiene tool graphAnalysis
- Tests pasan para graph analyzer

### Etc...

---

## 🚨 RIESGOS IDENTIFICADOS

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|--------|-----------|
| Python service lento | Media | Alto | Circuit breaker, timeout |
| MongoDB persistence overhead | Baja | Medio | Batching, TTL indexes |
| Socket.io memory leak | Baja | Medio | Memory profiling, limits |
| Dependency conflicts (py) | Media | Bajo | requirements.txt pinning |
| Breaking change en agent | Muy baja | Muy alto | Tests, gradual rollout |
| Redis unavailable | Baja | Bajo | Fallback a sin-cache |

---

## ✨ SUMMARY

**Plan FASE 3.2 es:**
- ✅ Realista (22-31h para MVP)
- ✅ Modular (8 etapas independientes)
- ✅ Seguro (no rompe FASE 3.1)
- ✅ Trazable (docs por etapa, checkpoints)
- ✅ Escalable (arquitectura permite expansión)

**Listo para implementar** una vez aprobado.

---

**Generado**: 15 Mayo 2026
**Status**: 🟡 Awaiting Approval
**Next**: Comenzar ETAPA 1 una vez validado el plan
