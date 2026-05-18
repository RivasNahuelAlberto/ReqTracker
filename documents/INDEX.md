# 📚 ReqTracker Documentation Index

**Última actualización:** 2026-05-17

> **Punto de entrada para toda la documentación técnica de ReqTracker**

---

## Quick Navigation

### 🚀 Para Comenzar Rápido
- **[00_GETTING_STARTED.md](./00_GETTING_STARTED.md)** — Setup local, conceptos clave, flujo típico

### 📖 Documentación General (Lee en este orden)
1. **[TECHNICAL_OVERVIEW.md](./TECHNICAL_OVERVIEW.md)** — Visión general del sistema, arquitectura, subsistemas
2. **[MODULES_AND_LAYERS.md](./MODULES_AND_LAYERS.md)** — Estructura carpetas, responsabilidades, flujos de datos
3. **[CHANGE_GUIDE.md](./CHANGE_GUIDE.md)** — Dónde modificar según tipo de cambio

### 🏗️ Arquitectura Detallada
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — Patrones, DTOs, flujos críticos
- **[CONVENTIONS.md](./CONVENTIONS.md)** — Estándares de código, naming, patterns

### 🛠️ Procesos de Desarrollo
- **[development_guides/](./development_guides/)** — Carpetas de proyectos/iniciativas específicas

---

## Tabla Completa de Contenidos

### 1️⃣ Onboarding & Overview

| Documento | Propósito | Para Quién |
|-----------|-----------|-----------|
| [00_GETTING_STARTED.md](./00_GETTING_STARTED.md) | Setup local + conceptos fundamentales | Todos (punto de entrada) |
| [TECHNICAL_OVERVIEW.md](./TECHNICAL_OVERVIEW.md) | Visión holística del sistema | Arquitectos, tech leads |
| [MODULES_AND_LAYERS.md](./MODULES_AND_LAYERS.md) | Mapa estructural + responsabilidades | Developers, architects |

### 2️⃣ Guías Operativas

| Documento | Propósito | Para Quién |
|-----------|-----------|-----------|
| [CHANGE_GUIDE.md](./CHANGE_GUIDE.md) | Dónde intervenir según tipo de cambio | Todos (referencia rápida) |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Patrones arquitectónicos detallados | Backend/Frontend devs |
| [CONVENTIONS.md](./CONVENTIONS.md) | Estándares de código y naming | Todos (consistency) |

### 3️⃣ Procesos de Desarrollo

Cada proyecto/iniciativa tiene su carpeta en `development_guides/` con 4 documentos:

| Documento | Propósito |
|-----------|-----------|
| `IMPLEMENTATION_PLAN.md` | Documento rector: objetivo, alcance, diseño, checklist |
| `PROGRESS.md` | Historial de avance, tareas completadas, problemas |
| `HANDOFF.md` | Transferencia de contexto entre developers/agentes |
| `NEXT_STEPS.md` | Roadmap de próximas tareas |

**Ejemplo de estructura:**
```
documents/development_guides/
├── graph-sanity-engine-fixes/
│   ├── IMPLEMENTATION_PLAN.md
│   ├── PROGRESS.md
│   ├── HANDOFF.md
│   └── NEXT_STEPS.md
├── etapa-9-agent-analytics/
│   ├── IMPLEMENTATION_PLAN.md
│   ├── PROGRESS.md
│   ├── HANDOFF.md
│   └── NEXT_STEPS.md
└── TEMPLATE_IMPLEMENTATION_PLAN.md   ← Copiar esto para nuevos proyectos
```

---

## Flujo de Lectura Recomendado (por rol)

### 👨‍💼 Tech Lead / Architect
1. [TECHNICAL_OVERVIEW.md](./TECHNICAL_OVERVIEW.md) — Entender visión
2. [MODULES_AND_LAYERS.md](./MODULES_AND_LAYERS.md) — Entender estructura
3. `development_guides/*/IMPLEMENTATION_PLAN.md` — Revisar proyectos en curso

### 👨‍💻 Backend Developer
1. [00_GETTING_STARTED.md](./00_GETTING_STARTED.md) — Setup
2. [MODULES_AND_LAYERS.md](./MODULES_AND_LAYERS.md) — Backend section
3. [CHANGE_GUIDE.md](./CHANGE_GUIDE.md) — Dónde modificar
4. [CONVENTIONS.md](./CONVENTIONS.md) — Estándares

### 👩‍💻 Frontend Developer
1. [00_GETTING_STARTED.md](./00_GETTING_STARTED.md) — Setup
2. [MODULES_AND_LAYERS.md](./MODULES_AND_LAYERS.md) — Frontend section
3. [CHANGE_GUIDE.md](./CHANGE_GUIDE.md) — Dónde modificar
4. [CONVENTIONS.md](./CONVENTIONS.md) — Estándares

