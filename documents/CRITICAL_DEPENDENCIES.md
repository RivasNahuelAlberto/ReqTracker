# ⚠️ ReqTracker - Critical Dependencies & Fragile Points

**Última actualización:** 2026-05-17

> **Módulos críticos, acoplamientos delicados, configuraciones que pueden romper el sistema**

---

## Tabla de Contenidos

1. [Módulos Críticos](#módulos-críticos)
2. [Lógica Transversal](#lógica-transversal)
3. [Acoplamientos Delicados](#acoplamientos-delicados)
4. [Configuración Sensible](#configuración-sensible)
5. [Dependencias Externas](#dependencias-externas)
6. [Puntos Frágiles Conocidos](#puntos-frágiles-conocidos)
7. [Checklist de Seguridad](#checklist-de-seguridad)

---

## Módulos Críticos

### 1. GraphSanityEngine (`backend/ai/graph-sanity-engine.service.js`)

**Por qué es crítico:**
- Entry point del pipeline IA
- **CUALQUIER ERROR aquí rompe todo el análisis**
- Normaliza múltiples formatos de entrada
- Valida integridad del grafo

**Qué puede fallar:**
```
❌ Si input.nodes no es array → Crash
❌ Si falta node.id → NullPointerException
❌ Si edges pierden fromName/toName → Context-compiler falla
❌ Si validación retorna wrong format → Parser error downstream
```

**Precauciones antes de modificar:**
- [ ] Entendés qué hace cada método (normalizeGraph, validateGraph, etc.)
- [ ] Mantené INPUT y OUTPUT contracts bien documentados
- [ ] Testeá con grafos edge-case (1 node, 1000 nodes, ciclos, orphans)
- [ ] Verificá que edges SIEMPRE tienen fromName/toName
- [ ] Log detallado para debugging
- [ ] Ejemplo en datos reales

**Dependencias:**
```
Depende de:
  - Input: Project model (para nodes)
  - Output usado por: ContextCompiler

Que dependen de:
  - ai.controller.js (orquestación)
  - analytics service (posiblemente)
```

**Cambios Conocidos:**
- ✅ FIXED (2026-05-17): Agregada node lookup map para resolver fromName/toName
- ✅ FIXED: Ahora maneja { nodes, relations } format correctamente

**Riesgo de Modificación: ALTO**

---

### 2. ContextCompiler (`backend/ai/context-compiler.js`)

**Por qué es crítico:**
- Comprime grafo completo (400+ nodos) a subset relevante (10-30)
- **Errores aquí = contexto incorrecto para LLM = respuestas malas**
- Calcula scores de relevancia con múltiples factores

**Qué puede fallar:**
```
❌ Si input no es array → "graphSize: 0" error
❌ Si edges sin fromName/toName → Crash en buildSubgraph()
❌ Si scoring da NaN → Nodos seleccionados inválidos
❌ Si threshold incorrecto → Retorna dataset vacío
```

**Input Contract (REQUERIDO):**
```javascript
// DEBE ser array, DEBE tener fromName/toName
[
  { source: 'id1', target: 'id2', fromName: 'User', toName: 'Project', weight: 0.8 },
  { source: 'id2', target: 'id3', fromName: 'Project', toName: 'Task', weight: 0.6 }
]
```

**Precauciones antes de modificar:**
- [ ] Validá input: if (!Array.isArray(graph)) throw Error
- [ ] Testeá scoring con diferentes weights (0-1)
- [ ] Verificá top-K selection no retorna duplicados
- [ ] Probá con threshold border cases
- [ ] Loguea scores para debugging
- [ ] Comparación antes/después compresión

**Dependencias:**
```
Depende de:
  - Input: GraphSanityEngine.run() output

Que dependen de:
  - UnifiedPlanner (recibe contexto comprimido)
```

**Riesgo de Modificación: CRÍTICO**

---

### 3. Project Model (`backend/models/Project.js`)

**Por qué es crítico:**
- Schema central de toda la aplicación
- **Cambios aquí afectan routes, frontend, analytics**
- Persistencia de todo (símbolos, relaciones, escenarios)
- Referenciado desde 20+ lugares

**Qué puede fallar:**
```
❌ Agregar campo required sin migración → Docs existentes inválidos
❌ Cambiar tipo de campo → Queries antiguas fallan
❌ Eliminar campo sin backward compat → Código legacy rompe
❌ Cambiar índices → Queries lentas o no encontradas
```

**Campos principales:**
```javascript
{
  _id: ObjectId,
  name: String (required),
  symbols: [ObjectId] (ref: Symbol),
  relations: [Relation],
  scenarios: [Scenario],
  tasks: [Task],
  createdAt: Date,
  code: String (para seguridad),
  // ... más campos
}
```

**Precauciones antes de modificar:**
- [ ] ¿Nuevo campo? ¿Requiere migración de datos existentes?
- [ ] ¿Cambio de tipo? ¿Qué pasó con datos viejos?
- [ ] ¿Borró campo? ¿Alguien lo usa en código?
- [ ] ¿Agregó índice? ¿Testeaste performance?
- [ ] Corriste `git grep` para encontrar referencias
- [ ] Actualizaste tests y fixtures
- [ ] Planificá migración si es producción

**Dependencias:**
```
Referenciado en:
  - routes/projects.js (CRUD)
  - routes/symbols.js (populates)
  - ai/ services (carga projects)
  - frontend/api.js (espera ciertos campos)
  - Socket.io listeners

Relacionado con:
  - Symbol model (relación 1-many)
  - Relation model
  - Scenario, Task, Inspection models
```

**Riesgo de Modificación: CRÍTICO**

---

### 4. Socket.io Setup (`backend/index.js`)

**Por qué es crítico:**
- **Sincronización en tiempo real de todos usuarios**
- Falla = otros usuarios no ven cambios
- Eventos fácilmente olvidan emisiones
- Concurrencia compleja (2+ usuarios simultáneos)

**Qué puede fallar:**
```
❌ Si no emitís 'projectUpdated' → Otros usuarios quedan desincronizados
❌ Si socket.join() mal configurado → Broadcast va a todos (security)
❌ Si handler tarda → Timeout u otros usuarios bloqueados
❌ Si no cleanup listeners → Memory leak
```

**Critical Pattern:**
```javascript
// Cada vez que modificás proyecto, DEBES hacer:
await project.save();
broadcastProjectUpdate(req, projectId);  // ← NO OLVIDAR

// Si olvidas ↑ → users no ven cambios
```

**Precauciones antes de modificar:**
- [ ] Entendés rooms concept (socket.join())
- [ ] Sabés qué eventos existen y qué hacen
- [ ] No olvidás broadcast en cada modificación
- [ ] Testeás con 2+ browsers/tabs simultáneamente
- [ ] Verificás listeners se limpian (useEffect cleanup)
- [ ] Logueas eventos para debugging

**Dependencias:**
```
Crítico para:
  - Sincronización RT
  - Colaboración multi-user
  - Notificaciones en tiempo real
```

**Riesgo de Modificación: ALTO**

---

## Lógica Transversal

### Authentication (si existe)

**Ubicación:** `backend/middleware/auth.js`

**Impacto:**
- ✅ Si bien hecho: seguridad garantizada
- ❌ Si mal hecho: acceso sin autorización

**Precauciones:**
- [ ] Validar JWT signature
- [ ] Checkear expiración
- [ ] Aplicar a TODAS las rutas sensibles
- [ ] Loguear accesos denegados

---

### Error Handling Global

**Ubicación:** `backend/middleware/error-handler.js` (si existe)

**Impacto:**
- Propagación de errores a clientes
- Logging centralizado
- Consistencia en respuestas

**Precauciones:**
- [ ] No loguear data sensible
- [ ] Retornar errores genéricos a cliente
- [ ] Stack traces solo en logs internos

---

### Database Connection

**Ubicación:** `backend/index.js` (mongoose.connect)

**Impacto:**
- Falla = Nada funciona
- Timeout = Requests cuelgan

**Precauciones:**
- [ ] Manejo de desconexión
- [ ] Retry logic
- [ ] Connection pooling
- [ ] Logs de conexión

---

## Acoplamientos Delicados

### Acoplamiento 1: GraphSanityEngine Output → ContextCompiler Input

```
PROBLEMA:
  GSE produce: { edges[] con source/target }
  Compiler espera: edges[] con fromName/toName

ANTES DE ARREGLARLO:
  ❌ Producía: { edges: [{ source, target }] }
  ❌ Compiler intentaba: edge.fromName → undefined
  ❌ Resultado: crash

ARREGLADO EN 2026-05-17:
  ✅ GSE ahora produce: edges[] con fromName/toName
  ✅ Compiler valida correctamente
  ✅ Pipeline completo funciona

RIESGO:
  Si alguien modifica GSE y olvida fromName/toName
  → Compiler fallará COMPLETAMENTE
```

**Cómo Protegerse:**
```javascript
// En ContextCompiler.compileContext()
if (!Array.isArray(graph)) {
  throw new Error('Graph must be array');
}

graph.forEach(edge => {
  if (!edge.fromName || !edge.toName) {
    throw new Error(`Edge missing names: ${edge.source} -> ${edge.target}`);
  }
});
```

---

### Acoplamiento 2: Routes → Models → Frontend

```
CAMBIO EN BACKEND:
  ┌─ routes/projects.js retorna { project }
  ├─ frontend/pages/ProjectPage.jsx espera { name, symbols, scenarios }
  └─ Si faltan campos → UI rompe

EJEMPLO:
  ❌ Backend: return { project: { _id, name } }  // Faltan fields
  ❌ Frontend: project.symbols.length  → undefined.length → CRASH

  ✅ Backend: return { project: { _id, name, symbols, scenarios } }
  ✅ Frontend: project.symbols.length → 0 (safe)
```

**Protección:**
- Documentar respuesta en cada route
- Validar respuesta en frontend (Array.isArray check)
- Tests que validen contrato

---

## Configuración Sensible

### 1. MongoDB Connection String

**Ubicación:** `.env` variable `MONGO_URI`

**Riesgo:**
- ❌ Hardcodeado → Committea password
- ❌ Wrong connection → BD incorrecta
- ❌ Timeout bajo → Conexión falla

**Precauciones:**
- [ ] Usa .env (NO committear)
- [ ] .env.example con dummy values
- [ ] Conexión string valida
- [ ] Timeout configurado (30-60s)

```javascript
// BUENO
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/reqtracker';

// MALO
const MONGO_URI = 'mongodb://user:password@atlas.mongodb.net/prod';  // NO
```

---

### 2. LLM API Keys

**Ubicación:** `.env` variables `OPENAI_API_KEY`, `OPENROUTER_API_KEY`

**Riesgo:**
- ❌ Commitear → Cualquiera puede usar
- ❌ Expuesto → Generador costos
- ❌ Hardcodeado → Imposible rotación

**Precauciones:**
- [ ] NUNCA commitear keys
- [ ] Rotarlas regularmente
- [ ] Rate limiting en backend
- [ ] Loguea uso (pero NO el key)

---

### 3. Socket.io Configuration

**Ubicación:** `backend/index.js` io configuration

**Riesgo:**
- ❌ CORS mal configurado → No se conecta
- ❌ Timeout bajo → Clientes desconectan
- ❌ Memory leak → Servidor se vuelve lento

**Precauciones:**
```javascript
// BUENO
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
  },
  pingInterval: 25000,
  pingTimeout: 60000
});

// MALO
const io = new Server(server, {
  cors: { origin: '*' }  // Abierto a todos
});
```

---

## Dependencias Externas

### 1. OpenAI API

**Ubicación:** `backend/ai/services/chat.service.js`

**Riesgo:**
- ❌ API abajo → Ningún análisis funciona
- ❌ Rate limited → Errores aleatorios
- ❌ Response cambió → Parsing falla

**Precauciones:**
- [ ] Error handling para API down
- [ ] Retry logic con exponential backoff
- [ ] Rate limiting en cliente
- [ ] Fallback (OpenRouter?)
- [ ] Logs detallados de cada call

---

### 2. MongoDB Atlas

**Ubicación:** Configuración conexión

**Riesgo:**
- ❌ Cluster abajo → Todo muere
- ❌ Conexión límite → No se conecta más
- ❌ Backup falta → Data loss

**Precauciones:**
- [ ] Backups automáticos habilitados
- [ ] Connection pooling configurado
- [ ] Monitoring de queries lentas
- [ ] Plan de recuperación ante desastre

---

### 3. Analytics Service (Python)

**Ubicación:** `analytics/app.py`

**Riesgo:**
- ❌ Si abajo → backend no puede llamarlo
- ❌ Import falla → Service no inicia
- ❌ Response format cambió → Parse error

**Precauciones:**
- [ ] Try-catch alrededor de calls HTTP
- [ ] Timeout configurado
- [ ] Fallback (sin análisis semántico?)
- [ ] Health check endpoint

---

## Puntos Frágiles Conocidos

### Issue 1: Array Validation Bug (FIXED 2026-05-17)

**Qué pasó:**
- useMemo hooks en ProjectPage.jsx llamaban .map(), .reduce() sin validar que arrays existan
- Si backend retornaba undefined → "e.map is not a function" crash

**Solución:**
```javascript
// ANTES (MALO)
const filtered = symbols.map(s => s.name);  // Falla si symbols undefined

// DESPUÉS (BUENO)
const filtered = Array.isArray(symbols) ? symbols.map(s => s.name) : [];
```

**Lección:**
Siempre asumir datos externos pueden ser undefined/wrong type

---

### Issue 2: Graph Format Mismatch (FIXED 2026-05-17)

**Qué pasó:**
- GraphSanityEngine retornaba { nodes, edges }
- ContextCompiler esperaba edges[] con fromName/toName
- Mismatch → "START NODE NOT FOUND" error

**Solución:**
```javascript
// En ai.controller.js
const sanitized = await GraphSanityEngine.run(rawGraph);
const edges = sanitized.edges || sanitized.relations || [];  // Extract correctamente

// En GraphSanityEngine
const edges = nodes.map(node => ({
  ...relation,
  fromName: nodeMap[relation.fromId]?.name,  // Resolver nombre
  toName: nodeMap[relation.toId]?.name       // Resolver nombre
}));
```

**Lección:**
Documentar contratos entre servicios explícitamente

---

### Issue 3: Analytics Import Error (FIXED 2026-05-17)

**Qué pasó:**
- `from analytics` fallaba en Docker
- sys.path no tenía ANALYTICS_DIR

**Solución:**
```python
# En analytics/app.py
sys.path.insert(0, ANALYTICS_DIR)
sys.path.insert(1, PROJECT_ROOT)

# Imports con fallback
try:
  from semantic import get_embeddings
except ImportError:
  from analytics.semantic import get_embeddings
```

**Lección:**
Docker y local development tienen paths diferentes

---

## Checklist de Seguridad

### Antes de Modificar Módulo Crítico

- [ ] Entendés completamente qué hace
- [ ] Leíste el contrato (JSDoc) de input/output
- [ ] Identificás qué depende de éste
- [ ] Escribiste tests de caso edge
- [ ] Logueas cambios importantes
- [ ] Documentás impacto en otros módulos
- [ ] Probaste en dev localmente
- [ ] Probaste con datos reales
- [ ] Comunicás cambio al equipo
- [ ] Hacés rollback plan si falla

### Antes de Cambiar Configuration

- [ ] Documentás el cambio
- [ ] Verificás backward compat
- [ ] Testeas en staging (si existe)
- [ ] Logs para debugging post-deploy
- [ ] Plan de rollback rápido
- [ ] Monitoreás logs después de deploy

### Antes de Cambiar Schema BD

- [ ] Escribís migración script
- [ ] Testeás migración en copia de prod
- [ ] Backup de data existente
- [ ] Verificás no hay queries inválidas
- [ ] Update índices si necesario
- [ ] Documentás cambio

---

## Tabla Resumen: Riesgo de Modificación

| Módulo | Riesgo | Por Qué | Precaución |
|--------|--------|---------|-----------|
| **GraphSanityEngine** | CRÍTICO | Pipeline entry | Testar edge cases |
| **ContextCompiler** | CRÍTICO | Contexto LLM | Validar input/output |
| **Project Model** | CRÍTICO | Central BD | Migración de data |
| **Socket.io** | ALTO | Sync RT | Broadcast en cada cambio |
| **ai.controller** | ALTO | Orquestación | Contratos de servicios |
| **routes/** | MEDIO | Endpoints REST | Validación entrada |
| **models/** | MEDIO | Schemas | Índices + validación |
| **frontend pages** | BAJO | Presentación | Testing UI |
| **components** | BAJO | Componentes | PropTypes |

---

**Versión:** 1.0  
**Última revisión:** 2026-05-17
