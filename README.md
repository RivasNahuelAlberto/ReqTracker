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
