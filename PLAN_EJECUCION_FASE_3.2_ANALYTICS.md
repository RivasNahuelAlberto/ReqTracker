# PLAN DE EJECUCIÓN FASE 3.2 - Analytics Intelligence Platform
## Integración de Servicios Pesados Python a Arquitectura Actual

**Fecha**: 15 de Mayo, 2026  
**Estado**: PLAN PRELIMINAR (A VALIDAR)  
**Prioridad**: Integrar analytics pesado sin romper FASE 3.1  

---

## 🗂️ ESTADO ACTUAL DEL SISTEMA

### ✅ YA IMPLEMENTADO

#### Node Backend (FASE 3.1 Completo)
- Agent Runtime funcional con planner y executor
- 13 tools integradas
- Snapshot completo de proyectos
- Integración AGENT_ANALYTICS_INTEGRATION.md presente
- Cache Redis con embeddings
- StructuredLogger y observabilidad

#### Python Analytics (Básico)
- FastAPI app.py con endpoints:
  - `/quality` - Scoring de calidad de requisitos
  - `/similarity` - Similitud semántica
  - `/recommendation` - Recomendaciones
  - `/impact` - Predicción de impacto
  - `/consistency` - Validación de consistencia
  - `/health` - Health check
- Modelos NLP: spaCy, sentence-transformers
- Stack mínimo: sklearn, numpy

#### Puente Node↔Python
- `backend/routes/analytics.js` - Proxy HTTP simple
- Sin circuit breaker, retry, o cache
- Sin manejo de timeouts adaptativos
- Sin métricas de latencia

#### MongoDB Models
- Project, Requirements, Symbols, Scenarios, Memory
- Sin modelos para análisis persistente (snapshots, predictions)

---

## 🎯 OBJETIVO FINAL

**Arquitectura de 3 capas totalmente funcional**:

```
FRONTEND (Dashboards)
    ↓
NODE BACKEND (Agent Runtime)
    ↓
ANALYTICS GATEWAY (Circuit breaker, cache, retry)
    ↓
PYTHON SERVICE (Heavy ML + Graph algorithms)
    ↓
SHARED CACHE (Redis)
    ↓
DATABASE (MongoDB)
```

---

## 📋 PLAN DE EJECUCIÓN ESTRUCTURADO

### ETAPA 1: Analytics Gateway Robusto
**Tiempo**: 2-3 horas  
**Prioridad**: CRÍTICA (sin esto, analytics es frágil)

#### 1.1 Crear `backend/ai/analytics.client.js`
- Circuit breaker (opossum)
- Retry automático (p-retry)
- Timeout dinámico
- Cache Redis
- Métricas de latencia
- Tracing distribuido

#### 1.2 Integrar en `backend/ai/agent/controller.js`
- Usar analytics.client en lugar de fetch directo
- Fallback elegante si analytics no disponible
- Logging de failures

#### 1.3 Nuevos modelos MongoDB
- AnalyticsSnapshot (guardar snapshots de análisis)
- PredictionLog (auditar predicciones)
- GraphMetrics (guardar metricas del grafo)

**CHECKPOINT A**: Gateway funcional, zero downtime si analytics cae

---

### ETAPA 2: Python Analytics - Semantic Intelligence
**Tiempo**: 3-4 horas  
**Prioridad**: ALTA (funcionalidad diferencial)

#### 2.1 Refactorizar `analytics/app.py`
- Modularizar endpoints actual
- Agregar manejo de errores robusto
- Logging estructurado

#### 2.2 Crear `analytics/semantic/semantic_analyzer.py`
- `calculate_semantic_health()` - coherencia, redundancia, ambigüedad
- `detect_ambiguity()` - símbolos ambiguos, verbos genéricos
- `detect_semantic_drift()` - cambios conceptuales
- `topic_extraction()` - BERTopic (NUEVO)

#### 2.3 Crear `analytics/semantic/routes.py`
Nuevos endpoints:
```
POST /semantic/health - Analyzes semantic quality
POST /semantic/drift - Detects concept drift
POST /semantic/topics - Topic extraction with BERTopic
POST /semantic/ambiguity - Ambiguity detection
```

#### 2.4 Integrar en planner del agente
- Planner consulta semantic health antes de generar plan
- Usa topic extraction para better context

**CHECKPOINT B**: Semantic analytics funcional, expone 4 nuevos endpoints

---

### ETAPA 3: Python Analytics - Graph Intelligence
**Tiempo**: 4-5 horas  
**Prioridad**: ALTA (análisis arquitectónico)

