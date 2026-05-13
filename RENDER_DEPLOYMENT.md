# Despliegue en Render

Este repositorio ya tiene la estructura necesaria para desplegar los servicios en Render como microservicios separados.

## Servicios recomendados

1. **Frontend**
   - Nombre sugerido: `reqtracker-frontend`
   - Tipo: `Web Service`
   - Entorno: `Docker`
   - Dockerfile: `frontend/Dockerfile`
   - Puerto: `5173`
   - Variable de entorno: `VITE_API_BASE=https://<backend-url>`

2. **Backend**
   - Nombre sugerido: `reqtracker-backend`
   - Tipo: `Web Service`
   - Entorno: `Docker`
   - Dockerfile: `backend/Dockerfile`
   - Puerto: `3000`
   - Variables de entorno necesarias:
     - `MONGO_URI`
     - `JWT_SECRET`
     - `BASE_URL=https://<backend-url>`
     - `FRONTEND_URL=https://<frontend-url>`
     - `ANALYTICS_URL=https://<analytics-url>`
     - `OPENAI_API_KEY` (si usas OpenAI)
     - `OPENAI_MODEL` (opcional)
     - `OPENROUTER_API_KEY` (si usas OpenRouter)
     - `OPENROUTER_MODEL` (opcional)
     - `OPENROUTER_API_BASE_URL`
     - `OPENROUTER_REFERER`
     - `FRONTEND_ORIGIN=https://<frontend-url>` (recomendado)

3. **Analytics**
   - Nombre sugerido: `reqtracker-analytics`
   - Tipo: `Web Service`
   - Entorno: `Docker`
   - Dockerfile: `analytics/Dockerfile`
   - Puerto: `8000`
   - Variables de entorno recomendadas:
     - `REDIS_URL` si usas un Redis externo
     - `PYTHONUNBUFFERED=1`

## Pasos de despliegue

### 1. Preparar servicios externos

- Crear o usar un MongoDB gestionado (por ejemplo Atlas).
- Obtener la URI de conexión y colocarla en `MONGO_URI`.
- Si usas Redis en producción, crear un Redis gestionado y usar su URL en `REDIS_URL`.

### 2. Crear servicios en Render

Para cada servicio en Render:
- Seleccionar `Docker` como entrono de despliegue.
- Apuntar al Dockerfile correspondiente.
- En el dashboard de Render, definir las variables de entorno necesarias.
- Activar deploy automático si quieres que Render reconstruya al hacer push.

### 3. Configurar URLs y variables

- `BASE_URL` en backend debe ser la URL pública del backend en Render.
- `FRONTEND_URL` en backend debe ser la URL pública del frontend en Render.
- `VITE_API_BASE` en frontend debe ser la URL del backend (sin `/api`).
- `ANALYTICS_URL` en backend debe ser la URL del servicio analytics.

### 4. Google OAuth

Si usas Google OAuth, en Google Cloud Console configurar:
- Authorized redirect URI: `https://<backend-url>/api/auth/google/callback`
- Authorized JavaScript origins:
  - `https://<frontend-url>`
  - opcionalmente `http://localhost:3000` para pruebas locales

### 5. Validación local antes de producción

Ejecuta localmente:
```bash
docker compose up --build
```
Verifica:
- `http://localhost:5173` para el frontend
- `http://localhost:3000/api/analytics/health` para el backend proxy
- `http://localhost:8000/health` para analytics

### 6. Evitar Docker Compose en producción

Render no usa `docker-compose.yml` en producción. Mantén `docker-compose.yml` solo para desarrollo local.

## Ajustes importantes ya aplicados

- `backend/Dockerfile` ahora usa `npm start`.
- `frontend/Dockerfile` ahora construye el frontend y usa `npm run preview`.

## Recomendaciones finales

- No despliegues la app monolítica con `docker-compose` en Render.
- Mantén backend, frontend y analytics como servicios separados.
- Usa MongoDB Atlas / Redis gestionado para producción.
- Configura CORS en backend con `FRONTEND_ORIGIN` o deja que acepte dominios `onrender.com`.
- Si es necesario, usa un `render.yaml` en el futuro para definir la infraestructura como código.
