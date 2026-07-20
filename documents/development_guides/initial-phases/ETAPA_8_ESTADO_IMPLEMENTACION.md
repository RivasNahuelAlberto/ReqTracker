# ETAPA 8: Realtime Streaming & Operationalization - Estado de Implementación

**Versión**: 8.0  
**Fecha**: 15 de Mayo, 2026  
**Estado**: FASE 1 COMPLETADA ✅ (Auto-update implementado, Fase 2-3 pendiente)

---

## 📊 Resumen Ejecutivo

ETAPA 8 se divide en tres fases:
1. ✅ **Fase 1: Auto-update en cambios** (COMPLETADA)
   - Detectar cambios significativos en requisitos/símbolos
   - Llamar analytics automáticamente
   - Emitir eventos socket sin intervención del usuario
   
2. 🔄 **Fase 2: Polling periódico** (PENDIENTE)
   - Cada 30-60s, refrescar dashboard
   - Emitir eventos solo si hay cambios
   
3. 📋 **Fase 3: Testing y validación** (PENDIENTE)
   - Tests e2e de flujo completo
   - Tests multi-usuario
   - Load testing

El sistema ahora es **completamente automático** para retroalimentación de datos en tiempo real.

---

## ✅ LO QUE YA ESTÁ IMPLEMENTADO

### Backend Socket Infrastructure (`backend/socket.js`)

**6 funciones de emisión de eventos** (líneas 14-56):

```javascript
- emitProjectAnalyticsUpdated(projectId, payload)
- emitProjectGraphRecomputed(projectId, payload)
- emitProjectPredictionGenerated(projectId, payload)
- emitProjectSemanticDrift(projectId, payload)
- emitProjectRiskDetected(projectId, payload)
- emitGlobalDataChanged(message)
```

**Estado**: ✅ Funcional, listo para usar en cualquier parte del código

---

### Backend Analytics Route Integration (`backend/routes/analytics.js`)

**Emisión de eventos en endpoints**:

```javascript
// Línea 58: POST /quality → emitProjectAnalyticsUpdated
// Línea 75: POST /similarity → emitProjectAnalyticsUpdated
// Línea 90: POST /recommendation → emitProjectPredictionGenerated
// Línea 107: POST /impact → emitProjectPredictionGenerated
// Línea 124: POST /consistency → emitProjectAnalyticsUpdated
// Línea 143 (en proxyAnalyticsService): GET /dashboard → emitProjectAnalyticsUpdated
```

**Estado**: ✅ Funcional cuando se llaman manualmente

---

### Frontend Event Capture (`frontend/src/components/AuthContext.jsx`)

**Líneas 22-77**: 5 event listeners registrados:

```javascript
newSocket.on('analytics:update', handleRealtimeAnalyticsEvent)
newSocket.on('graph:recomputed', handleRealtimeAnalyticsEvent)
newSocket.on('prediction:generated', handleRealtimeAnalyticsEvent)
newSocket.on('semantic:drift', handleRealtimeAnalyticsEvent)
newSocket.on('risk:detected', handleRealtimeAnalyticsEvent)
```

**Almacenamiento**: `analyticsEvents` state (máximo 30 eventos)

**Estado**: ✅ Funcional, actualiza UI correctamente

---

### Frontend Event Display (`frontend/src/components/RealtimeAnalyticsPanel.jsx`)

**Muestra tabla con**:
- Timestamp del evento
- Tipo de evento (eventType)
- Mensaje descriptivo
- Detalles en JSON

**Estado**: ✅ Funcional, muestra eventos correctamente

**Location**: Integrado en `frontend/src/pages/ProjectPage.jsx`

---

###✅ LO NUEVO: Auto-update en cambios (FASE 1 - COMPLETADA)

### Nuevo Servicio: `backend/ai/analytics-auto-updater.service.js`

**400+ líneas de código**. Responsabilidades:
- Detectar cambios significativos (Levenshtein distance + umbrales)
- Llamar `/semantic/health` de analytics
- Emitir eventos socket basados en resultado
- Non-blocking: fire-and-forget, no bloquea HTTP response

**Integración**:
- `backend/routes/projects.js`: POST/PUT de requisitos
- `backend/routes/symbols.js`: POST/PUT de símbolos

**Flujo**:
```
Usuario edita requisito
  ↓
Backend detecta cambio significativo (>15%)
  ↓
Llama analytics de manera non-blocking
  ↓
Emite socket event (analytics:update o risk:detected)
  ↓
Frontend recibe sin refresh
  ↓
RealtimeAnalyticsPanel se actualiza automáticamente
```