#### 3.1 Crear `analytics/graph/graph_analyzer.py`
Librerías: networkx, python-igraph (NUEVAS)

#### 3.2 Implementar funciones core
- `calculate_centrality()` - PageRank, betweenness, degree
- `detect_communities()` - Louvain algorithm
- `analyze_graph_metrics()` - density, diameter, clustering coefficient
- `simulate_impact_propagation()` - MUY IMPORTANTE

#### 3.3 Crear `analytics/graph/routes.py`
Nuevos endpoints:
```
POST /graph/centrality - Calcula criticidad de nodos
POST /graph/communities - Detecta agrupaciones
POST /graph/metrics - Métricas globales del grafo
POST /graph/propagation - Simula propagación de cambios
```

#### 3.4 Integrar en tools del agente
- Nueva tool: `graphAnalysis` consulta impacto
- Nueva tool: `communityDetection` para reorganización

**CHECKPOINT C**: Graph analytics funcional, agent puede analizar impacto

---

### ETAPA 4: Python Analytics - Prediction & Risk
**Tiempo**: 3-4 horas  
**Prioridad**: MEDIA-ALTA (agrega valor pero menos crítico)

#### 4.1 Crear `analytics/prediction/predictor.py`
- `predict_requirement_risk()` - XGBoost/LightGBM
- `predict_missing_relations()- Inference
- `predict_missing_requirements()` - Pattern-based
- `predict_inconsistencies()` - Logical analysis

#### 4.2 Crear `analytics/prediction/routes.py`
```
POST /predict/risk - Risk scoring
POST /predict/missing-relations - Relation gaps
POST /predict/requirements - Missing requirements
```

#### 4.3 Integrar en tools
- Nueva tool: `predictRequirementRisk`
- Nueva tool: `findMissingRequirements`

**CHECKPOINT D**: Prediction engine funcional

---

### ETAPA 5: Python Analytics - Advanced Features
**Tiempo**: 3-4 horas  
**Prioridad**: MEDIA (nice-to-have inicialmente)

#### 5.1 Clustering avanzado
- `analytics/clustering/semantic_clustering.py`
- Usar HDBSCAN + UMAP
- Detectar emergent patterns

#### 5.2 Time series & Forecasting
- `analytics/forecasting/trends.py`
- Prophet para complejidad
- statsmodels para correlaciones

#### 5.3 Explainability
- `analytics/explainability/explainer.py`
- SHAP values para modelos ML
- Trace explicaciones de clustering

**CHECKPOINT E**: Features avanzados funcionales

---

### ETAPA 6: Persistencia Analítica
**Tiempo**: 2-3 horas  
**Prioridad**: MEDIA (observabilidad)

#### 6.1 MongoDB models
```
AnalyticsSnapshot {
  projectId
  timestamp
  semanticHealth
  graphMetrics
  predictions
  cached: boolean
}

