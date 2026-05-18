# ETAPA 7: Optimization & Scaling - Estado de Implementación (Plan Adaptado)

**Versión**: 7.0
**Fecha**: 15 de Mayo, 2026
**Estado**: PLANNED (Baseline: ETAPAS 1-6 implementadas)


## Objetivo

Optimizar y escalar la plataforma analytics ya implementada (ETAPAS 1-6). Priorizar la arquitectura vigente: mantener contratos de endpoints, fallbacks en memoria, y añadir persistencia, caching, batch processing y optimizaciones de consultas para producción.


## Premisas (lo que ya está implementado y se debe respetar)



## Entregables de ETAPA 7

1. Persistencia en MongoDB para:
   - `AnalyticsSnapshot` (guardar snapshots y metadatos)
   - `PredictionLog` (auditar predicciones)
   - `GraphMetrics` (opcional en primera fase)

2. Redis caching para:
   - Thresholds (TTL 30 minutos)
   - Últimos snapshots por proyecto (TTL 30 minutos)
   - Agregaciones frecuentes (dashboard)

3. Batch Processing & Pipelines:
   - `analytics/pipelines/batch_processing.py` para ingestión masiva y recomputación periódica
   - Tareas programadas (cron-like) para limpieza de historia y recalculación

4. Indices y Performance Tuning:
   - Índices en MongoDB para `projectId`, `timestamp` y fields consultas frecuentes
   - Optimización del acceso a metric history (limitar scan acotado)

5. Tests y Validación:
   - Tests unitarios para persistencia (mock MongoDB)
   - Tests de integración que verifican fallback in-memory vs persisted
   - Benchmarks: 100 projects × 1000 requirements (sanity)

6. Documentación y Handoff:
   - Actualizar `ETAPA_7_ESTADO_IMPLEMENTACION.md` y crear `ETAPA_7_COMPLETION_REPORT.md`
   - Lista de tareas en `manage_todo_list`


## Diseño Propuesto (alineado con arquitectura existente)

1. Conectar MongoDB con minimal changes:
   - Añadir cliente en `analytics/db/client.py` (singleton)
   - No cambiar signatures de endpoints; aquellos que devuelven snapshots seguirán devolviendo el mismo dict.
   - `MonitoringEngine.create_snapshot()` → añadiremos `save_snapshot()` que intenta persistir y mantiene fallback si falla.

2. Redis cache layer:
   - `analytics/cache/analytics_cache.py` con helpers `get_cached_snapshot(project_id)`, `set_cached_snapshot(project_id, snapshot, ttl=1800)`
   - `get_engine()` usará cache para `get_latest_snapshot` y `create_snapshot` actualizará cache.

3. Batch pipeline:
   - `analytics/pipelines/batch_processing.py` con funciones:
     - `recompute_snapshots(project_id_list)`
     - `prune_old_snapshots(project_id, keep=100)`
   - Opcional: usar `APScheduler` o `celery` (primera iteración: APScheduler lightweight)

4. MongoDB Schema (Propuesta minimal):

```json
AnalyticsSnapshot {
  _id: ObjectId,
  projectId: string,
  timestamp: ISODate,
  semanticHealth: number,
  graphMetrics: object,
  riskScore: number,
  consistencyScore: number,
  predictions: object,
  activeAlerts: [object],
  apiLatencies: object,
  cached: boolean
}

PredictionLog {
  _id: ObjectId,
  projectId: string,
  predictionType: string,
  input: object,
  output: object,
  accuracy: number|null,
  timestamp: ISODate
}
```

Indices recomendados:
 `{
    "projectId": 1,
    "timestamp": 1,
    "fields": {
       "semanticHealth": 1,
       "riskScore": 1,
       "consistencyScore": 1
    }
 }

---

## Benchmark y pruebas añadidas

- `analytics/benchmarks/benchmark_ingest.py`: benchmark in-process para medir throughput de creación de snapshots.
- `analytics/benchmarks/README.md`: instrucciones de uso.
- `analytics/tests/test_cache.py`: pruebas unitarias para cache con fallback en memoria.

Estas pruebas y el benchmark permiten validar rendimiento básico y la correcta operación del cache/fallback sin requerir Redis/MongoDB en el entorno de CI.