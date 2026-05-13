# ReqTracker

App para especificación y seguimiento de análisis de requisitos.

## Arquitectura

- Frontend: React + Vite + Bootstrap
- Backend: Node + Express + MongoDB
- Persistencia: MongoDB (conexión configurable en `.env`)

## Ejecución local

1. Copia `.env.example` a `backend/.env` y configura `MONGO_URI`.
2. Instala dependencias:
   - `npm run install-all`
3. Arranca backend y frontend:
   - `npm run dev`
4. Abre `http://localhost:5173`

## Rutas principales

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:projectId`
- `GET /api/projects/:projectId/symbols`
- `POST /api/projects/:projectId/symbols`
- `PUT /api/projects/:projectId/symbols/:symbolId`
- `DELETE /api/projects/:projectId/symbols/:symbolId`

## Docker y Analytics

1. Crea `backend/.env` a partir de `backend/.env.example`.
2. Levanta la arquitectura con:
   - `docker compose up --build`
3. Servicios disponibles:
   - Frontend: `http://localhost:5173`
   - Backend: `http://localhost:3000`
   - Analytics: `http://localhost:8000`
   - MongoDB: `mongodb://localhost:27017`
4. El backend ya puede enrutar llamadas de analytics a `/api/analytics/compare-entities`.
5. Para implementar el análisis semántico, completa `analytics/app.py` y agrega modelos/servicios en `analytics/`.
