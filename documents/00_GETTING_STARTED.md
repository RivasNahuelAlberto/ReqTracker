# 🚀 ReqTracker - Getting Started for Developers

**Última actualización:** 2026-05-17

---

## ¿Qué es ReqTracker?

ReqTracker es una **plataforma agentic de ingeniería de requisitos y análisis arquitectónico** contenerizados en microservicios. Combina:

- **Gestión integral de requisitos** (CRUD de proyectos, símbolos, escenarios)
- **Análisis semántico asistido por IA** (comparación de entidades, RAG)
- **Grafo de dependencias estructural** (relaciones, impacto)
- **Chat contextual en tiempo real** con soporte Socket.io
- **Analytics y validación determinística** (quality engine, stability checks)

---

## Stack Tecnológico

| Capa | Tecnología | Ubicación |
|------|-----------|-----------|
| **Frontend** | React 18 + Vite + Bootstrap | `/frontend` |
| **Backend** | Node.js + Express + MongoDB | `/backend` |
| **Analytics** | Python FastAPI + Numpy/Pandas | `/analytics` |
| **Persistencia** | MongoDB Atlas | Remota |
| **Comunicación RT** | Socket.io | Backend/Frontend |
| **Infraestructura** | Docker + Docker Compose | `.`, `docker-compose.yml` |
| **Despliegue** | Render.com (auto-deploy) | `render.yaml` |

---

## Arquitectura General

```
┌─────────────────┐              ┌─────────────────┐
│    Frontend     │◄────────────►│    Backend      │
│  React + Vite   │   HTTP/REST  │ Node + Express  │
│  (puerto 5173)  │   Socket.io  │  (puerto 3000)  │
└─────────────────┘              └────────┬────────┘
                                          │
                      ┌───────────────────┤
                      │                   │
                  ┌───▼───────┐    ┌──────▼────────┐
                  │  MongoDB  │    │  Analytics    │
                  │   (Atlas) │    │  (FastAPI)    │
                  └───────────┘    │ (puerto 8000) │
                                   └───────────────┘
```

### Flujo de Datos Principal

1. **Usuario interactúa** con la UI (Frontend)
2. **Frontend** hace request HTTP a Backend API
3. **Backend** procesa lógica, interactúa con MongoDB
4. **Backend** puede consultar **Analytics Service** para análisis semántico
5. **Socket.io** sincroniza cambios en tiempo real entre clientes
6. **Response** vuelve al Frontend y se renderiza

---

## Inicio Rápido (Desarrollo Local)

### Requisitos
- Docker & Docker Compose
- Node.js 18+
- MongoDB (o usá Atlas cloud)

### Pasos

1. **Cloná el repo**
   ```bash
   git clone <repo-url>
   cd reqtracker
   ```

2. **Configurá variables de entorno**
   ```bash
   # Copiá .env.example a .env
   cp backend/.env.example backend/.env
   
   # Editá backend/.env con:
   MONGO_URI=mongodb://127.0.0.1:27017/reqtracker
   JWT_SECRET=tu_secreto_aqui
   ANALYTICS_URL=http://localhost:8000
   ```

3. **Levantá los servicios**
   ```bash
   docker-compose up --build
   ```
   - Frontend: http://localhost:5173
   - Backend: http://localhost:3000
   - Analytics: http://localhost:8000

4. **Accedé a la app**
   ```
   http://localhost:5173
   ```

---

## Estructura de Carpetas

```
reqtracker/
├── backend/                    # API Node.js + Express
│   ├── ai/                     # Módulos IA (controllers, services)
│   ├── models/                 # Esquemas MongoDB
│   ├── routes/                 # Rutas REST
│   ├── middleware/             # Auth, CORS, etc.
│   ├── index.js                # Entry point
│   └── .env.example            # Template variables
│
├── frontend/                   # UI React + Vite
│   ├── src/
│   │   ├── pages/              # Páginas (Home, ProjectPage)
│   │   ├── components/         # Componentes React
│   │   ├── api.js              # HTTP client
│   │   └── App.jsx             # Router
│   └── vite.config.js          # Config Vite
│
├── analytics/                  # Microservicio Python FastAPI
│   ├── app.py                  # Entry point
│   ├── semantic/               # Análisis semántico
│   ├── graph/                  # Análisis de grafos
│   ├── monitoring/             # Monitoreo
│   └── agent/                  # ETAPA 9: Evaluación de agentes
│
├── documents/                  # 📍 DOCUMENTACIÓN (nueva carpeta)
│   ├── 00_GETTING_STARTED.md   # ← Estás aquí
│   ├── TECHNICAL_OVERVIEW.md   # Visión general del sistema
│   ├── ARCHITECTURE.md         # Diseño arquit​ectónico detallado
│   ├── MODULES_AND_LAYERS.md   # Mapa estructural
│   └── development_guides/     # Procesos de desarrollo
│       └── (proyectos/iniciativas)
│
├── docker-compose.yml          # Orquestación servicios locales
├── render.yaml                 # Deploy a Render.com
└── README.md                   # Overview general (anterior)
```

