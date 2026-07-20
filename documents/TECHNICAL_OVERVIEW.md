# 📋 ReqTracker - Technical Overview

**Última actualización:** 2026-05-17  
**Autor/es:** Sistema de documentación automática

---

## Tabla de Contenidos

1. [Propósito General](#propósito-general)
2. [Arquitectura Global](#arquitectura-global)
3. [Subsistemas Principales](#subsistemas-principales)
4. [Responsabilidades](#responsabilidades-de-cada-capa)
5. [Relaciones entre Módulos](#relaciones-entre-módulos)
6. [Flujo de Datos](#flujo-de-datos-principal)
7. [Capas Arquitectónicas](#capas-arquitectónicas)
8. [Tecnologías Principales](#tecnologías-principales)
9. [Criterios Estructurales](#criterios-estructurales)

---

## Propósito General

ReqTracker es un **sistema agentic de ingeniería de requisitos** que:

- Permite **gestionar y especificar requisitos** en un modelo estructurado (proyectos → símbolos → escenarios → relaciones)
- Proporciona **análisis semántico asistido por IA** sobre entidades del dominio
- Construye un **grafo de dependencias** que relaciona requisitos, símbolos y cambios
- Ofrece **análisis de impacto determinísticos** basados en lógica estructural
- Implementa **validación de calidad** (ambigüedad, duplicados, inconsistencias, riesgos)
- Soporta **colaboración en tiempo real** mediante Socket.io
- Funciona como **plataforma agentic** para automatización y recomendaciones

### Valor Entregado

| Capacidad | Beneficio |
|-----------|-----------|
| **Gestión centralizada** | Un lugar único para especificación y seguimiento |
| **Análisis semántico** | Detección de similitudes más allá de keywords |
| **Relaciones estructurales** | Comprensión de dependencias funcionales |
| **Validación automática** | Detección de problemas antes de implementación |
| **Impacto análisis** | Predecir consecuencias de cambios |
| **Asistencia IA** | Recomendaciones contextuales inteligentes |

---

## Arquitectura Global

### Diagrama de Flujo

```
┌──────────────────────────────────────────────────────────────────┐
│                      USER INTERACTIONS                            │
└──────────────┬───────────────────────────────────────────────────┘
               │
         ┌─────▼──────┐
         │  Frontend  │ ← React 18 + Vite + Bootstrap
         │ (5173)     │   Responsable: UI/UX, formularios, visualización
         └─────┬──────┘
               │
    ┌──────────┴──────────┐
    │ HTTP/REST + Socket  │
    └──────────┬──────────┘
               │
         ┌─────▼──────┐
         │  Backend   │ ← Node.js + Express
         │ (3000)     │   Responsable: Lógica de negocio, persistencia
         └─────┬──────┘
               │
    ┌──────────┼──────────┐
    │          │          │
┌───▼────┐ ┌──▼────┐ ┌───▼────────┐
│ MongoDB│ │Socket.│ │ Analytics  │
│ (Data) │ │io     │ │ Service    │
└────────┘ └───────┘ │ (8000)     │
                     │ FastAPI+Py │
                     └────────────┘
                            │
                     ┌──────┴──────┐
                     │             │
                  ┌──▼───┐ ┌────────▼──┐
                  │Redis?│ │ MongoDB   │
                  │Cache │ │ (graphs)  │
                  └──────┘ └───────────┘
```

### Servicios

| Servicio | Puerto | Función | Tech |
|----------|--------|---------|------|
| **Frontend** | 5173 | UI estática, routing, formularios | React + Vite |
| **Backend** | 3000 | API REST, lógica, autenticación, persistencia | Node.js + Express |
| **Analytics** | 8000 | Análisis semántico, grafos, evaluación agentes | Python FastAPI |
| **MongoDB** | - | Persistencia de datos | MongoDB Atlas |
| **Socket.io** | 3000 | Comunicación RT bidireccional | Node.js |

---

## Subsistemas Principales

### 1. **Gestión de Proyectos y Entidades**

**Responsabilidad:** CRUD de proyectos, símbolos, escenarios, tareas, inspecciones.

**Ubicación:** `backend/routes/projects.js`, `backend/routes/symbols.js`

**Modelos MongoDB:**
- `Project` — Proyecto top-level
- `Symbol` — Entidades del dominio
- `Relation` — Relaciones entre símbolos

**Flujos principales:**
- Crear proyecto con seed symbols
- Agregar/editar/eliminar símbolos
- Definir escenarios (casos de uso)
- Mapear relaciones entre entidades

---

### 2. **Grafo de Dependencias y Análisis Estructural**

**Responsabilidad:** Normalizar, validar y analizar el grafo de relaciones.

**Ubicación:** `backend/ai/graph-sanity-engine.service.js`, `backend/ai/tools/relations.tool.js`

**Características:**
- Normalización de múltiples formatos de grafo
- Validación estructural (ciclos, nodos huérfanos, hubs)
- Análisis de estabilidad
- Detección de anomalías
- Traversal DFS/BFS

**Entrada:** `{ nodes: [...], relations: [...] }`  
**Salida:** `{ nodes: [...], edges: [...], validation, stability, traversal }`

---

### 3. **Context Compiler (Compresión Semántica)**

**Responsabilidad:** Reducir grafo completo a contexto relevante antes del LLM.

**Ubicación:** `backend/ai/context-compiler.js`

**Estrategia:**
- Scoring de nodos por relevancia semántica + centralidad estructural
- Selección top-K por score
- Construcción de subgrafo
- Generación de resumen y confidence map

**Entrada:** 438 relaciones + goal  
**Salida:** 10-30 nodos relevantes + resumen

---

### 4. **AI Orchestration (Planner + Tools)**

**Responsabilidad:** Coordinación de LLM, validación de contracts, ejecución de tools.

**Ubicación:** `backend/ai/unified-planner.service.js`, `backend/ai/planner-contract-enforcer.js`

**Componentes:**
- **Unified Planner:** Genera plan operativo del LLM
- **Contract Enforcer:** Valida esquema JSON contra contracts
- **Tool Router:** Ejecuta tools (create, read, update relaciones, etc.)

**Contratos:** Cada tool tiene schema de validación estricto

---

### 5. **Analytics Service (Python FastAPI)**

**Responsabilidad:** Análisis semántico distribuido, embeddings, evaluación de agentes.

**Ubicación:** `analytics/app.py`, `analytics/semantic/`, `analytics/agent/`

**Módulos principales:**
- **Semantic:** Comparación de entidades (embeddings, similitud)
- **Graph:** Análisis de grafos, detección de patrones
- **Monitoring:** Métricas, alertas, health checks
- **Agent:** ETAPA 9 - Evaluación de performance de agentes

**Protocolo:** REST API + JSON

---

### 6. **Communication & Sync (Socket.io)**

**Responsabilidad:** Sincronización RT entre múltiples clientes.

**Ubicación:** `backend/index.js` (setup Socket.io)

**Eventos:**
- `joinProject(projectId)` — Cliente se suscribe a sala
- `leaveProject(projectId)` — Cliente se desuscribe
- `projectUpdated` — Broadcast cuando proyecto cambia
- `lockUpdated` — Broadcast cuando locks cambian

**Uso:** UI actualiza en RT cuando otro usuario modifica proyecto

---

## Responsabilidades de Cada Capa

### Frontend

**Archivos principales:**
- `frontend/src/pages/Home.jsx` — Landing page, creación de proyectos
- `frontend/src/pages/ProjectPage.jsx` — Editor principal del proyecto
- `frontend/src/components/` — Componentes reutilizables
- `frontend/src/api.js` — HTTP client centralizado

**Responsabilidades:**
- Renderizar UI según estado
- Capturar interacciones del usuario
- Hacer requests HTTP al backend
- Actualizar estado local
- Escuchar eventos Socket.io
- Validación básica de forms

**NO debe hacer:**
- Lógica de negocio compleja
- Acceso directo a BD
- Decisiones de validación críticas
- Gestión de autenticación de bajo nivel

---

### Backend

**Archivos principales:**
- `backend/index.js` — Entry point, setup express + socket.io
- `backend/routes/projects.js` — Rutas CRUD proyectos/escenarios/tareas
- `backend/routes/symbols.js` — Rutas CRUD símbolos
- `backend/ai/` — Módulos IA (controllers, services, tools)
- `backend/models/` — Esquemas MongoDB

**Responsabilidades:**
- Validar requests HTTP
- Aplicar lógica de negocio
- Persistir datos en MongoDB
- Consultar Analytics Service
- Coordinar orquestación IA
- Broadcast eventos Socket.io
- Aplicar seguridad (auth, permisos)

**Responsabilidades específicas por carpeta:**

| Carpeta | Responsabilidad |
|---------|-----------------|
| `routes/` | Endpoints REST, validación entrada, coordinación |
| `models/` | Esquemas MongoDB, defaults, validaciones básicas |
| `ai/` | Lógica IA (context compiler, planner, tools, graph analysis) |
| `middleware/` | Auth, logging, CORS, error handling |

---

### Analytics Service

**Archivos principales:**
- `analytics/app.py` — FastAPI main, setup routes
- `analytics/semantic/` — Embeddings, similaridad semántica
- `analytics/graph/` — Análisis de grafos
- `analytics/agent/` — ETAPA 9, evaluación de agentes

**Responsabilidades:**
- Análisis semántico entre entidades
- Cálculo de embeddings
- Análisis de grafos (densidad, clustering, etc.)
- Evaluación de performance de agentes
- Detección de patrones
- Health checks

**NO debe hacer:**
- CRUD de proyectos (eso es backend)
- Autenticación (delegada a backend)
- Persistencia de estado operativo (eso es backend)

---

## Relaciones entre Módulos

### Flujo de Request Típico (Chat IA)

```
1. Frontend (ProjectPage.jsx)
   ↓ POST /chat/stream con mensajeUsuario
   
2. Backend (ai-controller.js)
   ├─ Extrae contexto del proyecto
   ├─ Llama GraphSanityEngine.run()
   │  └─ Normaliza y valida grafo
   │
   ├─ Llama context-compiler.compileContext()
   │  └─ Reduce grafo a subconjunto relevante
   │
   ├─ Llama unified-planner.plan()
   │  └─ Genera plan JSON del LLM
   │
   ├─ Llama planner-contract-enforcer.validate()
   │  └─ Valida esquema JSON
   │
   ├─ Si modo = EXECUTE: Ejecuta tools del plan
   │  └─ Interactúa con BD, Analytics Service, etc.
   │
   └─ Retorna response stream al frontend
   
3. Frontend
   └─ Renderiza respuesta
```

### Dependencias Críticas

```
CRÍTICA:
  Frontend ──HTTP──> Backend (única manera de comunicarse)
  Backend ──MongoDB→ Persistencia
  Backend ──REST──> Analytics (análisis semántico)
  Backend ←─Socket.io→ Frontend (sync RT)

IMPORTANTE:
  AI Controller ──> Graph Sanity Engine (normalización)
  Context Compiler ──> Unified Planner (IA)
  Planner Contract ──> Tool Router (ejecución)

ACOPLAMIENTO:
  GraphSanityEngine ← relaciones.tool.js (obtengo grafo)
  ContextCompiler ← graph normalizado (necesito formato correcto)
```

---

## Flujo de Datos Principal

### 1. Cargar Proyecto

```
Frontend: GET /api/projects/:projectId
   ↓
Backend: 
  - Fetch Project from MongoDB
  - Fetch Symbols from MongoDB
  - Fetch Relations from MongoDB (con resolveNode lookups)
  - Retorna: { project, symbols, relations }
   ↓
Frontend:
  - Carga proyecto en estado
  - Renderiza tabs (documentos, símbolos, mapa, escenarios, etc.)
```

### 2. Usuario Crea Símbolo

```
Frontend: POST /api/projects/:projectId/symbols
   │ body: { name, type, parentSymbol, isSeed, order }
   ↓
Backend:
  - Valida nombre único para tipo
  - Crea documento Symbol en MongoDB
  - Agrega ID a Project.symbols
  - Broadcast "projectUpdated" vía Socket.io
   ↓
Frontend (vía Socket.io):
  - Recibe projectUpdated event
  - Re-fetch símbolos
  - Renderiza lista actualizada
```

### 3. Usuario Pide Análisis IA

```
Frontend: POST /chat/stream
   │ body: { projectId, messages[], goal }
   ↓
Backend (AI Controller):
  1. getProjectSnapshot() + getProjectGraph()
  2. GraphSanityEngine.run() - Normaliza + Valida grafo
  3. context-compiler.compileContext() - Reduce a 10-30 nodos
  4. unified-planner.plan() - LLM genera plan JSON
  5. planner-contract-enforcer.validate() - Valida esquema
  6. Si EXECUTE: router.executeTools() - Ejecuta tools del plan
  7. Stream response al frontend
   ↓
Frontend:
  - Renderiza streaming response en chat
```

---

## Capas Arquitectónicas

```
┌─────────────────────────────────────────────┐
│  PRESENTATION (Frontend)                    │
│  React Components, Pages, UI State          │
└──────────────┬──────────────────────────────┘
               │ HTTP/REST + Socket.io
┌──────────────▼──────────────────────────────┐
│  API Gateway / Controllers (Backend)         │
│  - ai-controller.js (orchestration)          │
│  - routes/ (REST endpoints)                  │
│  - middleware/ (auth, cors, logging)         │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│  BUSINESS LOGIC / SERVICE LAYER             │
│  - GraphSanityEngine (validation)            │
│  - ContextCompiler (compression)             │
│  - UnifiedPlanner (orchestration)            │
│  - ToolRouter (execution)                    │
│  - Recommendation engine                     │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│  DATA ACCESS LAYER                          │
│  - Models (Mongoose schemas)                 │
│  - queries (find, update, etc.)              │
│  - graph.tool.js (graph resolution)          │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│  PERSISTENCE & EXTERNAL                     │
│  - MongoDB (projects, symbols, relations)   │
│  - Analytics Service (semantic analysis)    │
│  - Redis (optional cache)                   │
└──────────────────────────────────────────────┘
```

---

## Tecnologías Principales

### Backend
- **Runtime:** Node.js 18+
- **Web Framework:** Express.js
- **Database:** MongoDB + Mongoose ODM
- **Real-time:** Socket.io
- **Authentication:** JWT + Google OAuth
- **LLM:** OpenAI API + OpenRouter API
- **Environment:** dotenv

### Frontend
- **Framework:** React 18
- **Build Tool:** Vite
- **CSS:** Bootstrap 5
- **HTTP Client:** axios
- **Real-time:** Socket.io client
- **Routing:** React Router v6

### Analytics
- **Framework:** FastAPI (Python 3.8+)
- **Data:** Pandas, NumPy
- **ML:** scikit-learn (embeddings, similarity)
- **Cache:** Redis (optional)
- **Async:** asyncio
- **Logging:** Python logging + structured

### Infrastructure
- **Containerization:** Docker
- **Orchestration:** Docker Compose
- **Deployment:** Render.com
- **CI/CD:** Auto-deploy on push to main

---

## Criterios Estructurales

### 1. **Separación de Responsabilidades**
- Cada módulo hace UNA cosa bien
- Las rutas orquestan, no contienen lógica
- Los servicios contienen lógica de negocio
- Los modelos definen estructura, no comportamiento

### 2. **Comunicación Entre Capas**
- Frontend ↔ Backend: HTTP REST + Socket.io (única forma)
- Backend ↔ Analytics: HTTP REST
- Backend ↔ DB: Mongoose queries
- **Nunca:** Frontend accede directamente BD o Analytics

### 3. **Validación**
- **Entrada:** Backend valida TODAS las requests
- **Salida:** Backend valida TODAS las respuestas a Analytics
- **Contracts:** Planner contract enforcer valida planes IA

### 4. **Error Handling**
- Backend retorna errores con `{ message, details, code }`
- Frontend maneja errores gracefully
- Logging centralizado en Backend

### 5. **Async Patterns**
- Frontend: async/await + try/catch
- Backend: async/await + try/catch
- Socket.io: event-driven callbacks

---

## Documentos Relacionados

- **[MODULES_AND_LAYERS.md](./MODULES_AND_LAYERS.md)** — Mapa estructural detallado de carpetas y módulos
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — Patrones arquitectónicos, DTOs, flujos críticos
- **[CHANGE_GUIDE.md](./CHANGE_GUIDE.md)** — Dónde modificar para cada tipo de cambio
- **[development_guides/](./development_guides/)** — Procesos específicos por feature/refactor

---

**Versión:** 1.0  
**Última revisión:** 2026-05-17
