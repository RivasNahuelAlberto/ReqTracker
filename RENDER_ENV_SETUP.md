# Variables de Entorno para Render

## Problema Actual
El error indica que Google OAuth está redirigiendo a `http://localhost:4000/api/auth/google`, lo que significa que las variables de entorno no están configuradas correctamente en Render.

## Backend (reqtracker-backend)

En el dashboard de Render, ir a "Environment" y configurar:

### Variables Requeridas:
```
# Base URL del backend (IMPORTANTE)
BASE_URL=https://reqtracker-backend.onrender.com

# URL del frontend (OPCIONAL en producción - se construye automáticamente)
FRONTEND_URL=https://reqtracker.onrender.com

# JWT Secret (generar uno seguro)
JWT_SECRET=tu_jwt_secret_seguro_aqui

# MongoDB URI
MONGO_URI=mongodb+srv://usuario:password@cluster.mongodb.net/reqtracker

# Google OAuth (obtener de Google Cloud Console)
GOOGLE_CLIENT_ID=tu_google_client_id
GOOGLE_CLIENT_SECRET=tu_google_client_secret

# Puerto (opcional, Render lo asigna automáticamente)
PORT=10000

# AI Provider (opcional)
AI_PROVIDER=gemini
```

**Nota sobre FRONTEND_URL:** En producción con Render, esta variable es opcional porque el backend puede construir automáticamente la URL del frontend reemplazando "backend-" por "" en la URL del backend. Solo configúrala si necesitas una URL diferente.

## Frontend (reqtracker)

En el dashboard de Render, ir a "Environment" y configurar:

### Variable Requerida:
```
# URL del backend API (IMPORTANTE - sin /api al final)
VITE_API_BASE=https://reqtracker-backend.onrender.com
```

**Nota:** No agregar `/api` al final de VITE_API_BASE. El código del frontend ya agrega `/api` automáticamente.

## Configuración en Google Cloud Console

Para Google OAuth, configurar el redirect URI en Google Cloud Console:

1. Ir a [Google Cloud Console](https://console.cloud.google.com/)
2. Seleccionar tu proyecto
3. Ir a "APIs & Services" > "Credentials"
4. Editar el OAuth 2.0 Client ID
5. En "Authorized redirect URIs", agregar:
   - Para desarrollo: `http://localhost:4000/api/auth/google/callback`
   - Para producción: `https://reqtracker-backend.onrender.com/api/auth/google/callback`

## Verificación

Después de configurar las variables:

1. **Backend**: Debería iniciar sin errores y mostrar logs de Passport inicializado
2. **Frontend**: El botón "Continuar con Google" debería redirigir a `https://reqtracker-backend.onrender.com/api/auth/google`
3. **Google OAuth**: Después de autenticación, debería redirigir a `https://reqtracker.onrender.com/login?token=...`

## URLs Esperadas

- Frontend: `https://reqtracker.onrender.com`
- Backend API: `https://reqtracker-backend.onrender.com/api`
- Google OAuth inicio: `https://reqtracker-backend.onrender.com/api/auth/google`
- Google OAuth callback: `https://reqtracker-backend.onrender.com/api/auth/google/callback`

## Troubleshooting

Si aún redirige a localhost:

1. Verificar que `VITE_API_BASE` esté configurado en el frontend de Render
2. Verificar que `BASE_URL` esté configurado en el backend de Render
3. Verificar que `FRONTEND_URL` esté configurado en el backend de Render
4. Redeploy ambos servicios después de cambiar variables de entorno
5. Verificar logs del backend para errores de configuración