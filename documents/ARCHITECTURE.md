# 🏛️ ReqTracker - Architecture & Patterns

**Última actualización:** 2026-05-17

> **Patrones de diseño, DTOs, contratos de datos, validaciones y flujos arquitectónicos**

---

## Tabla de Contenidos

1. [Patrones Arquitectónicos](#patrones-arquitectónicos)
2. [Capas y Separación de Responsabilidades](#capas-y-separación-de-responsabilidades)
3. [DTOs y Data Contracts](#dtos-y-data-contracts)
4. [Flujos de Datos Críticos](#flujos-de-datos-críticos)
5. [Validación Estrategias](#validación-estrategias)
6. [Error Handling](#error-handling)
7. [Patrones de Concurrencia](#patrones-de-concurrencia)
8. [Graph Processing Pipeline](#graph-processing-pipeline)

---

## Patrones Arquitectónicos

### 1. Layered Architecture (3 capas independientes)

```
┌──────────────────────────────────────┐
│ FRONTEND (React + Vite)              │ ← Presentación
│ - Pages (ProjectPage, Home)          │
│ - Components (RelationMap, AIChat)   │
│ - Contextos (Auth)                   │
└──────────┬───────────────────────────┘
           │ HTTP (api.js)
┌──────────▼───────────────────────────┐
│ BACKEND (Node.js + Express)          │ ← Lógica de Negocio
│ - Routes (coordinación)              │
│ - Services (lógica pesada)           │
│ - Models (esquemas)                  │
└──────────┬───────────────────────────┘
           │ HTTP
┌──────────▼───────────────────────────┐
│ ANALYTICS (Python FastAPI)           │ ← Análisis especializado
│ - Semantic analysis                  │
│ - Graph algorithms                   │
│ - Agent evaluation                   │
└──────────────────────────────────────┘
```

**Ventajas:**
- ✅ Independencia: cada capa puede deployarse por separado
- ✅ Escalabilidad: Analytics puede ser standalone
- ✅ Testing: cada capa testeable independientemente

**Acoplamiento Aceptado:**
- Backend → Analytics (HTTP)
- Frontend → Backend (HTTP + Socket.io)
- Never Frontend → Analytics (siempre via Backend)

---

### 2. Service Locator Pattern (Backend)

```javascript
// backend/routes/projects.js
router.post('/:projectId/symbols', async (req, res) => {
  // Routes: coordinador
  const symbol = await SymbolModel.create(req.body);  ← Model
  await projectService.addSymbol(projectId, symbol);  ← Service
  broadcastProjectUpdate(req, projectId);             ← Event
  res.json(symbol);
});
```

**Responsabilidades:**
- **Routes:** Parsear entrada, delegar a services, serializar respuesta
- **Services:** Lógica de negocio, coordinación entre models
- **Models:** Persistencia, esquemas, queries básicas
- **Events:** Comunicación asincrónica via Socket.io

---

### 3. Tool-Based LLM Orchestration

```
┌────────────────────────────────────────┐
│ ai.controller.js                       │
│ - Recibe: { message, projectId }       │
│ - Orquesta pipeline IA                 │
└──────────┬─────────────────────────────┘
           │
    ┌──────▼──────────────────────────────┐
    │ 1. GraphSanityEngine.run()           │
    │    Normaliza + valida grafo          │
    └──────┬──────────────────────────────┘
           │
    ┌──────▼──────────────────────────────┐
    │ 2. ContextCompiler.compileContext()  │
    │    Comprime 400+ → 20-30 relaciones │
    └──────┬──────────────────────────────┘
           │
    ┌──────▼──────────────────────────────┐
    │ 3. UnifiedPlanner.generatePlan()     │
    │    Genera plan JSON                  │
    └──────┬──────────────────────────────┘
           │
    ┌──────▼──────────────────────────────┐
    │ 4. ContractEnforcer.validatePlan()   │
    │    Valida esquema                    │
    └──────┬──────────────────────────────┘
           │
    ┌──────▼──────────────────────────────┐
    │ 5. Execute tools (project, symbol, etc.) │
    │    LLM puede invocar funciones       │
    └──────┬──────────────────────────────┘
           │
    ┌──────▼──────────────────────────────┐
    │ 6. Stream respuesta                  │
    │    JSON lines format                 │
    └──────────────────────────────────────┘
```

---

## Capas y Separación de Responsabilidades

### Backend Structure

```
backend/
├── routes/                    ← COORDINACIÓN
│   ├── projects.js           Request → Service → Response
│   └── symbols.js            
│
├── ai/
│   ├── controllers/          ← ORQUESTACIÓN
│   │   └── ai.controller.js  Coordina: GSE → Compiler → Planner
│   │
│   ├── services/             ← LÓGICA PESADA
│   │   ├── graph-sanity-engine.service.js
│   │   ├── context-compiler.js
│   │   ├── unified-planner.service.js
│   │   └── chat.service.js
│   │
│   ├── tools/                ← FUNCIONES PARA LLM
│   │   ├── project.tool.js   Leer proyecto
│   │   ├── symbol.tool.js    Manejo símbolos
│   │   └── semantic.tool.js  Queries semánticas
│   │
│   └── prompts/              ← PROMPTS SISTEMA
│       └── system.prompt.js
│
├── models/                    ← PERSISTENCIA
│   ├── Project.js            MongoDB schemas
│   ├── Symbol.js
│   └── Relation.js
│
└── middleware/                ← CROSS-CUTTING
    └── auth.js                JWT validation
```

### Responsabilidad por Nivel

| Nivel | Responsabilidad | Nunca Debe |
|-------|-----------------|-----------|
| **Route** | Parsear req, coordinar, serializar | Lógica compleja, queries directas |
| **Service** | Lógica de negocio, coordinación | Acceso directo HTTP, modificar req/res |
| **Model** | Esquema, validaciones básicas, queries | Lógica de negocio, transformaciones |
| **Tool** | Función que LLM puede invocar | Lógica de negocio directa |
| **Controller** (AI) | Orquestar pipeline IA | Hacer todo en una función |

---

## DTOs y Data Contracts

### DTO: Project (CompleteProject)

```typescript
interface ProjectDTO {
  // Identificación
  _id: ObjectId;
  name: string;
  createdBy?: string;
  createdAt: Date;
  
  // Contenido
  symbols: Symbol[];
  relations: Relation[];
  scenarios?: Scenario[];
  tasks?: Task[];
  inspections?: Inspection[];
  
  // Estado
  status?: 'active' | 'archived';
  code?: string;  // Para seguridad
  
  // Metadata
  about?: string;
  config?: {
    theme?: string;
    language?: string;
  };
}
```

**Validación en cada capa:**

```javascript
// Frontend (ProjectPage.jsx) - Validación UX básica
if (!project.symbols || !Array.isArray(project.symbols)) {
  setError('Símbolos inválidos');
  return;
}

// Backend (routes/projects.js) - Validación entrada
if (!req.body.name || req.body.name.trim().length === 0) {
  return res.status(400).json({ message: 'Nombre requerido' });
}

// Model (Project.js) - Validación schema
const ProjectSchema = new Schema({
  name: { type: String, required: true, trim: true },
  symbols: [{ type: Schema.Types.ObjectId, ref: 'Symbol' }]
});
```

---

### DTO: Symbol (EntidadDelProblema)

```typescript
interface SymbolDTO {
  _id: ObjectId;
  projectId: ObjectId;
  
  // Core
  name: string;                    // "Usuario", "Autenticación"
  type: 'Sujeto' | 'Objeto' | 'Verbo';
  description?: string;
  
  // Relaciones
  incomingRelations?: Relation[];  // Quien depende de éste
  outgoingRelations?: Relation[];  // De quién depende
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    priority?: 'high' | 'medium' | 'low';
    status?: 'draft' | 'active' | 'resolved';
  };
}
```

---

### DTO: GraphData (Para Pipeline IA)

**Input a GraphSanityEngine:**
```typescript
interface RawGraphInput {
  nodes: Array<{
    id: string;
    name: string;
    type?: string;
    metadata?: Record<string, any>;
  }>;
  relations: Array<{
    fromId: string;
    toId: string;
    type?: string;
    weight?: number;
  }>;
}
```

**Output de GraphSanityEngine:**
```typescript
interface NormalizedGraph {
  nodes: Node[];
  edges: Array<{
    source: string;
    target: string;
    fromName: string;      ← Critical: nombres incluidos
    toName: string;        ← Necesario para context-compiler
    type?: string;
    weight?: number;
  }>;
  validation: {
    valid: boolean;
    issues: string[];
    stability: number;     // 0-1, 1 = totalmente estable
  };
}
```

**Input a ContextCompiler (debe ser array):**
```typescript
type ContextInput = Array<{
  source: string;          // Node ID
  target: string;          // Node ID
  fromName: string;        // ← REQUERIDO
  toName: string;          // ← REQUERIDO
  type?: string;
  weight?: number;
}>;
```

---

### Data Flow: Transformaciones

```
1. Frontend (ProjectPage.jsx)
   ├─ Carga proyecto: { symbols, scenarios, tasks, ... }
   
2. HTTP Request
   └─ POST /chat/stream { message, projectId, context }

3. Backend (ai.controller.js)
   ├─ Carga BD: Project + populados
   ├─ Extrae rawGraph = { nodes, relations }
   │
4. GraphSanityEngine.run()
   ├─ Input: { nodes, relations }
   ├─ Output: { nodes, edges[], validation }
   │
5. ContextCompiler.compileContext()
   ├─ Input: edges[] (array de relaciones con fromName/toName)
   ├─ Output: compressed = { nodes, relations, summary }
   │
6. UnifiedPlanner.generatePlan()
   ├─ Input: compressed + goal
   ├─ Output: plan = { steps[], mode, metadata }
   │
7. ContractEnforcer.validatePlan()
   ├─ Input: plan JSON
   ├─ Output: { valid, errors }
   │
8. Stream Response
   └─ JSON lines: { type: 'text' | 'tool' | 'done', content }
```

---

## Flujos de Datos Críticos

### Flujo 1: Crear Símbolo (CRUD)

```
┌─────────────────────────────────────────────┐
│ FRONTEND: ProjectPage.jsx                   │
│ handleCreateSymbol({ name, type, desc })    │
└──────────────┬──────────────────────────────┘
               │ (axios POST)
┌──────────────▼──────────────────────────────┐
│ ROUTE: routes/symbols.js                    │
│ POST /projects/:projectId/symbols           │
│ 1. Valida entrada (name, type required)     │
│ 2. Crea Symbol document                     │
│ 3. Agrega a project.symbols[]               │
│ 4. Emite 'projectUpdated' via Socket.io     │
│ 5. Retorna { symbol }                       │
└──────────────┬──────────────────────────────┘
               │ (Socket.io broadcast)
┌──────────────▼──────────────────────────────┐
│ FRONTEND: ProjectPage.jsx                   │
│ Escucha 'projectUpdated'                    │
│ ├─ Refetch símbolos                         │
│ ├─ Actualiza state.symbols                  │
│ └─ Re-renderiza lista                       │
└─────────────────────────────────────────────┘

VALIDACIÓN:
- Frontend: UX feedback rápido
- Backend: VERDADERA VALIDACIÓN (puede bypassarse desde cliente)
- Model: Esquema Mongoose valida

SINCRONIZACIÓN RT:
- Sin 'projectUpdated' → otros usuarios no ven cambios
- Critical: broadcastProjectUpdate(req, projectId) en cada modificación
```

---

### Flujo 2: Análisis IA (Chat)

```
┌─────────────────────────────────────────────┐
│ FRONTEND: AIChat.jsx                        │
│ handleSubmit({ userMessage })               │
│ POST /chat/stream                           │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│ CONTROLLER: ai.controller.js                │
│ POST /chat/stream handler                   │
│                                             │
│ const rawGraph = await getProjectGraph()    │
│ // { nodes, relations }                     │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│ SERVICE: GraphSanityEngine.run()             │
│ Input:  { nodes, relations }                │
│ Output: { nodes, edges[], validation }      │
│                                             │
│ - Normaliza múltiples formatos              │
│ - Resuelve nombres (fromName, toName)       │
│ - Valida integridad                         │
│ - Analiza estabilidad                       │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│ SERVICE: context-compiler.js                │
│ Input:  edges[] + goal                      │
│ Output: { nodes, relations, summary }       │
│                                             │
│ - Compresión semántica (438 → 20-30)        │
│ - Scoring por relevancia                    │
│ - Selección top-K nodos                     │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│ SERVICE: unified-planner.service.js         │
│ Input:  contextPack + goal                  │
│ Output: { steps, mode, metadata }           │
│                                             │
│ - Llamada LLM (gpt-4o-mini)                 │
│ - Stream JSON response                      │
│ - Parse plan JSON                           │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│ SERVICE: planner-contract-enforcer.js       │
│ Input:  plan JSON                           │
│ Output: { valid, errors }                   │
│                                             │
│ - Valida schema                             │
│ - Verifica step types                       │
│ - Valida tool parameters                    │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│ TOOLS EXECUTION (if plan valid)             │
│ - Ejecuta tools que LLM decidió             │
│ - read_project, list_symbols, etc.          │
│ - Retorna resultados                        │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│ RESPONSE: Stream JSON lines                 │
│ { type: 'text', content: '...' }            │
│ { type: 'tool', name: 'X', result: {} }     │
│ { type: 'done' }                            │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│ FRONTEND: AIChat.jsx                        │
│ Renderiza streaming text                    │
│ Muestra tool calls                          │
└─────────────────────────────────────────────┘
```

---

## Validación Estrategias

### Múltiples Capas de Defensa

```
Capa 1: Frontend (UX)
├─ Feedback rápido al usuario
├─ NO es seguridad (puede bypassarse)
└─ Ejemplo: required en form

Capa 2: Route Handler (Request)
├─ Validar entrada básica
├─ Parsear tipos correctos
└─ Ejemplo: if (!name) return 400

Capa 3: Model (Schema)
├─ Validar según esquema MongoDB
├─ Enforce tipos, ranges
└─ Ejemplo: name: { type: String, required: true }

Capa 4: Service (Lógica)
├─ Validar contratos entre servicios
├─ Validar post-condiciones
└─ Ejemplo: GraphSanityEngine valida integridad grafo

Capa 5: Auth (Security)
├─ Verificar permisos
├─ Validar que usuario tiene acceso
└─ Ejemplo: requireProjectAccess middleware
```

### Validación de GraphSanityEngine

```javascript
// Input validation
validateInput(graph) {
  if (!Array.isArray(graph.nodes)) throw Error('nodes must be array');
  if (!Array.isArray(graph.relations)) throw Error('relations must be array');
  
  // Nodes tienen id?
  graph.nodes.forEach(node => {
    if (!node.id) throw Error('Node missing id');
  });
}

// Graph integrity validation
validateGraph(normalizedGraph) {
  const issues = [];
  
  // ¿Hay nodos huérfanos?
  const nodeIds = new Set(normalizedGraph.nodes.map(n => n.id));
  normalizedGraph.edges.forEach(edge => {
    if (!nodeIds.has(edge.source)) issues.push(`Broken edge: source ${edge.source} not found`);
    if (!nodeIds.has(edge.target)) issues.push(`Broken edge: target ${edge.target} not found`);
  });
  
  // ¿Labels válidos?
  normalizedGraph.edges.forEach(edge => {
    if (!edge.fromName || !edge.toName) {
      issues.push(`Edge missing names: ${edge.source} -> ${edge.target}`);
    }
  });
  
  return {
    valid: issues.length === 0,
    issues,
    stability: calculateStability(normalizedGraph)
  };
}
```

---

## Error Handling

### Backend Error Strategy

```javascript
// backend/routes/projects.js
router.post('/:projectId/symbols', async (req, res) => {
  try {
    // Validación
    if (!req.body.name) {
      return res.status(400).json({ 
        message: 'Name is required',
        code: 'VALIDATION_ERROR'
      });
    }
    
    // Negocio
    const symbol = await Symbol.create({ ...req.body, project: req.params.projectId });
    
    // Broadcast
    broadcastProjectUpdate(req, req.params.projectId);
    
    res.status(201).json(symbol);
    
  } catch (error) {
    // Error no controlado
    logger.error('Symbol creation failed', { 
      error: error.message,
      projectId: req.params.projectId,
      body: req.body 
    });
    
    res.status(500).json({ 
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});
```

### Frontend Error Handling

```javascript
// frontend/pages/ProjectPage.jsx
const handleCreateSymbol = async () => {
  try {
    setLoading(true);
    const newSymbol = await createSymbol(projectId, {
      name, type, description
    });
    
    // Success
    setSymbols([...symbols, newSymbol]);
    setMessage('Símbolo creado', 'success');
    
  } catch (error) {
    // Error conocido
    if (error.response?.status === 400) {
      setMessage(error.response.data.message, 'error');
    } else if (error.response?.status === 404) {
      setMessage('Proyecto no encontrado', 'error');
    } else {
      // Error desconocido
      setMessage('Error al crear símbolo', 'error');
      console.error('Unknown error:', error);
    }
  } finally {
    setLoading(false);
  }
};
```

---

## Patrones de Concurrencia

### Sincronización en Tiempo Real (Socket.io)

```javascript
// backend/index.js - Setup
io.on('connection', (socket) => {
  socket.join(`project:${socket.handshake.query.projectId}`);
  
  // Escuchar cambios
  socket.on('projectUpdated', (data) => {
    // Broadcast a todos en la sala
    io.to(`project:${data.projectId}`).emit('projectUpdated', data);
  });
});

// backend/routes/projects.js - Emitir cuando hay cambios
async function broadcastProjectUpdate(req, projectId) {
  const io = req.app.get('io');
  io.to(`project:${projectId}`).emit('projectUpdated', { projectId });
}

// frontend/pages/ProjectPage.jsx - Sincronizar
useEffect(() => {
  socket?.on('projectUpdated', async () => {
    // Refetch datos
    const updated = await fetchProject(projectId);
    setProject(updated);
    setSymbols(updated.symbols);
  });
  
  return () => socket?.off('projectUpdated');
}, [socket, projectId]);
```

**Garantías:**
- ✅ Todos los usuarios ven cambios en < 1s
- ⚠️ Posible race condition si 2 usuarios editan simultáneamente (sin locking)

---

### Operaciones Atómicas

```javascript
// MALO: No atómico (race condition)
const project = await Project.findById(projectId);
project.symbols.push(symbolId);  // Entre aquí y save(), otro usuario cambió
await project.save();

// MEJOR: Atómico
await Project.findByIdAndUpdate(
  projectId,
  { $push: { symbols: symbolId } },  // MongoDB hace esto atómicamente
  { new: true }
);

// AÚN MEJOR: Con transacción (si cambios múltiples)
const session = await mongoose.startSession();
session.startTransaction();
try {
  await Symbol.create([symbolData], { session });
  await Project.findByIdAndUpdate(projectId, { $push: { symbols: symbolId } }, { session });
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
}
```

---

## Graph Processing Pipeline

### Ciclo Completo: Entrada → Salida

```
ENTRADA (Backend recibe de Frontend)
├─ projectId
├─ userMessage
└─ (optional) context filters

EXTRACCIÓN GRAFO
├─ Project.findById(projectId).populate(['symbols', 'scenarios'])
├─ Mapear symbols → nodes
├─ Mapear relations → edges
└─ Output: { nodes, relations }

NORMALIZACIÓN (GraphSanityEngine)
├─ Detectar formato (array vs object)
├─ Crear node lookup map
├─ Resolver fromName/toName
├─ Output: { nodes, edges[] con names }

COMPRESIÓN (ContextCompiler)
├─ Embedding-based similarity
├─ Structural importance (hubs, orphans)
├─ Recency scoring
├─ Select top-K relevant nodes
└─ Output: { nodes[], edges[] } comprimido

PLANIFICACIÓN (UnifiedPlanner)
├─ LLM con system prompt
├─ Context comprimido
├─ Tool registry
├─ Output: { steps[], mode }

VALIDACIÓN (ContractEnforcer)
├─ Verificar schema
├─ Validar step types
├─ Validar tool parameters
└─ Output: { valid, errors }

EJECUCIÓN (ToolExecutor, si válido)
├─ Interpretar steps
├─ Invocar tools correspondientes
├─ Retornar resultados
└─ Output: { toolResults[] }

RESPUESTA (Stream JSON lines)
├─ { type: 'text', content: '...' }
├─ { type: 'tool', name, result }
└─ { type: 'done' }
```

### Contratos Críticos

**GraphSanityEngine ↔ ContextCompiler:**
```
GSE Output.edges DEBE tener:
- source: string
- target: string
- fromName: string        ← REQUERIDO
- toName: string          ← REQUERIDO

Si faltan: ContextCompiler.validate() falla
```

**ContextCompiler ↔ UnifiedPlanner:**
```
Compiler Output DEBE ser:
{
  nodes: [ { id, name, metadata } ],
  relations: [ { source, target, fromName, toName } ],
  summary: string
}

UnifiedPlanner espera nodes[] y relations[] (ARRAY)
Si recibe object sin array: FALLA
```

---

## Anti-Patterns (NO hacer)

### ❌ Validation Only in Frontend
```javascript
// MALO
if (req.body.name) {  // Si viene del cliente, puede ser fake
  // Procesa...
}

// BUENO
if (!req.body.name || req.body.name.trim() === '') {
  return res.status(400).json({ message: 'Name required' });
}
```

### ❌ Hardcoded URLs/Configs
```javascript
// MALO
const API_URL = 'http://localhost:3000';

// BUENO
const API_URL = process.env.VITE_API_BASE || 'http://localhost:3000';
```

### ❌ N+1 Queries
```javascript
// MALO (N+1)
const projects = await Project.find();
for (const p of projects) {
  p.symbols = await Symbol.find({ project: p._id });  // Query por cada proyecto
}

// BUENO
const projects = await Project.find().populate('symbols');
```

### ❌ No Broadcasting RT Changes
```javascript
// MALO
await project.save();
// Otros usuarios no ven cambios

// BUENO
await project.save();
broadcastProjectUpdate(req, projectId);  // Notifica a todos
```

### ❌ Modifying UI State Without Backend
```javascript
// MALO
symbols.push(newSymbol);  // UI directo, sin persistir
setSymbols([...symbols, newSymbol]);

// BUENO
const created = await createSymbol(...);  // Persiste primero
setSymbols([...symbols, created]);        // Luego actualiza UI
```

---

## Documentos Relacionados

- **[MODULES_AND_LAYERS.md](./MODULES_AND_LAYERS.md)** — Estructura física
- **[CHANGE_GUIDE.md](./CHANGE_GUIDE.md)** — Dónde modificar
- **[CONVENTIONS.md](./CONVENTIONS.md)** — Estándares (próximo)

---

**Versión:** 1.0  
**Última revisión:** 2026-05-17
