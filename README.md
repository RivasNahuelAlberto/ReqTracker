# ReqTracker

Aplicación web para la especificación y seguimiento de análisis de requisitos de software. Permite gestionar proyectos, definir símbolos/entidades del dominio y realizar comparaciones semánticas entre ellos asistidas por inteligencia artificial.

---

## Arquitectura

ReqTracker está compuesto por tres servicios independientes desplegados en [Render](https://render.com), todos contenerizados con Docker:

```
┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
│    Frontend     │──────▶ │    Backend      │──────▶ │    Analytics    │
│  React + Vite   │        │ Node + Express  │        │     Python      │
│  Static Site    │        │   Web Service   │        │   Web Service   │
└─────────────────┘        └────────┬────────┘        └─────────────────┘
                                    │
                           ┌────────▼────────┐
                           │    MongoDB      │
                           │  (Atlas / ext.) │
                           └─────────────────┘
```

### Servicios

**Frontend** — React + Vite + Bootstrap
Interfaz de usuario servida como sitio estático. Se comunica exclusivamente con el backend a través de la variable `VITE_API_BASE`.

**Backend** — Node.js + Express
API REST principal. Gestiona autenticación, lógica de negocio, persistencia en MongoDB y actúa como gateway hacia el servicio de analytics. Soporta autenticación con JWT y Google OAuth.

**Analytics** — Python (Web Service)
Microservicio independiente encargado del análisis semántico entre entidades/símbolos del dominio. El backend lo consume a través de la ruta `/api/analytics/compare-entities`. Opcionalmente soporta Redis como caché o cola de tareas.

### Persistencia externa

- **MongoDB** — Base de datos principal (recomendado: MongoDB Atlas en producción).
- **Redis** *(opcional)* — Caché para el servicio de analytics (recomendado: Redis gestionado en producción).

---

## Features

### Gestión de proyectos y requisitos
- Creación, edición y eliminación de proyectos.
- Gestión de símbolos/entidades del dominio por proyecto (CRUD completo).
- Organización y seguimiento del análisis de requisitos por proyecto.

### Autenticación y seguridad
- Autenticación con JWT (registro e inicio de sesión).
- Login con Google OAuth.
- CORS configurado por entorno mediante `FRONTEND_ORIGIN`.

### Analytics e inteligencia artificial
- Comparación semántica entre entidades del dominio a través del microservicio de analytics.
- Integración con **OpenAI** (`gpt-4o-mini` por defecto) y **OpenRouter** como proveedor alternativo de LLMs.

### Infraestructura y despliegue
- Arquitectura de microservicios contenerizada con Docker.
- `docker-compose.yml` para desarrollo y pruebas locales.
- `render.yaml` para definición de infraestructura como código en Render.
- Auto-deploy activado en Render al hacer push a `main`.

---

## Ejecución local

1. Copiá `backend/.env.example` a `backend/.env` y completá las variables necesarias (ver sección siguiente).
2. Levantá todos los servicios con Docker Compose:
   ```bash
   docker compose up --build
   ```
3. Accedé a los servicios:
   - Frontend: `http://localhost:5173`
   - Backend: `http://localhost:3000`
   - Analytics: `http://localhost:8000`

---

## Variables de entorno

### Backend (`backend/.env`)

| Variable | Descripción |
|---|---|
| `MONGO_URI` | URI de conexión a MongoDB |
| `JWT_SECRET` | Clave secreta para firmar tokens JWT |
| `BASE_URL` | URL pública del backend |
| `FRONTEND_URL` | URL pública del frontend |
| `FRONTEND_ORIGIN` | Origen permitido para CORS |
| `ANALYTICS_URL` | URL del servicio de analytics |
| `OPENAI_API_KEY` | Clave de API de OpenAI *(opcional)* |
| `OPENAI_MODEL` | Modelo a usar, ej. `gpt-4o-mini` *(opcional)* |
| `OPENROUTER_API_KEY` | Clave de API de OpenRouter *(opcional)* |
| `OPENROUTER_MODEL` | Modelo a usar vía OpenRouter *(opcional)* |
| `OPENROUTER_API_BASE_URL` | URL base de OpenRouter |
| `OPENROUTER_REFERER` | Referer para OpenRouter |

### Frontend

| Variable | Descripción |
|---|---|
| `VITE_API_BASE` | URL pública del backend (sin `/api`) |

### Analytics

| Variable | Descripción |
|---|---|
| `REDIS_URL` | URL de Redis *(opcional)* |
| `PYTHONUNBUFFERED` | Recomendado: `1` |

---

## API — Rutas principales

### Proyectos
- `GET /api/projects` — Listar proyectos
- `POST /api/projects` — Crear proyecto
- `GET /api/projects/:projectId` — Detalle de un proyecto

### Símbolos
- `GET /api/projects/:projectId/symbols` — Listar símbolos
- `POST /api/projects/:projectId/symbols` — Crear símbolo
- `PUT /api/projects/:projectId/symbols/:symbolId` — Actualizar símbolo
- `DELETE /api/projects/:projectId/symbols/:symbolId` — Eliminar símbolo

### Analytics
- `POST /api/analytics/compare-entities` — Comparación semántica entre entidades

### Auth
- `POST /api/auth/...` — Registro / login JWT
- `GET /api/auth/google/callback` — Callback de Google OAuth