### 🤖 IA Agent / Automated Process
1. [TECHNICAL_OVERVIEW.md](./TECHNICAL_OVERVIEW.md) — Context completo
2. [MODULES_AND_LAYERS.md](./MODULES_AND_LAYERS.md) — Estructura
3. `development_guides/*/IMPLEMENTATION_PLAN.md` — Proyecto específico
4. `development_guides/*/PROGRESS.md` — Avance real

### 🆕 Nuevo Developer/Agent Retomando Tarea
1. **Find your project:** `development_guides/mi-proyecto/`
2. **Read HANDOFF.md** — Entiende estado actual
3. **Read PROGRESS.md** — Ve qué se hizo
4. **Check NEXT_STEPS.md** — Sabés qué hacer
5. **Reference IMPLEMENTATION_PLAN.md** — Para contexto/decisiones

---

## Cómo Buscar "¿Dónde debo modificar X?"

### Problema: "Necesito agregar nueva funcionalidad"
→ [CHANGE_GUIDE.md > Funcionalidad de Negocio](./CHANGE_GUIDE.md#funcionalidad-de-negocio)

### Problema: "Necesito cambiar la UI"
→ [CHANGE_GUIDE.md > UI/UX y Componentes](./CHANGE_GUIDE.md#uiux-y-componentes)

### Problema: "Necesito agregar endpoint API"
→ [CHANGE_GUIDE.md > APIs e Integraciones](./CHANGE_GUIDE.md#apis-e-integraciones)

### Problema: "¿Qué archivos son críticos?"
→ [TECHNICAL_OVERVIEW.md > Dependencias Críticas](./TECHNICAL_OVERVIEW.md#dependencias-críticas)

### Problema: "¿Cómo funciona el flujo de X?"
→ [MODULES_AND_LAYERS.md > Rutas de Flujo](./MODULES_AND_LAYERS.md#rutas-de-flujo-de-datos)

### Problema: "¿Qué hace el módulo Y?"
→ [MODULES_AND_LAYERS.md > Responsabilidades](./MODULES_AND_LAYERS.md#responsabilidades-por-carpeta)

---

## Referencias por Tecnología

### Frontend (React + Vite + Bootstrap)
- [00_GETTING_STARTED.md](./00_GETTING_STARTED.md) — Setup
- [MODULES_AND_LAYERS.md > Frontend](./MODULES_AND_LAYERS.md#frontend---capas-y-módulos)
- [CHANGE_GUIDE.md > UI/UX](./CHANGE_GUIDE.md#uiux-y-componentes)

### Backend (Node.js + Express + Mongoose)
- [00_GETTING_STARTED.md](./00_GETTING_STARTED.md) — Setup
- [MODULES_AND_LAYERS.md > Backend](./MODULES_AND_LAYERS.md#backend---capas-y-módulos)
- [CHANGE_GUIDE.md > APIs](./CHANGE_GUIDE.md#apis-e-integraciones)
- [CHANGE_GUIDE.md > Persistencia](./CHANGE_GUIDE.md#persistencia)

### Analytics (Python FastAPI)
- [MODULES_AND_LAYERS.md > Analytics](./MODULES_AND_LAYERS.md#analytics---capas-y-módulos)
- [CHANGE_GUIDE.md > Integraciones](./CHANGE_GUIDE.md#integrar-con-analytics-service)

### MongoDB
- [CHANGE_GUIDE.md > Persistencia](./CHANGE_GUIDE.md#persistencia)
- [MODULES_AND_LAYERS.md > Models](./MODULES_AND_LAYERS.md#backend---capas-y-módulos)

### Socket.io (Real-time)
- [CHANGE_GUIDE.md > Comunicación](./CHANGE_GUIDE.md#estado-y-comunicación)
- [TECHNICAL_OVERVIEW.md > Communication](./TECHNICAL_OVERVIEW.md#6-communication--sync-socketio)

---

## Topics por Categoría

### 🚀 Deployment & Infrastructure
- [00_GETTING_STARTED.md > Quick Start](./00_GETTING_STARTED.md#inicio-rápido-desarrollo-local)
- Documentos de deployment (en producción)

### 🔒 Security & Permissions
- [CHANGE_GUIDE.md > Seguridad](./CHANGE_GUIDE.md#seguridad)
- [CONVENTIONS.md](./CONVENTIONS.md) (si existe, ver sección Auth)

### ⚡ Performance & Optimization
- [CHANGE_GUIDE.md > Performance](./CHANGE_GUIDE.md#performance)

### 🧪 Testing
- [CHANGE_GUIDE.md > Testing](./CHANGE_GUIDE.md#testing)

### 📊 Monitoring & Debugging
- [TECHNICAL_OVERVIEW.md > Analytics Service](./TECHNICAL_OVERVIEW.md#5-analytics-service-python-fastapi)

---

## 🔌 Developer Tools & MCP Integration

### MCP (Model Context Protocol) en VS Code
**Para debugging semi-autónomo con agentes IA + observabilidad de Render**

- **[technology/mcp-vscode-integration.md](./technology/mcp-vscode-integration.md)** — Guía completa
  - Setup en VS Code (Continue + Cline)
  - Integración con Render MCP
  - Casos de uso reales (OAuth, MongoDB, Deploy)
  - Flujos de debugging automático
  - Seguridad y mejores prácticas
  - Troubleshooting

**Configuración:**
- `.continue/config.json` — Template de configuración Continue
- `.cline/config.json` — Template de configuración Cline  
- `.env.example` — Variables de entorno necesarias

**Referencia rápida:**
```bash
# Leer logs del backend
@render logs --service backend --error --lines 50

# Ver estado de servicios
@render health --all-services

# Ver deploys recientes
@render deploys --service backend --limit 5
```

---

## Convención de Documentación

**Importante:** Todos los documentos de desarrollo futuro deben seguir la estructura:

```
documents/development_guides/
└── nombre-iniciativa/
    ├── IMPLEMENTATION_PLAN.md   (Rector: objetivo, diseño, checklist)
    ├── PROGRESS.md              (Historial: qué se hizo, problemas)
    ├── HANDOFF.md               (Transferencia: estado actual, bloqueos)
    └── NEXT_STEPS.md            (Roadmap: próximas tareas)
```

### Cuando crear una nueva iniciativa:
1. Creá carpeta: `documents/development_guides/tu-iniciativa/`
2. Copiá template: `TEMPLATE_IMPLEMENTATION_PLAN.md` → `IMPLEMENTATION_PLAN.md`
3. Completá el plan
4. Creá los otros 3 archivos (PROGRESS, HANDOFF, NEXT_STEPS)
5. Linkealos en este INDEX

---

## Mapa de Responsabilidades

**Los siguientes documentos deben mantenerse actualizados si:**

| Cambio | Documentar en |
|--------|---------------|
| Agregás nuevo endpoint | [MODULES_AND_LAYERS.md](./MODULES_AND_LAYERS.md) + [CHANGE_GUIDE.md](./CHANGE_GUIDE.md) |
| Modificás arquitectura | [TECHNICAL_OVERVIEW.md](./TECHNICAL_OVERVIEW.md) + [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Agregás nueva carpeta/módulo | [MODULES_AND_LAYERS.md](./MODULES_AND_LAYERS.md) |
| Cambiás patrones/convenciones | [CONVENTIONS.md](./CONVENTIONS.md) |
| Iniciás proyecto/feature | Nuevo carpeta en `development_guides/` |

---

## Documentos Pendientes / Future Work

- [ ] **CONVENTIONS.md** — Estándares de código, naming, patterns
- [ ] **ARCHITECTURE.md** (expanded) — Patrones detallados, DTOs, flujos críticos
- [ ] **TECH_DEBT.md** — Issues técnicos conocidos, deuda, mejoras futuras
- [ ] **TROUBLESHOOTING.md** — Common issues y soluciones
- [ ] **DEPLOYMENT.md** — Steps para deployment a producción

---

## Historial de Versiones

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 1.0 | 2026-05-17 | Documentación inicial completa |

---

## Quick Links (Atajos)

- 📁 **Carpeta documentación:** `/documents/`
- 📝 **Procesos de desarrollo:** `/documents/development_guides/`
- 📖 **README del proyecto:** `/README.md`
- 🔧 **Backend entrypoint:** `/backend/index.js`
- 🎨 **Frontend entrypoint:** `/frontend/src/main.jsx`
- 🚀 **Analytics entrypoint:** `/analytics/app.py`

---

## Cómo Contribuir a la Documentación

1. **Cuando agreques feature:** Documentá dónde cambió en [CHANGE_GUIDE.md](./CHANGE_GUIDE.md)
2. **Cuando agregues proyecto:** Creá carpeta en `development_guides/` con 4 docs
3. **Cuando encuentres deuda técnica:** Documentá en `TECH_DEBT.md` (futuro)
4. **Cuando descubras issue:** Documentá en `TROUBLESHOOTING.md` (futuro)

---

**Última revisión:** 2026-05-17  
**Responsable de actualización:** Sistema de documentación