---

## Rutas API Principales

### Proyectos
```
GET    /api/projects                    → Listar proyectos
POST   /api/projects                    → Crear nuevo proyecto
GET    /api/projects/:projectId         → Detalle de proyecto
POST   /api/projects/import             → Importar desde JSON
GET    /api/projects/:projectId/export  → Exportar a JSON
DELETE /api/projects/:projectId         → Eliminar proyecto
```

### Símbolos
```
GET    /api/projects/:projectId/symbols              → Listar símbolos
POST   /api/projects/:projectId/symbols              → Crear símbolo
PUT    /api/projects/:projectId/symbols/:symbolId    → Actualizar
DELETE /api/projects/:projectId/symbols/:symbolId    → Eliminar
```

### Escenarios
```
POST   /api/projects/:projectId/scenarios            → Crear escenario
PUT    /api/projects/:projectId/scenarios/:scenarioId → Actualizar
DELETE /api/projects/:projectId/scenarios/:scenarioId → Eliminar
```

### Real-time (Socket.io)
```
joinProject(projectId)    → Unirse a sala de proyecto
leaveProject(projectId)   → Salir de sala
projectUpdated            → Evento de actualización broadcast
```

---

## Conceptos Clave

### 1. **Proyecto**
Contenedor top-level. Agrupa símbolos, escenarios, requisitos, tareas e inspecciones.

**Modelo:** [backend/models/Project.js](../backend/models/Project.js)

### 2. **Símbolo**
Entidades del dominio (p.ej: Usuario, Cuenta, Transacción). Pueden tener relaciones padre-hijo.

**Modelo:** [backend/models/Symbol.js](../backend/models/Symbol.js)

### 3. **Escenario**
Casos de uso o flujos operativos. Describen contexto, actores, precondiciones, episodios.

**Almacenamiento:** Dentro del documento Project

### 4. **Relación**
Vínculo entre símbolos (dependencia funcional, semántica, técnica).

**Modelo:** [backend/models/Relation.js](../backend/models/Relation.js)

### 5. **Grafo de Dependencias**
Representación estructural del sistema. Base del análisis de impacto y estabilidad.

**Servicio:** `backend/ai/graph-sanity-engine.service.js`

---

## Workflow Típico de Uso

1. **Crear Proyecto** → Define seed symbols (entidades iniciales)
2. **Agregar Símbolos** → Refina el vocabulario del dominio
3. **Definir Escenarios** → Describes casos de uso
4. **Mapear Relaciones** → Conecta símbolos en grafo
5. **Usar Chat IA** → Pide análisis, calidad, impacto
6. **Exportar** → Descarga JSON para integración

---

## Próximos Pasos

- Lee [TECHNICAL_OVERVIEW.md](./TECHNICAL_OVERVIEW.md) para entender la arquitectura global
- Lee [ARCHITECTURE.md](./ARCHITECTURE.md) para diseño detallado
- Lee [MODULES_AND_LAYERS.md](./MODULES_AND_LAYERS.md) para mapa estructural
- Revisa [development_guides/](./development_guides/) para procesos de desarrollo específicos

---

## Convención de Documentación

**Toda documentación futura debe guardarse en `documents/`** siguiendo estructura:

```
documents/
├── TEMA_PRINCIPAL.md           # Documentos de referencia
├── development_guides/
│   └── proyecto-nombre/         # Cada proyecto tiene su carpeta
│       ├── IMPLEMENTATION_PLAN.md
│       ├── PROGRESS.md
│       ├── HANDOFF.md
│       └── NEXT_STEPS.md
```

---

## Contact & Support

Para dudas sobre:
- **Arquitectura:** Ver [TECHNICAL_OVERVIEW.md](./TECHNICAL_OVERVIEW.md)
- **Implementación:** Ver [MODULES_AND_LAYERS.md](./MODULES_AND_LAYERS.md)
- **Cambios específicos:** Ver [development_guides/](./development_guides/)

---

**Happy coding! 🚀**
