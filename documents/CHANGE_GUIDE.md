# 🎯 ReqTracker - Where to Change (Guía de Modificación)

**Última actualización:** 2026-05-17

> **Guía práctica:** Rápida referencia sobre dónde intervenir según tipo de cambio

---

## Tabla de Contenidos

1. [Funcionalidad de Negocio](#funcionalidad-de-negocio)
2. [UI/UX y Componentes](#uiux-y-componentes)
3. [APIs e Integraciones](#apis-e-integraciones)
4. [Estado y Comunicación](#estado-y-comunicación)
5. [DTOs y Modelos](#dtos-y-modelos)
6. [Persistencia](#persistencia)
7. [Seguridad](#seguridad)
8. [Configuración](#configuración)
9. [Performance](#performance)
10. [Testing](#testing)

---

## Funcionalidad de Negocio

### Agregar nueva operación en proyectos

**Dónde:**
- `backend/routes/projects.js` — Nueva ruta
- `backend/models/Project.js` — Si requiere nuevo campo
- `frontend/api.js` — Nueva función HTTP
- `frontend/pages/ProjectPage.jsx` — UI que invoca función

**Pasos:**
```javascript
// 1. Defini ruta en backend/routes/projects.js
router.post('/:projectId/my-operation', async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    // Tu lógica aquí
    await project.save();
    broadcastProjectUpdate(req, req.params.projectId); // IMPORTANTE: sync RT
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 2. Agregá función en frontend/api.js
export async function myOperation(projectId, data) {
  const response = await api.post(`/projects/${projectId}/my-operation`, data);
  return response.data;
}

// 3. Usá en frontend (ProjectPage.jsx o componente)
const handleMyOperation = async () => {
  try {
    const result = await myOperation(projectId, { ... });
    // Actualiza UI
  } catch (error) {
    setMessage(error.message);
  }
};
```

**Riesgos:**
- ❌ Olvidar `broadcastProjectUpdate()` → otros usuarios no ven cambios
- ❌ No validar entrada en backend → data corruption
- ❌ No actualizar `frontend/api.js` → desincronización

---

### Modificar lógica de validación de símbolos

**Dónde:**
- `backend/routes/symbols.js` — Validaciones entrada
- `backend/models/Symbol.js` — Esquema y validaciones
- `frontend/pages/ProjectPage.jsx` — Validación básica UX

**Ejemplo: Hacer nombres de símbolos obligatoriamente únicos por proyecto**

```javascript
// backend/routes/symbols.js - POST handler
const duplicateError = await SymbolModel.isDuplicateNameForType(
  req.params.projectId, 
  name, 
  validType
);
if (duplicateError) {
  return res.status(400).json({ message: 'Nombre duplicado para este tipo' });
}

// backend/models/Symbol.js - Agregá método
SymbolSchema.statics.isDuplicateNameForType = async function(projectId, name, type) {
  const existing = await this.findOne({
    project: projectId,
    name: name.toLowerCase(),
    type: type
  });
  return !!existing;
};
```

**Riesgos:**
- ❌ Cambiar validación sin migrar datos existentes → corrupción
- ❌ Validar solo en frontend → back-end bypassing
- ❌ Cambiar esquema Mongoose sin tests → errores sutiles

---

### Agregar nueva relación entre entidades

**Dónde:**
- `backend/models/Relation.js` — Si nueva estructura
- `backend/routes/projects.js` o nuevo route — Handler CRUD
- `backend/ai/tools/relations.tool.js` — Si usada en tools
- `frontend/components/RelationMap.jsx` — Visualización (opcional)

**Pasos:**
```javascript
// 1. Extendé modelo Relation si es necesario
// 2. Creá rutas CRUD
// 3. Agregá función en frontend/api.js
// 4. Sincronizá en context-compiler.js si afecta análisis
```

---

## UI/UX y Componentes

### Cambiar tema de colores

**Dónde:**
- `frontend/src/styles.css` — Variables CSS globales
- `frontend/src/components/*/componentName.jsx` — CSS modulado (if exists)
- `frontend/vite.config.js` — Si necesita cambio de config

**Pasos:**
```css
/* frontend/src/styles.css */
:root {
  --primary: #4da6ff;        /* Azul primario */
  --success: #4caf50;        /* Verde éxito */
  --danger: #f44336;         /* Rojo peligro */
  --bg-dark: #1a1a1a;        /* Fondo oscuro */
  --bg-card: #242424;        /* Cards */
  --text-main: #e0e0e0;      /* Texto principal */
}

/* En componentes, usá variables en lugar de hardcoded colors */
.my-button {
  background-color: var(--primary);
  color: var(--text-main);
}
```

**Riesgos:**
- ❌ Hardcoded colors → inconsistencia visual
- ❌ No usar CSS variables → difícil mantenimiento

---

### Agregar nuevo tab en ProjectPage

**Dónde:**
- `frontend/pages/ProjectPage.jsx` — Agregar en tabs array y render
- `frontend/src/styles.css` — Estilos si necesario

**Pasos:**
```javascript
// frontend/pages/ProjectPage.jsx
const tabs = [
  { key: 'documents', label: 'Documentos' },
  { key: 'about', label: 'Acerca del Sistema' },
  { key: 'my-new-tab', label: 'Mi Tab Nueva' },  // ← Agrega aquí
  // ... otros tabs
];

// En el switch/if para renderizar
case 'my-new-tab':
  return <MyNewTabContent />;
```

**Riesgos:**
- ❌ Olvidar integrar con API
- ❌ No sincronizar vía Socket.io si hace cambios

---

### Refactorizar RelationMap (visualización del grafo)

**Dónde:**
- `frontend/src/components/RelationMap.jsx` — Componente
- Posiblemente `frontend/src/styles.css` — Estilos

**Importante:** Si cambias cómo se calcula o renderiza el grafo, probá que:
- Nodos se posicionen correctamente
- Edges no superponen texto
- Performance no se degrade (si hay 100+ nodos)

---

## APIs e Integraciones

### Agregar endpoint REST para nueva funcionalidad

**Dónde:**
- `backend/routes/*.js` — Nueva ruta
- `frontend/api.js` — Wrapper HTTP
- `backend/ai/tools/` — Si es tool para LLM

**Convención:**
```
POST   /api/resources/              ← Crear
GET    /api/resources/              ← Listar
GET    /api/resources/:id           ← Obtener uno
PUT    /api/resources/:id           ← Reemplazar
PATCH  /api/resources/:id           ← Actualizar parcial
DELETE /api/resources/:id           ← Eliminar
```

**Ejemplo:**
```javascript
// backend/routes/concepts.js (nuevo archivo)
router.post('/:projectId/concepts', async (req, res) => {
  // Validar, crear, retornar
});

// frontend/api.js
export async function createConcept(projectId, data) {
  return (await api.post(`/projects/${projectId}/concepts`, data)).data;
}

// Uso en frontend
const newConcept = await createConcept(projectId, { name, ... });
```

**Riesgos:**
- ❌ Métodos HTTP incorrectos (POST para read es anti-patrón)
- ❌ No retornar códigos HTTP correctos (200, 201, 400, 404, 500)
- ❌ Endpoints inconsistentes con la convención de routing

---

### Integrar con Analytics Service

**Dónde:**
- `backend/ai/ai.controller.js` — Si orquestación IA
- `backend/ai/tools/` — Si tool para LLM
- Llamar a Analytics via HTTP: `process.env.ANALYTICS_URL`

**Pasos:**
```javascript
// backend/ai/some-service.js
const analyticsUrl = process.env.ANALYTICS_URL || 'http://localhost:8000';

export async function callAnalyticsService(endpoint, data) {
  try {
    const response = await axios.post(
      `${analyticsUrl}${endpoint}`,
      data,
      { timeout: 30000 }  // 30s timeout
    );
    return response.data;
  } catch (error) {
    logger.error('Analytics call failed', { endpoint, error: error.message });
    throw error;  // O retornar fallback data
  }
}

// Uso
const result = await callAnalyticsService('/semantic/analyze', { symbols: [...] });
```

**Riesgos:**
- ❌ No manejar timeout → solicitudes cuelgan
- ❌ No logear errores → difícil debugging
- ❌ Asumir Analytics siempre disponible → frágil

---

## Estado y Comunicación

### Agregar evento Socket.io

**Dónde:**
- `backend/index.js` — Setup Socket.io listeners
- `frontend/pages/ProjectPage.jsx` — Listeners en useEffect
- `backend/routes/*.js` — Emitir eventos

**Pasos:**
```javascript
// backend/index.js - Setup
io.on('connection', (socket) => {
  socket.on('myCustomEvent', (data) => {
    // Procesá evento
    io.to(projectId).emit('myCustomEventResponse', result);
  });
});

// backend/routes/projects.js - Emitir
broadcastProjectUpdate(req, projectId);  // Función helper
// Internamente hace: io.to(projectId).emit('projectUpdated');

// frontend/pages/ProjectPage.jsx - Escuchar
useEffect(() => {
  socket?.on('myCustomEventResponse', (data) => {
    // Actualiza UI
  });
  return () => socket?.off('myCustomEventResponse');
}, [socket]);
```

**Riesgos:**
- ❌ Emitir sin `io.to(roomId)` → broadcast a todos usuarios
- ❌ No hacer cleanup en useEffect → memory leaks
- ❌ Nombres de eventos inconsistentes

---

### Persistir estado de usuario (preferencias)

**Dónde:**
- `frontend/src/components/AuthContext.jsx` — Si auth context
- `browser localStorage` — Para preferencias client-side
- `backend/models/User.js` — Si preferencias server-side

**Ejemplo:**
```javascript
// frontend - preferencias locales
export function saveUserPreference(key, value) {
  localStorage.setItem(`reqtracker_${key}`, JSON.stringify(value));
}

export function getUserPreference(key, defaultValue) {
  const stored = localStorage.getItem(`reqtracker_${key}`);
  return stored ? JSON.parse(stored) : defaultValue;
}

// Uso
useEffect(() => {
  const savedTheme = getUserPreference('theme', 'light');
  setTheme(savedTheme);
}, []);
```

**Riesgos:**
- ❌ localStorage fácilmente modificable por usuario
- ❌ Usar para datos sensibles
- ❌ No sincronizar entre tabs

---

## DTOs y Modelos

### Extender modelo Project

**Dónde:**
- `backend/models/Project.js` — Schema MongoDB
- `backend/routes/projects.js` — Handlers que usan campo
- `frontend/api.js` — Si necesita nuevo campo en response

**Pasos:**
```javascript
// backend/models/Project.js
const ProjectSchema = new mongoose.Schema({
  // ... campos existentes ...
  myNewField: {
    type: String,
    default: '',
    required: false
  }
});

// backend/routes/projects.js - Al crear
const project = await Project.create({
  name,
  // ... otros campos ...
  myNewField: req.body.myNewField || ''
});

// backend/routes/projects.js - Al obtener (exportar)
const responseProject = {
  ...project.toObject(),
  myNewField: project.myNewField  // Asegurate de incluir
};
res.json(responseProject);
```

**Riesgos:**
- ❌ No migrá datos existentes → incompatibilidad
- ❌ Olvidar exportar campo en responses
- ❌ Cambiar tipo sin actualizar validaciones

---

### Agregar nueva validación de DTO

**Dónde:**
- `backend/routes/*.js` — Antes de operación
- Opcionalmente: crear archivo `backend/validators/` si lógica compleja

**Ejemplo:**
```javascript
// Validación simple inline
router.post('/:projectId/symbols', async (req, res) => {
  const { name, type } = req.body;
  
  if (!name || !name.toString().trim()) {
    return res.status(400).json({ message: 'El nombre es obligatorio.' });
  }
  
  if (!['Sujeto', 'Objeto', 'Verbo'].includes(type)) {
    return res.status(400).json({ message: 'Tipo inválido.' });
  }
  
  // Continúa...
});

// Validación modular (para lógica compleja)
// backend/validators/symbolValidator.js
export function validateSymbol(data) {
  const errors = [];
  if (!data.name) errors.push('name required');
  if (!validTypes.includes(data.type)) errors.push('invalid type');
  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

// Uso en ruta
const validation = validateSymbol(req.body);
if (!validation.valid) {
  return res.status(400).json({ message: validation.errors.join(', ') });
}
```

**Riesgos:**
- ❌ Validar solo frontend → backend bypassing
- ❌ Validaciones inconsistentes entre endpoints
- ❌ Mensajes de error unclear

---

## Persistencia

### Agregar nueva colección MongoDB

**Dónde:**
- `backend/models/NewEntity.js` — Schema
- `backend/routes/new-entities.js` — CRUD
- `backend/index.js` — Registrar rutas
- `frontend/api.js` — Wrappers HTTP

**Pasos:**
```javascript
// backend/models/MyEntity.js
const MyEntitySchema = new mongoose.Schema({
  name: { type: String, required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MyEntity', MyEntitySchema);

// backend/routes/my-entities.js (nuevo archivo)
const express = require('express');
const router = express.Router();
const MyEntity = require('../models/MyEntity');

router.post('/:projectId/my-entities', async (req, res) => {
  // POST logic
});

// backend/index.js
app.use('/api', require('./routes/my-entities'));
```

**Riesgos:**
- ❌ No crear índices → queries lentas
- ❌ No limpiar datos orphaned al eliminar proyecto
- ❌ No hacer backup de datos

---

### Migrar datos (cambiar schema)

**Dónde:**
- Script de migración (si MongoDB Atlas)
- O actualizar lógica aplicación directamente

**Pasos (recomendado):**
```javascript
// scripts/migrate-schema.js
const mongoose = require('mongoose');
const Project = require('../backend/models/Project');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  try {
    // Migración: agregar campo newField con valor por defecto
    await Project.updateMany(
      { newField: { $exists: false } },
      { $set: { newField: 'default-value' } }
    );
    console.log('Migration completed');
  } catch (error) {
    console.error('Migration failed:', error);
  }
  process.exit(0);
});

// Ejecutar: node scripts/migrate-schema.js
```

**Riesgos:**
- ⚠️ CRÍTICO: Hacer backup antes de migrar producción
- ❌ No probar migración en dev primero
- ❌ No dejar rollback plan

---

## Seguridad

### Agregar validación de permisos

**Dónde:**
- `backend/middleware/auth.js` — Middleware autenticación
- `backend/routes/` — Antes de operación sensible

**Pasos:**
```javascript
// backend/middleware/auth.js
export async function requireProjectAccess(req, res, next) {
  const { projectId } = req.params;
  const userId = req.user?.id;  // Del JWT
  
  const project = await Project.findById(projectId);
  if (!project) return res.status(404).json({ message: 'Project not found' });
  
  // Verificá que usuario tiene acceso (p.ej: es creador)
  if (project.createdBy?.toString() !== userId) {
    return res.status(403).json({ message: 'Access denied' });
  }
  
  next();
}

// Uso en ruta
router.delete('/:projectId', requireProjectAccess, async (req, res) => {
  // Solo usuarios autorizados llegan aquí
});
```

**Riesgos:**
- ⚠️ CRÍTICO: Validar permisos en CADA ruta sensible
- ❌ Confiar en datos frontend para permisos
- ❌ No loguear accesos rechazados

---

### Implementar rate limiting

**Dónde:**
- `backend/middleware/` — Nuevo middleware
- `backend/index.js` — Registrar globalmente o por ruta

**Ejemplo:**
```javascript
// backend/middleware/rateLimit.js
const rateLimit = require('express-rate-limit');

export const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100 // límite 100 requests per windowMs
});

// backend/index.js
app.use(limiter);

// O por ruta específica
app.post('/api/projects', limiter, (req, res) => { ... });
```

**Riesgos:**
- ❌ No proteger endpoints de escritura
- ❌ Límites demasiado restrictivos → usuarios reales frustrados

---

## Configuración

### Agregar variable de entorno

**Dónde:**
- `backend/.env.example` — Documento referencia
- `backend/.env` — Actual (NO commitear)
- `backend/index.js` o módulo que la usa — Leer con `process.env.MY_VAR`
- Documentá en [`documents/CONVENTIONS.md`](./CONVENTIONS.md)

**Pasos:**
```bash
# backend/.env.example
MY_NEW_VAR=default-value-here
DESCRIPTION=What this variable does

# backend/.env (local, NO commitear)
MY_NEW_VAR=my-actual-value

# En código
const myVar = process.env.MY_NEW_VAR || 'fallback-value';
```

**Riesgos:**
- ⚠️ CRÍTICO: Nunca commitear `.env` con valores reales
- ❌ Variables sensibles (API keys) hardcodeadas
- ❌ Documentar uso de variable

---

### Cambiar puerto Backend

**Dónde:**
- `backend/.env` — `PORT=3000`
- `backend/index.js` — `const PORT = process.env.PORT || 4000`
- `docker-compose.yml` — Si usando Docker
- `frontend/.env` — `VITE_API_BASE` si cambiá URL

**Riesgos:**
- ❌ Olvidar actualizar Docker compose
- ❌ Frontend apunta a puerto viejo

---

## Performance

### Optimizar query MongoDB lenta

**Dónde:**
- `backend/routes/*.js` o `backend/ai/*.js` — Query actual
- `backend/models/*.js` — Agregá índices si necesario

**Pasos:**
```javascript
// Problema: query lenta
const symbols = await Symbol.find({ project: projectId });

// Solución 1: Agregá índice
// backend/models/Symbol.js
SymbolSchema.index({ project: 1 });  // Índice en project

// Solución 2: Usa .lean() si solo necesitas lectura
const symbols = await Symbol.find({ project: projectId }).lean();

// Solución 3: Aggregation pipeline para operaciones complejas
const result = await Symbol.aggregate([
  { $match: { project: new ObjectId(projectId) } },
  { $lookup: { from: 'relations', localField: '_id', foreignField: 'fromId', as: 'outgoing' } },
  { $project: { name: 1, type: 1, relationCount: { $size: '$outgoing' } } }
]);
```

**Riesgos:**
- ❌ Queries sin índices (especialmente en colecciones grandes)
- ❌ Fetchear datos innecesarios (usar projections)
- ❌ N+1 queries (fetch document, después fetch relaciones en loop)

---

### Implementar caché

**Dónde:**
- `backend/ai/services` — Cachear resultados costosos
- Redis (opcional) — Para caché distribuida
- O memory cache local

**Ejemplo:**
```javascript
// Caché simple en memory
const cache = new Map();

export async function getProjectWithCache(projectId) {
  const cacheKey = `project:${projectId}`;
  
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  
  const project = await Project.findById(projectId);
  cache.set(cacheKey, project);
  
  // Invalidar después de 5 min
  setTimeout(() => cache.delete(cacheKey), 5 * 60 * 1000);
  
  return project;
}

// Invalidar cache cuando proyecto cambia
await project.save();
cache.delete(`project:${projectId}`);  // Invalidar
```

**Riesgos:**
- ⚠️ CRÍTICO: Cachear dato obsoleto → bugs sutiles
- ❌ Caché infinito → memory leak
- ❌ Caché no sincronizado entre instancias (sin Redis)

---

## Testing

### Agregá test unitario

**Dónde:**
- `tests/` (crear si no existe)
- Nombre: `tests/unit/nombreModulo.test.js`

**Pasos:**
```javascript
// tests/unit/graphSanityEngine.test.js
const { GraphSanityEngine } = require('../../backend/ai/graph-sanity-engine.service');

describe('GraphSanityEngine', () => {
  let gse;
  
  beforeEach(() => {
    gse = new GraphSanityEngine();
  });
  
  test('normalizeGraph - array input', () => {
    const input = [
      { fromId: '1', toId: '2', type: 'depends' },
      { fromId: '2', toId: '3', type: 'depends' }
    ];
    
    const result = gse.normalizeGraph(input);
    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toHaveLength(2);
  });
  
  test('validateGraph - detects broken edges', () => {
    const graph = {
      nodes: [{ id: '1' }],
      edges: [{ source: '1', target: '2' }]  // target no existe
    };
    
    const validation = gse.validateGraph(graph);
    expect(validation.valid).toBe(false);
    expect(validation.issues.length).toBeGreaterThan(0);
  });
});
```

**Riesgos:**
- ❌ No tester funcionalidad crítica (graph analysis, AI orchestration)
- ❌ Tests frágiles (dependencia de data externa)
- ❌ No ejecutar tests en CI/CD

---

## Resumen Rápido

| Tipo Cambio | Dónde | Críticos | Riesgos |
|-------------|-------|----------|---------|
| **Función negocio** | `routes/` + `models/` | Validación | Data corruption |
| **UI/UX** | `pages/` + `components/` | Consistency | UX broken |
| **API** | `routes/` + `api.js` | Formato | Client-server desync |
| **Estado RT** | Socket.io handlers | Broadcasting | Users out of sync |
| **Persistencia** | `models/` | Índices | Queries lentas |
| **Seguridad** | `middleware/` + `routes/` | Permisos | Unauthorized access |
| **Perf** | Query optimization | Caché | Stale data |

---

**Versión:** 1.0  
**Última revisión:** 2026-05-17