---

## 🔄 LO QUE FALTA: Polling periódico (FASE 2)
---

## 🔄 LO QUE FALTA: Retroalimentación Automática de Datos

### El Problema

Actualmente, los eventos solo se emiten cuando:
1. Frontend llama manualmente `/api/analytics/quality`, `/api/analytics/dashboard`, etc.
2. Agente ejecuta un plan que usa las 3 nuevas tools

**Falta**: Un mecanismo que periódicamente (o tras cambios significativos) **actualice automáticamente** los datos de analytics sin intervención del usuario.

### Escenario Ideal

```
1. Usuario edita un Requirement en ProjectPage
   ↓
2. Backend detecta cambio importante
   ↓
3. Backend AUTOMÁTICAMENTE llama analytics para re-análisis
   ↓
4. Backend emite evento `analytics:update` via socket
   ↓
5. Frontend recibe evento sin necesidad de refresh
   ↓
6. Frontend actualiza RealtimeAnalyticsPanel con nuevo evento
```

### Opciones de Implementación

| Opción | Ventaja | Desventaja |
|--------|---------|-----------|
| **Polling periódico** (cada 10s) | Simple, predecible | Overhead de red, latencia |
| **Event-driven en cambios** | Eficiente, bajo overhead | Requiere detectar cambios importantes |
| **Hybrid** | Lo mejor de ambos | Más complejo |
| **Agente periódico** | Usa agent para actualizaciones | Depende del agente |

---

## 📋 Tareas Completadas de ETAPA 8 - Fase 1

### Fase 1: Auto-update en cambios de requisitos/símbolos ✅ COMPLETA

- [x] 1.1 Crear `backend/ai/analytics-auto-updater.service.js`
  - Detecta cambios significativos (Levenshtein + umbrales)
  - Llama analytics sin bloquear
  - Emite eventos socket
  
- [x] 1.2 Integrar en `backend/routes/projects.js`
  - POST /api/projects/:projectId/requirements → auto-update
  - PUT /api/projects/:projectId/requirements/:id → auto-update
  
- [x] 1.3 Integrar en `backend/routes/symbols.js`
  - POST /api/:projectId/symbols → auto-update
  - PUT /api/:projectId/symbols/:id → auto-update

- [x] CHECKPOINT FASE 1: Crear/editar requirement → evento en socket ✅

---

## 📋 Tareas Pendientes de ETAPA 8 - Fase 2 & 3

### Fase 2: Polling periódico (MEDIA Prioridad)

- [ ] 2.1 Crear `backend/services/analytics-polling.service.js`
  - Cada 30-60 segundos, refrescar dashboard analítico
  - Usar Redis cache para evitar sobrecarga de analytics
  - Emitir evento socket solo si datos cambiaron

- [ ] 2.2 Registrar en `backend/index.js` al iniciar servidor
  - Iniciar servicio de polling
  - Usar project list para iterar

### Fase 3: Validación y testing

- [ ] 3.1 Tests de flujo completo
  - Crear requirement → Evento en socket
  - Editar requirement → Evento en socket
  - Verificar frontend recibe actualización

- [ ] 3.2 Smoke tests con múltiples usuarios
  - Dos usuarios en mismo proyecto
  - Verificar ambos reciben eventos

---

## 🏗️ Arquitectura Propuesta

```
USUARIO EDITA REQUISITO
    ↓
backend/routes/requirements.js (PUT)
    ↓
backend/services/analytics-auto-updater.service.js
    ├─ analyzeRequirement(newData)
    ├─ compareWithOld() → Cambios significativos?
    ├─ Si sí:
    │  ├─ Llamar analytics
    │  ├─ Emitir evento socket
    │  └─ Actualizar MongoDB cache
    └─ Si no:
       └─ Ignorar
    ↓
SOCKET.IO EVENT
    ↓
frontend/AuthContext (captura evento)
    ↓
frontend/RealtimeAnalyticsPanel (muestra)
```

### Services a crear:

#### `backend/services/analytics-auto-updater.service.js`

