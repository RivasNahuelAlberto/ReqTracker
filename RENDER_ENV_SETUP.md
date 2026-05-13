# Variables de Entorno para Render

## Problema Actual
El error indica que Google OAuth está redirigiendo a `http://localhost:4000/api/auth/google`, lo que significa que las variables de entorno no están configuradas correctamente en Render.

## Backend (reqtracker-backend)

En el dashboard de Render, ir a "Environment" y configurar:

### Variables Requeridas:
```
# Base URL del backend (IMPORTANTE)
BASE_URL=https://reqtracker-2.onrender.com

# URL del frontend (OPCIONAL en producción - se construye automáticamente)
FRONTEND_URL=https://reqtracker-3.onrender.com

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

**Nota sobre el error "invalid_client":** Si ves este error, significa que el redirect URI autorizado en Google Cloud Console no coincide con el callback URL del backend. Asegúrate de que sea exactamente `https://reqtracker-2.onrender.com/api/auth/google/callback` (con `/api` incluido).

## Frontend (reqtracker)

En el dashboard de Render, ir a "Environment" y configurar:

### Variable Requerida:
```
# URL del backend API (IMPORTANTE - sin /api al final)
VITE_API_BASE=https://reqtracker-2.onrender.com
```

**Nota:** No agregar `/api` al final de VITE_API_BASE. El código del frontend ya agrega `/api` automáticamente.

## Configuración en Google Cloud Console

Para Google OAuth, configurar el redirect URI en Google Cloud Console:

1. Ir a [Google Cloud Console](https://console.cloud.google.com/)
2. Seleccionar tu proyecto (`majestic-bloom-495611-d7`)
3. Ir a "APIs & Services" > "Credentials"
4. Editar el OAuth 2.0 Client ID (`263290739116-p85o6gu3bhukm1qf7vkton9jgegjj2pk.apps.googleusercontent.com`)
5. En "Authorized redirect URIs", cambiar de:
   - ❌ `https://reqtracker-2.onrender.com/auth/google/callback`
   - ✅ `https://reqtracker-2.onrender.com/api/auth/google/callback`
6. En "Authorized JavaScript origins", verificar que tenga:
   - ✅ `https://reqtracker-3.onrender.com`6. En "Authorized JavaScript origins", agregar:
   - Para desarrollo: `http://localhost:3000`
   - Para producción: `https://reqtracker-3.onrender.com`
## Verificación

Después de configurar las variables:

1. **Backend**: Debería iniciar sin errores y mostrar logs de Passport inicializado
2. **Frontend**: El botón "Continuar con Google" debería redirigir a `https://reqtracker-2.onrender.com/api/auth/google`
3. **Google OAuth**: Después de autenticación, debería redirigir a `https://reqtracker-3.onrender.com/login?token=...`

## URLs Esperadas

- Frontend: `https://reqtracker-3.onrender.com`
- Backend API: `https://reqtracker-2.onrender.com/api`
- Google OAuth inicio: `https://reqtracker-2.onrender.com/api/auth/google`
- Google OAuth callback: `https://reqtracker-2.onrender.com/api/auth/google/callback`

## Troubleshooting

Si aún redirige a localhost:

1. Verificar que `VITE_API_BASE` esté configurado en el frontend de Render como `https://reqtracker-2.onrender.com`
2. Verificar que `BASE_URL` esté configurado en el backend de Render como `https://reqtracker-2.onrender.com`
3. Verificar que `FRONTEND_URL` esté configurado en el backend de Render como `https://reqtracker-3.onrender.com`
4. Redeploy ambos servicios después de cambiar variables de entorno
5. Verificar logs del backend para errores de configuración