PredictionLog {
  projectId
  predictionType
  input
  output
  accuracy (cuando hay feedback)
}
```

#### 6.2 Storage strategy
- Snapshots: Guardar cada análisis en MongoDB
- Cache: Redis con TTL (30 min para analytics pesado)
- Histórico: Mantener últimos 100 snapshots por proyecto

**CHECKPOINT F**: Persistencia funcional, histórico disponible

---

### ETAPA 7: Visualization APIs
**Tiempo**: 2-3 horas  
**Prioridad**: MEDIA (frontend benefit)

#### 7.1 Nuevos endpoints Node
```
GET /analytics/dashboard/:projectId
GET /analytics/graph/:projectId
GET /analytics/risk/:projectId
GET /analytics/semantic/:projectId
```

#### 7.2 Agregación de datos
- Combina graph metrics + semantic health + predictions
- Formatea para frontend (Cytoscape, ECharts)
- Maneja fallbacks elegantemente

**CHECKPOINT G**: Dashboards consumibles

---

### ETAPA 8: Realtime Streaming
**Tiempo**: 1-2 horas  
**Prioridad**: MEDIA (UX improvement)

#### 8.1 Expandir `backend/socket.js`
Nuevos eventos:
```
analytics:update - Nueva análisis disponible
graph:recomputed - Grafo re-calculado
prediction:generated - Predicción nueva
semantic:drift - Detectado drift
risk:detected - Riesgo crítico
```

#### 8.2 Agent streaming
- Agent publica eventos cuando llama analytics
- Frontend recibe actualizaciones en tiempo real

**CHECKPOINT H**: Streaming funcional

---

### ETAPA 9: ML Avanzado (OPCIONAL)
**Tiempo**: 4-5 horas  
**Prioridad**: BAJA (Fase posterior)

- Recomendation engine
- Graph embeddings (Node2Vec)
- Adaptive ranking
- Behavioral analysis

**CHECKPOINT I**: ML avanzado (skip en MVP)

---

## 📊 TABLA DE ETAPAS

| Etapa | Componente | Tiempo | Prioridad | Status |
|-------|-----------|--------|-----------|--------|
| 1 | Analytics Gateway | 2-3h | CRÍTICA | - |
| 2 | Semantic Intelligence | 3-4h | ALTA | - |
| 3 | Graph Analytics | 4-5h | ALTA | - |
| 4 | Prediction Engine | 3-4h | MEDIA-ALTA | - |
| 5 | Advanced Features | 3-4h | MEDIA | - |
| 6 | Persistencia Analítica | 2-3h | MEDIA | - |
| 7 | Visualization APIs | 2-3h | MEDIA | - |
| 8 | Realtime Streaming | 1-2h | MEDIA | - |
| 9 | ML Avanzado | 4-5h | BAJA | SKIP MVP |

**Total MVP**: ~22-31 horas (~3-4 días)

---

## 🛠️ TECNOLOGÍAS NUEVAS A AGREGAR

### Python
```
pip install bertopic                # Topic modeling
pip install python-igraph          # Graph algorithms (faster)
pip install node2vec               # Graph embeddings
pip install hdbscan                # Advanced clustering
pip install umap-learn             # Dimensionality reduction
pip install prophet                # Time series forecasting
pip install lightgbm               # Fast gradient boosting
```

### Node
```
npm install opossum                 # Circuit breaker
npm install p-retry                 # Retry logic
npm install p-queue                 # Request queueing
```

---

## 🏗️ ARQUITECTURA ARCHIVOS NUEVOS

```
backend/
├── ai/
│   ├── analytics.client.js          # ETAPA 1
│   ├── analytics/                   # NUEVA CARPETA
│   │   ├── retry-config.js
│   │   ├── circuit-breaker.js
│   │   └── metrics-collector.js
│   └── tools/
│       ├── graph-analytics.tool.js   # ETAPA 3
│       ├── semantic-health.tool.js   # ETAPA 2
│       └── prediction.tool.js        # ETAPA 4
│
├── models/
│   ├── AnalyticsSnapshot.js         # ETAPA 6
│   ├── PredictionLog.js             # ETAPA 6
│   └── GraphMetrics.js              # ETAPA 6
│
└── routes/
    └── analytics.js (REFACTOR)      # Agregar ETAPA 7

analytics/
├── app.py (REFACTOR)
├── semantic/                        # ETAPA 2
│   ├── routes.py
│   ├── semantic_analyzer.py
│   ├── topic_modeling.py
│   └── ambiguity_detector.py
│
├── graph/                           # ETAPA 3
│   ├── routes.py
│   ├── graph_analyzer.py
│   ├── centrality.py
│   ├── communities.py
│   └── propagation.py
│
├── prediction/                      # ETAPA 4
│   ├── routes.py
│   ├── predictor.py
│   ├── risk_models.py
│   └── recommendation.py
│
├── clustering/                      # ETAPA 5
│   ├── semantic_clustering.py
│   └── pattern_mining.py
│
├── forecasting/                     # ETAPA 5
│   ├── trends.py
│   └── forecaster.py
│
├── explainability/                  # ETAPA 5
│   ├── explainer.py
│   └── interpretability.py
│
├── cache/                           # ETAPA 6
│   └── analytics_cache.py
│
├── pipelines/                       # ETAPA 6
│   ├── analysis_pipeline.py
│   └── batch_processing.py
│
├── models/                          # ETAPA 6
│   ├── ml_models.py
│   └── feature_engineering.py
│
└── requirements.txt (UPDATED)
```

---

## 🔗 INTEGRACIONES CON CÓDIGO EXISTENTE

### Agent Flow (Sin cambios, pero mejorado)

```javascript
// controller.js - Ya existe, se llama a analytics.client
const analysis = await analyticsClient.generateContext(snapshot);

// planner.service.js - Ya existe
const plan = await createPlan({ goal, snapshot, graph, analyticsContext });

// executor.js - Ya existe, tools pueden llamar analytics
const tool = await analyzeRequirement({ text, projectId }); // analytics.client
```

### Tools Flow (Extend, don't break)

```javascript
// toolImplementations.js
// Existing tools:
- createRequirement
- updateSymbol
- checkConsistency (ya existe, mejorarlo)

