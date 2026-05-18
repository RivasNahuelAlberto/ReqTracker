# 🗂️ ReqTracker - Modules & Layers Map

**Última actualización:** 2026-05-17

---

## Tabla de Contenidos

1. [Estructura General](#estructura-general)
2. [Frontend - Capas y Módulos](#frontend---capas-y-módulos)
3. [Backend - Capas y Módulos](#backend---capas-y-módulos)
4. [Analytics - Capas y Módulos](#analytics---capas-y-módulos)
5. [Responsabilidades por Carpeta](#responsabilidades-por-carpeta)
6. [Dependencias entre Módulos](#dependencias-entre-módulos)
7. [Rutas de Flujo de Datos](#rutas-de-flujo-de-datos)

---

## Estructura General

```
reqtracker/
├── frontend/                           # 🎨 UI - React + Vite
│   ├── src/
│   │   ├── pages/                      # Páginas principales
│   │   ├── components/                 # Componentes reutilizables
│   │   ├── api.js                      # HTTP Client
│   │   ├── main.jsx                    # Bootstrap
│   │   └── App.jsx                     # Router principal
│   ├── vite.config.js                  # Config Vite
│   ├── package.json                    # Dependencias
│   └── index.html                      # Template HTML
│
├── backend/                            # ⚙️ API - Node.js + Express
│   ├── ai/                             # 🤖 Módulos IA
│   │   ├── controllers/                # Orchestration & entry points
│   │   ├── services/                   # Lógica de negocio
│   │   ├── tools/                      # Tool definitions (LLM calling)
│   │   └── logger/                     # Logging estructurado
│   ├── routes/                         # 🛣️ Endpoints REST
│   │   ├── projects.js                 # CRUD Proyectos
│   │   ├── symbols.js                  # CRUD Símbolos
│   │   └── auth.js (opcional)          # JWT/OAuth
│   ├── models/                         # 📊 Esquemas MongoDB
│   │   ├── Project.js                  # Schema Proyecto
│   │   ├── Symbol.js                   # Schema Símbolo
│   │   └── Relation.js                 # Schema Relación
│   ├── middleware/                     # 🔐 Middlewares
│   │   └── auth.js (opcional)          # JWT validation
│   ├── index.js                        # Entry point
│   ├── .env.example                    # Template env vars
│   └── package.json                    # Dependencias
│
├── analytics/                          # 📈 Python FastAPI
│   ├── app.py                          # Entry point
│   ├── semantic/                       # Análisis semántico
│   ├── graph/                          # Análisis de grafos
│   ├── monitoring/                     # Métricas & health
│   ├── agent/                          # ETAPA 9 - Evaluación
│   └── Dockerfile                      # Containerization
│
└── documents/                          # 📚 Documentación
    ├── 00_GETTING_STARTED.md           # Guía rápida
    ├── TECHNICAL_OVERVIEW.md           # Visión general
    ├── MODULES_AND_LAYERS.md           # ← Estás aquí
    ├── ARCHITECTURE.md                 # Patrones detallados
    ├── CHANGE_GUIDE.md                 # Dónde modificar
    ├── CONVENTIONS.md                  # Estándares
    └── development_guides/             # Procesos específicos
```

---

## Frontend - Capas y Módulos

### Estructura Interna

```
frontend/src/
├── pages/                      # 📄 Páginas (componentes top-level)
│   ├── Home.jsx                # Landing, crear proyectos, listar
│   └── ProjectPage.jsx         # Editor principal del proyecto
│
├── components/                 # 🧩 Componentes reutilizables
│   ├── AuthContext.jsx         # Contexto autenticación (if auth)
│   ├── RelationMap.jsx         # Visualización del grafo
│   ├── AIChat.jsx              # Chat con IA (if enabled)
│   ├── RoleManagement.jsx      # Gestión de roles (if RBAC)
│   └── ReloadNotification.jsx  # Notificaciones Socket.io
│
├── api.js                      # 🌐 HTTP client centralizado
├── App.jsx                     # Router principal
├── main.jsx                    # Bootstrap React
└── styles.css                  # Estilos globales
```

### Capas Frontend

```
┌─────────────────────────────────────────┐
│ PAGES (pages/)                          │
│ - Home: Creación y listado de proyectos │
│ - ProjectPage: Editor principal         │
└──────────────┬──────────────────────────┘
               │ Componen
┌──────────────▼──────────────────────────┐
│ COMPONENTS (components/)                │
│ - RelationMap (visualización)           │
│ - AIChat (si IA enabled)                │
│ - Contextos (AuthContext, etc.)        │
└──────────────┬──────────────────────────┘
               │ Usan
┌──────────────▼──────────────────────────┐
│ API LAYER (api.js)                      │
│ - fetchProjects(), createProject(), etc │
│ - Axios client configurado              │
│ - Base URL: process.env.VITE_API_BASE   │
└──────────────┬──────────────────────────┘
               │ HTTP
┌──────────────▼──────────────────────────┐
│ BACKEND API (http://localhost:3000)     │
└──────────────────────────────────────────┘
```

### Responsabilidades por Componente

| Componente | Responsabilidad | No debe |
|-----------|-----------------|---------|
| **Home.jsx** | Crear proyectos, importar JSON, listar | Lógica de proyecto complejo |
| **ProjectPage.jsx** | Editor principal, gestión tabs, state | Validaciones críticas |
| **RelationMap.jsx** | Visualización del grafo (canvas/SVG) | Análisis de grafo |
| **AIChat.jsx** | UI del chat, streaming | Generación de respuestas |
| **AuthContext.jsx** | Almacenamiento token JWT | Generación del token |

### Funciones Críticas en api.js

```javascript
// PROYECTOS
export async function fetchProjects()                    // GET /api/projects
export async function createProject(name, seedSymbols)   // POST /api/projects
export async function fetchProject(projectId)            // GET /api/projects/:projectId
export async function deleteProject(projectId, code)     // DELETE /api/projects/:projectId
export async function setProjectSecurity(id, code)       // PATCH /api/projects/:projectId/security

// SÍMBOLOS
export async function fetchSymbols(projectId)            // GET /api/projects/:projectId/symbols
export async function createSymbol(projectId, ...)       // POST /api/projects/:projectId/symbols
export async function updateSymbol(projectId, id, ...)   // PUT /api/projects/:projectId/symbols/:id
export async function deleteSymbol(projectId, id)        // DELETE /api/projects/:projectId/symbols/:id

// ESCENARIOS, TAREAS, etc.
export async function createScenario(projectId, ...)
export async function createTask(projectId, ...)
// ... más operaciones CRUD

// EXPORT/IMPORT
export async function fetchProjectExport(projectId)      // GET /api/projects/:projectId/export
export async function createProjectFromJson(json)        // POST /api/projects/import
```

---

## Backend - Capas y Módulos

### Estructura Interna

```
backend/
├── ai/                         # 🤖 CAPA IA & LÓGICA
│   ├── controllers/
│   │   ├── ai.controller.js         # Orquestación chat
│   │   └── recommendation.controller.js # Recomendaciones
│   │
│   ├── services/
│   │   ├── graph-sanity-engine.service.js   # Validación grafo
│   │   ├── context-compiler.js              # Compresión contexto
│   │   ├── unified-planner.service.js       # Generación planes
│   │   ├── planner-contract-enforcer.js     # Validación schemas
│   │   ├── chat.service.js                  # Streaming LLM
│   │   └── memory.service.js                # Estado conversacional
│   │
│   ├── tools/
│   │   ├── index.js                    # Tool registry
│   │   ├── project.tool.js             # Tools: read_project
│   │   ├── symbol.tool.js              # Tools: manage symbols
│   │   ├── requirement.tool.js         # Tools: manage requirements
│   │   ├── semantic.tool.js            # Tools: semantic queries
│   │   └── graph.tool.js               # Tools: graph operations
│   │
│   ├── prompts/
│   │   └── system.prompt.js            # System prompts del agente
│   │
│   ├── logger/
│   │   └── structured.logger.js        # Logging centralizado
│   │
│   └── embeddings.js                   # Embeddings (if enabled)
│
├── routes/                     # 🛣️ ENDPOINTS REST
│   ├── projects.js                 # CRUD proyectos (180+ líneas)
│   ├── symbols.js                  # CRUD símbolos (120+ líneas)
│   └── auth.js (opcional)          # JWT & OAuth
│
├── models/                     # 📊 ESQUEMAS MONGOOSE
│   ├── Project.js                  # Schema: proyecto completo
│   ├── Symbol.js                   # Schema: símbolo con relaciones
│   ├── Relation.js                 # Schema: relaciones entre entidades
│   ├── User.js (opcional)          # Schema: usuarios
│   ├── Message.js (opcional)       # Schema: mensajes chat
│   ├── Conversation.js (opcional)  # Schema: conversaciones
│   ├── Memory.js (opcional)        # Schema: memoria agente
│   └── AIActionLog.js (opcional)   # Schema: auditoría IA
│
├── middleware/                 # 🔐 MIDDLEWARES
│   └── auth.js (opcional)          # Validación JWT
│
├── index.js                    # ⚙️ ENTRY POINT
├── .env.example                # Vars de entorno template
└── package.json                # Dependencias
```

### Capas Backend

```
┌────────────────────────────────────────────────┐
│ CONTROLLERS (entry points)                     │
│ - ai.controller.js: POST /chat/stream         │
│ - recommendation.controller.js: POST /recom   │
└──────────────┬─────────────────────────────────┘
               │
┌──────────────▼─────────────────────────────────┐
│ SERVICES (business logic)                      │
│ - GraphSanityEngine: Validate & normalize      │
│ - ContextCompiler: Compress grafo              │
│ - UnifiedPlanner: Generate plan from LLM       │
│ - ContractEnforcer: Validate schemas           │
│ - ChatService: Stream LLM responses            │
└──────────────┬─────────────────────────────────┘
               │
┌──────────────▼─────────────────────────────────┐
│ ROUTES (REST endpoints)                        │
│ - projects.js: GET/POST/PUT/DELETE /projects  │
│ - symbols.js: GET/POST/PUT/DELETE /symbols    │
└──────────────┬─────────────────────────────────┘
               │
┌──────────────▼─────────────────────────────────┐
│ MODELS (Mongoose schemas + validation)         │
│ - Project, Symbol, Relation, etc.             │
└──────────────┬─────────────────────────────────┘
               │
┌──────────────▼─────────────────────────────────┐
│ DATABASE LAYER                                 │
│ - MongoDB (Atlas)                              │
│ - Queries via Mongoose                         │
└────────────────────────────────────────────────┘
```

### Módulos IA Críticos

| Módulo | Responsabilidad | Entrada | Salida |
|--------|-----------------|---------|--------|
| **GraphSanityEngine** | Normalizar + validar grafo | `{ nodes, relations }` | `{ nodes, edges, validation, stability }` |
| **ContextCompiler** | Comprimir 438→10-30 relaciones | `graph + goal` | `{ nodes, relations, summary }` |
| **UnifiedPlanner** | Generar plan JSON del LLM | `contextPack + goal` | `{ steps[], mode, metadata }` |
| **ContractEnforcer** | Validar esquema JSON | `plan JSON` | `{ valid, errors }` |
| **ChatService** | Stream respuestas LLM | `messages[]` | `stream` |

### Tools (funciones que LLM puede llamar)

```javascript
// backend/ai/tools/index.js
export const tools = [
  {
    name: 'read_project',
    description: 'Leer proyecto completo',
    fn: readProjectTool
  },
  {
    name: 'list_symbols',
    description: 'Listar símbolos',
    fn: listSymbolsTool
  },
  {
    name: 'create_symbol',
    description: 'Crear símbolo',
    fn: createSymbolTool
  },
  {
    name: 'query_graph',
    description: 'Consultar relaciones',
    fn: queryGraphTool
  },
  // ... más tools
];
```

### Routes Detalladas (projects.js)

```javascript
// CRUD Proyectos
GET    /api/projects                    // Listar todos
POST   /api/projects                    // Crear nuevo
GET    /api/projects/:projectId         // Obtener uno
PATCH  /api/projects/:projectId/about   // Actualizar "Acerca de"

// Seguridad
PATCH  /api/projects/:projectId/security    // Establecer código
DELETE /api/projects/:projectId              // Eliminar (requiere código)

// Import/Export
POST   /api/projects/import             // Importar JSON
GET    /api/projects/:projectId/export  // Exportar JSON

// Escenarios (CRUD)
POST   /api/projects/:projectId/scenarios
PUT    /api/projects/:projectId/scenarios/:scenarioId
DELETE /api/projects/:projectId/scenarios/:scenarioId

// Tareas (CRUD)
POST   /api/projects/:projectId/tasks
PUT    /api/projects/:projectId/tasks/:taskId
DELETE /api/projects/:projectId/tasks/:taskId

// Inspecciones (CRUD)
POST   /api/projects/:projectId/inspections
PUT    /api/projects/:projectId/inspections/:inspectionId
DELETE /api/projects/:projectId/inspections/:inspectionId

// Locks (para concurrencia)
PATCH  /api/projects/:projectId/locks  // Bloquear elemento

// Resolve Notes
POST   /api/projects/:projectId/resolve-notes
PUT    /api/projects/:projectId/resolve-notes/:noteId
```

---

## Analytics - Capas y Módulos

### Estructura Interna

```
analytics/
├── app.py                      # 🚀 FastAPI main
│
├── semantic/                   # 🧠 Análisis semántico
│   ├── __init__.py
│   ├── routes.py              # GET /semantic/:projectId
│   └── embeddings.py          # Cálculo embeddings
│
├── graph/                      # 📊 Análisis de grafos
│   ├── __init__.py
│   ├── routes.py              # POST /graph/analysis
│   └── algorithms.py          # DFS, BFS, etc.
│
├── monitoring/                 # 📈 Métricas & Health
│   ├── __init__.py
│   ├── routes.py              # GET /health, /metrics
│   └── logger.py              # Logging
│
├── agent/                      # 🤖 ETAPA 9 - Evaluación
│   ├── __init__.py
│   ├── routes.py              # POST /agent/tool-efficiency, etc.
│   ├── analyzer.py            # Clases analizadores
│   └── models.py              # Pydantic models
│
├── Dockerfile                  # Containerization
├── requirements.txt            # Dependencias Python
└── .env.example               # Template env vars
```

### Capas Analytics

```
┌────────────────────────────────┐
│ FastAPI Routes (app.py)        │
│ - /semantic/:projectId         │
│ - /graph/analysis              │
│ - /agent/tool-efficiency       │
│ - /health                      │
└──────────────┬─────────────────┘
               │
┌──────────────▼─────────────────┐
│ Service Layer                  │
│ - Semantic analysis            │
│ - Graph algorithms             │
│ - Agent evaluation             │
└──────────────┬─────────────────┘
               │
┌──────────────▼─────────────────┐
│ Data Layer                     │
│ - MongoDB (graphs)             │
│ - Redis (optional cache)       │
└────────────────────────────────┘
```

### Módulos Críticos

| Módulo | Función | Input | Output |
|--------|---------|-------|--------|
| **Semantic** | Calcular similitud entre entidades | 2 textos | Score 0-1 |
| **Graph** | Análisis de grafos | `{ nodes, edges }` | Métricas |
| **Monitoring** | Health checks | - | `{ status, uptime }` |
| **Agent (ETAPA 9)** | Evaluar performance agente | Tool logs | Scores, reportes |

---

## Responsabilidades por Carpeta

### `backend/routes/`

**Responsabilidad:** Definir endpoints REST y coordinar requests

**Lo que SÍ hace:**
- Validar entrada (básico)
- Parsear req.body, req.params
- Llamar servicios/models
- Retornar respuestas HTTP
- Emitir eventos Socket.io

**Lo que NO hace:**
- Lógica de negocio compleja (eso es services/)
- Queries MongoDB directas (eso es models/)
- Validación de esquemas complejos (eso es services/)

**Archivos principales:**
- `projects.js` — 680+ líneas, todo CRUD de proyectos
- `symbols.js` — CRUD de símbolos

---

### `backend/ai/`

**Responsabilidad:** Lógica IA, orquestación LLM, análisis inteligentes

**Subcarpetas:**

- `controllers/` — Entry points, coordinan request-response
- `services/` — Lógica de negocio pesada (graph analysis, planning)
- `tools/` — Funciones que el LLM puede invocar
- `prompts/` — Prompts del sistema
- `logger/` — Logging estructurado

**Archivos críticos:**
- `graph-sanity-engine.service.js` — Validación y normalización de grafos
- `context-compiler.js` — Compresión de contexto pre-LLM
- `unified-planner.service.js` — Generación de planes
- `planner-contract-enforcer.js` — Validación de contratos JSON

---

### `backend/models/`

**Responsabilidad:** Esquemas MongoDB + validaciones básicas

**Lo que SÍ hace:**
- Definir estructura de documentos
- Validaciones simples (required, type)
- Defaults
- Índices
- Métodos de instancia para acceso

**Lo que NO hace:**
- Lógica compleja de validación (eso es routes o services)
- Queries complejas (eso es services o routes)
- Transformaciones de datos (eso es services)

**Archivos:**
- `Project.js` — Proyecto top-level (100+ líneas)
- `Symbol.js` — Símbolo con relaciones
- `Relation.js` — Relación entre símbolos

---

### `frontend/pages/`

**Responsabilidad:** Componentes top-level de páginas

**Lo que SÍ hace:**
- Render JSX principal
- Gestionar state de página
- Orquestar sub-componentes
- Llamar api.js

**Lo que NO hace:**
- Lógica reutilizable (eso es components/)
- HTTP directo (eso es api.js)

**Archivos:**
- `Home.jsx` — Landing page (300+ líneas)
- `ProjectPage.jsx` — Editor principal (1000+ líneas)

---

### `frontend/components/`

**Responsabilidad:** Componentes reutilizables

**Lo que SÍ hace:**
- Render específico
- Gestionar state del componente
- Emitir callbacks a parent

**Lo que NO hace:**
- HTTP (eso es padre o api.js)
- Lógica de página (eso es pages/)

**Componentes:**
- `RelationMap.jsx` — Visualización del grafo
- `AIChat.jsx` — UI del chat
- `AuthContext.jsx` — Contexto autenticación

---

## Dependencias entre Módulos

### Gráfico de Dependencias

```
Frontend
  │
  └─ api.js (HTTP client)
     │
     └─ Backend (express routes)
        │
        ├─ Models (Mongoose)
        │  └─ MongoDB
        │
        ├─ Services (AI, Graph, etc.)
        │  └─ Analytics Service
        │     └─ Python FastAPI
        │
        └─ Socket.io
           └─ Frontend (bidireccional)
```

### Dependencias Críticas

**NUNCA ROMPER:**
- Frontend → Backend API (única vía HTTP)
- Backend Models → MongoDB (única persistencia)
- Respuesta Backend incluye siempre fields esperados

**Muy Sensibles:**
- GraphSanityEngine input format (debe ser `{ nodes, relations }`)
- ContextCompiler output (debe incluir `fromName, toName`)
- ContractEnforcer schemas (step types, tool params)

**Acoplamiento Aceptado:**
- ai.controller usa context-compiler
- context-compiler usa graph-sanity-engine
- routes usan models

---

## Rutas de Flujo de Datos

### Flujo 1: Crear Símbolo

```
1. Frontend (ProjectPage.jsx)
   form.onSubmit → handleCreateSymbol()
   
2. Llama api.js
   createSymbol(projectId, { name, type, ... })
   
3. HTTP Request
   POST /api/projects/:projectId/symbols
   
4. Backend (routes/symbols.js)
   router.post() handler
   ├─ Valida entrada
   ├─ Crea documento Symbol
   ├─ Emite "projectUpdated" vía Socket.io
   └─ Retorna { symbol }
   
5. Frontend (vía Socket.io)
   Escucha "projectUpdated"
   ├─ Refetch símbolos
   ├─ Actualiza state
   └─ Re-renderiza lista
```

### Flujo 2: Análisis IA

```
1. Frontend (ProjectPage.jsx)
   AIChat.onSubmit() con mensaje usuario
   
2. HTTP Stream
   POST /chat/stream
   
3. Backend (ai-controller.js)
   ├─ Carga proyecto + grafo
   ├─ GraphSanityEngine.run() → normaliza
   ├─ context-compiler() → reduce
   ├─ unified-planner() → genera plan
   ├─ contract-enforcer() → valida
   ├─ Ejecuta tools si necesario
   └─ Stream JSON lines response
   
4. Frontend
   Renderiza streaming text
```

### Flujo 3: Exportar Proyecto

```
1. Frontend
   handleExportProjectJson()
   
2. HTTP GET
   GET /api/projects/:projectId/export
   
3. Backend (routes/projects.js)
   router.get('/export') → recolecta:
   ├─ Project doc
   ├─ Símbolos asociados
   ├─ Relaciones
   ├─ Escenarios, tareas, inspecciones
   └─ Serializa a JSON
   
4. Frontend
   Descarga archivo .json
```

---

## Documentos Relacionados

- **[TECHNICAL_OVERVIEW.md](./TECHNICAL_OVERVIEW.md)** — Visión general del sistema
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — Patrones y DTOs detallados
- **[CHANGE_GUIDE.md](./CHANGE_GUIDE.md)** — Dónde modificar según tipo de cambio
- **[CONVENTIONS.md](./CONVENTIONS.md)** — Estándares de código

---

**Versión:** 1.0  
**Última revisión:** 2026-05-17