```javascript
export class AnalyticsAutoUpdater {
  async processRequirementChange(projectId, oldReq, newReq, analyticsClient) {
    // 1. Detectar si cambio es significativo
    const isSignificant = this.isSignificantChange(oldReq, newReq);
    if (!isSignificant) return null;
    
    // 2. Llamar analytics
    const analysis = await analyticsClient.callAnalytics(
      '/semantic/health',
      { requirement: newReq.text, projectId }
    );
    
    // 3. Emitir evento si hay cambios importantes
    const severity = this.determineSeverity(analysis);
    emitProjectAnalyticsUpdated(projectId, {
      endpoint: 'auto-analysis',
      severity,
      analysis
    });
    
    return analysis;
  }
  
  isSignificantChange(oldReq, newReq) {
    // Criterios: cualidad mejora/empeora > 10%, tamaño cambia, etc
    return Math.abs(oldReq.quality - newReq.quality) > 0.1 ||
           oldReq.text.length !== newReq.text.length;
  }
}
```

#### `backend/services/analytics-polling.service.js`

```javascript
export class AnalyticsPollingService {
  async startPolling(intervalMs = 30000) {
    setInterval(async () => {
      const projects = await Project.find().limit(10); // Primeras 10
      
      for (const project of projects) {
        const dashboard = await analyticsClient.getDashboard(project._id);
        
        // Comparar con última versión cacheada
        if (this.hasChanges(dashboard)) {
          emitProjectAnalyticsUpdated(project._id, {
            endpoint: 'polling',
            dashboard
          });
        }
      }
    }, intervalMs);
  }
}
```

---

## 🔄 Flujo Actual vs. Propuesto

### ACTUAL (Manual)

```
User clicks "View Dashboard"
    ↓
Frontend calls GET /api/analytics/dashboard/:projectId
    ↓
Backend calls Python analytics
    ↓
Backend emits analytics:update event
    ↓
Frontend receives (after user clicks)
```

### PROPUESTO (Auto)

```
User edits Requirement
    ↓
Backend detects change → calls analytics-auto-updater
    ↓
Updater calls Python analytics
    ↓
Backend emits analytics:update event AUTOMATICALLY
    ↓
Frontend receives EVEN WITHOUT user action
```

---

## 📌 Principios de Implementación (ETAPA 8)

1. **Non-blocking**: Auto-updates no deben bloquear request del usuario
2. **Graceful degradation**: Si analytics cae, sistema sigue funcionando
3. **Rate limiting**: No bombardear analytics con requests
4. **Cache-aware**: Usar cache para evitar work innecesario
5. **Testeable**: Cada componente debe ser testeable aisladamente

---

## 🧪 Criterios de Aceptación

- [ ] Cuando usuario crea requirement, evento `analytics:update` se emite en < 1s
- [ ] Frontend recibe evento automáticamente SIN refresh
- [ ] RealtimeAnalyticsPanel muestra nuevo evento con timestamp correcto
- [ ] Polling NO sobrecargar analytics (máximo 1 call/project/30s)
- [ ] Múltiples usuarios en mismo proyecto reciben eventos simultáneamente
- [ ] Si analytics cae, sistema continúa funcionando (fallback en cache)

---

## 🚀 Plan de Trabajo

### Sprint 1 (Hoy): Auto-update en cambios
- [ ] Crear `analytics-auto-updater.service.js`
- [ ] Integrar en `backend/routes/requirements.js`
- [ ] Integrar en `backend/routes/symbols.js`
- [ ] CHECKPOINT: Crear/editar requirement → evento en socket

### Sprint 2 (Mañana): Polling periódico
- [ ] Crear `analytics-polling.service.js`
- [ ] Registrar en `backend/index.js`
- [ ] CHECKPOINT: Dashboard se actualiza automáticamente cada 30s

### Sprint 3: Validación
- [ ] Tests de flujo completo
- [ ] Tests de múltiples usuarios
- [ ] Smoke test con datos reales

---

## 📚 Archivos Relacionados

- `backend/socket.js` - Base para eventos
- `backend/routes/analytics.js` - Emisión actual
- `backend/routes/requirements.js` - Donde integrar auto-updater
- `backend/ai/analytics.client.js` - Cliente para llamar analytics
- `frontend/src/components/RealtimeAnalyticsPanel.jsx` - Display
- `frontend/src/components/AuthContext.jsx` - Event capture

---

## ⚠️ Consideraciones Críticas

1. **Performance**: El agente ETAPA 4-6 es pesado; auto-updates deben ser rápidos
2. **Consistency**: Asegurar que cache en MongoDB y socket events están sincronizados
3. **Rate limiting**: No más de 1 analytics call por proyecto por 10 segundos
4. **Backward compatibility**: No romper endpoints existentes

---

**Próximo paso**: Implementar auto-updater en Fase 1

**Fin del documento de estado**