// New tools (agregar):
- graphAnalysis (ETAPA 3)
- semanticHealth (ETAPA 2)
- predictRisk (ETAPA 4)
- clusterPatterns (ETAPA 5)
```

---

## ✅ PRINCIPIOS DE IMPLEMENTACIÓN

### 1. **Zero Downtime**
- Analytics.client tiene fallback si Python no disponible
- Agent continúa funcionando sin analytics
- Graceful degradation en todos los niveles

### 2. **Modularidad**
- Cada etapa es independiente
- Puedo implementar etapas en cualquier orden (después de 1)
- Cada etapa tiene sus propios tests

### 3. **Trazabilidad**
- Cada cambio vinculado a etapa
- Comments en código referenciando etapa
- Docs actualizadas por cada etapa

### 4. **Estabilidad**
- Validaciones de input robustas
- Error handling exhaustivo
- No rompe FASE 3.1

### 5. **Observabilidad**
- Métricas en cada endpoint
- Logs estructurados
- Tracing distribuido

---

## 📊 CHECKPOINTS DE VALIDACIÓN

### Después de ETAPA 1 (Gateway)
- [ ] analytics.client.js está en production
- [ ] Circuit breaker detiene llamadas fallidas
- [ ] Redis caching funciona
- [ ] Retry logic reintentos correctamente
- [ ] Agent sigue funcionando si analytics cae

### Después de ETAPA 2 (Semantic)
- [ ] 4 nuevos endpoints Python
- [ ] Agent consultacon semantic health
- [ ] Planner usa insights semánticos
- [ ] BERTopic integrado

### Después de ETAPA 3 (Graph)
- [ ] NetworkX + igraph funcionando
- [ ] Centrality analysis funciona
- [ ] Community detection funciona
- [ ] Impact propagation simula cambios
- [ ] Agent puede analizar impacto

### Después de ETAPA 4 (Prediction)
- [ ] Risk predictor funcional
- [ ] Missing relations detection
- [ ] Agent evita predicciones arriesgadas

### Después de ETAPA 6 (Persistencia)
- [ ] Snapshots se guardan en MongoDB
- [ ] Redis cache con TTL funciona
- [ ] Histórico disponible

### Después de ETAPA 7 (APIs)
- [ ] Dashboard APIs funcionales
- [ ] Frontend puede consumir

### Después de ETAPA 8 (Realtime)
- [ ] Eventos socket.io fluyen
- [ ] Frontend recibe updates

---

## ⚠️ CONSIDERACIONES CRÍTICAS

### 1. **No enviar embeddings gigantes**
- Node no debería pasar todos los embeddings a Python
- En su lugar: pasar projectId + entityIds
- Python cachea embeddings localmente

### 2. **Timeout dinámico**
- Analytics puede ser lento con proyectos grandes
- Timeout = 5s base + (projectSize/200)*1s, máx 15s
- Implementar en analytics.client.js

### 3. **Circuit breaker es crítico**
- Si Python cae, Node debe continuar
- No hacer fallback a Node (malo)
- Usar último snapshot cacheado

### 4. **Métricas distribuidas**
- Rastrear latencia Node → Python
- Rastrear latencia Python internamente
- Correlacionar en dashboards

### 5. **Test con datos reales**
- Antes de producción: test con proyectos grandes (1000+ reqs)
- Verificar timeouts, memory usage
- Benchmark comparación Python vs Node para analisis

---

## 📝 PRÓXIMOS PASOS

1. **Validar este plan** (requiere aprobación)
2. **Comenzar ETAPA 1** (Analytics Gateway)
3. **Checkpoint A** antes de pasar a ETAPA 2
4. **Implementar progresivamente** etapas 2-8
5. **MVP**: Completar etapas 1-7 (~22-31h)
6. **Future**: Etapa 9 si hay tiempo

---

## 📌 NOTAS IMPORTANTES

- **No romper FASE 3.1**: Todos los cambios son aditivos
- **Aprovechar lo existente**: AGENT_ANALYTICS_INTEGRATION.md ya tiene integración
- **Priorizar estabilidad**: Mejor algo funcional que medio-hecho
- **Documentar todo**: Cada etapa = docs actualizadas
- **Tests continuos**: Validar después de cada etapa

---

**Status**: 🟡 PLAN PRELIMINAR - ESPERANDO VALIDACIÓN

¿Apruebas este plan? ¿Hay cambios que sugerir?

Una vez aprobado, comenzamos con ETAPA 1 (Analytics Gateway).
