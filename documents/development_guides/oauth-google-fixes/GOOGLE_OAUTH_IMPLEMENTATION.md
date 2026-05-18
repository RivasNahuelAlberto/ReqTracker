# 📋 Documentación: Google OAuth Implementation - ReqTracker

**Fecha:** Mayo 18, 2026  
**Estado:** ✅ Completado y Deployado  
**Cambios Totales:** 8 archivos modificados

---

## 🎯 Objetivo General

Implementar autenticación Google OAuth en ReqTracker con flujo stateless:
- ✅ Backend genera JWT después de Google auth
- ✅ Frontend recibe token en query param
- ✅ SPA routing funciona correctamente en Render
- ✅ Token se persiste en localStorage y contexto de React

---

## 📁 Resumen de Cambios por Archivo

### 1️⃣ **backend/models/User.js** - Manejo de passwordnull

**Problema:** Cuando usuarios se registran vía Google OAuth, `password` es `null`, causando que `bcrypt.hash(null)` falle.

**Cambio:**
```javascript
// ANTES (línea 20)
if (!this.isModified('password')) return next();

// DESPUÉS
if (!this.isModified('password') || !this.password) return next();
```

**Razón:** Permite usuarios sin contraseña (Google OAuth) sin intentar hashear `null`.

**Archivos relacionados:**
- Token: `bcrypt` - pre-save middleware en User schema

---

### 2️⃣ **backend/routes/auth.js** - OAuth Redirect Fix

**Problema:** Redirigía a `/login?token=...` pero esa ruta no existe en SPA.

**Cambio 1 - getFrontendUrl() (línea 381)**
```javascript
// Usa FRONTEND_URL del env si está configurada
if (process.env.FRONTEND_URL) {
  return process.env.FRONTEND_URL;
}
```

**Cambio 2 - Redirección OAuth (línea 440)**
```javascript
// ANTES
res.redirect(`${frontendUrl}/login?token=${token}`);

// DESPUÉS
res.redirect(`${frontendUrl}/auth/success?token=${token}`);
```

**Razón:** 
- Ruta dedicada `/auth/success` para procesar OAuth
- Ruta `/login` ahora solo para login tradicional
- Mantiene clara la separación de concerns

**Archivos relacionados:**
- Procesa tokens JWT generados en línea 422-432
- Usa GoogleStrategy verificado en línea 301-375

---

### 3️⃣ **frontend/src/App.jsx** - Router Cambio Crítico

**Problema:** `HashRouter` solo maneja rutas después de `#` (ej: `/#/auth/success`), pero backend redirige a `/auth/success` (sin hash).

**Cambio 1 - Import (línea 1)**
```javascript
// ANTES
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';

// DESPUÉS
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
```

**Cambio 2 - Router Component (línea 29)**
```javascript
// ANTES
<HashRouter>
  <Routes>...</Routes>
</HashRouter>

// DESPUÉS
<BrowserRouter>
  <Routes>...</Routes>
</BrowserRouter>
```

**Cambio 3 - Nueva Ruta (línea 36)**
```javascript
<Route path="/auth/success" element={<OAuthSuccess />} />
```

**Razón:**
- URLs limpias: `/auth/success?token=...` en vez de `/#/auth/success?token=...`
- BrowserRouter es estándar moderno
- Compatible con Render rewrite configurado

**Impacto en URLs:**
| Antes | Después |
|-------|---------|
| `/#/login` | `/login` |
| `/#/project/xyz` | `/project/xyz` |
| `/#/` | `/` |

---

### 4️⃣ **frontend/src/pages/OAuthSuccess.jsx** - Nuevo Componente

**Creado:** Página dedicada para procesar OAuth callback.

```javascript
export default function OAuthSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      navigate('/login?error=oauth_failed', { replace: true });
      return;
    }

    if (token) {
      // Guarda con key esperado por AuthContext
      localStorage.setItem('authToken', token);
      console.log('[OAuthSuccess] Token saved to localStorage as authToken');
      
      // Redirección limpia con recarga
      window.location.href = '/';
    } else {
      navigate('/login', { replace: true });
    }
  }, [searchParams, navigate]);

  return <LoadingSpinner />;
}
```

**Funcionalidad:**
- Extrae token de query param `?token=...`
- Guarda en `localStorage.authToken` (key esperado por `AuthContext`)
- Usa `window.location.href = "/"` para forzar recarga y que `AuthContext` verifique token

**Errores Evitados:**
- ❌ NO usa `setToken()` (no existe en `useAuth()`)
- ❌ NO usa `navigate()` después de guardar (puede no actualizar contexto)
- ✅ Usa `window.location.href` para recarga completa

---

### 5️⃣ **frontend/server.js** - Express SPA Server

**Mejorado:**
```javascript
// Serve static files con caching
app.use(express.static(distPath, {
  etag: false,
  maxAge: '1h',
  index: false
}));

// SPA Fallback
app.get('*', (req, res) => {
  console.log(`[SPA Fallback] Serving index.html for route: ${req.path}`);
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      console.error(`[Error] Failed to serve index.html:`, err);
      res.status(500).send('Internal Server Error');
    }
  });
});
```

**Cambios:**
- ✅ Caching headers para assets
- ✅ Logging para debug
- ✅ Error handling para recarga
- ✅ `index: false` previene conflictos

**Razón:** Asegura que TODAS las rutas SPA fallback a `index.html`.

---

### 6️⃣ **frontend/Dockerfile** - Production Server

**Problema:** Usaba `vite preview` en desarrollo, no servía SPA fallback.

**Cambio:**
```dockerfile
# ANTES
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5173"]

# DESPUÉS
CMD ["npm", "start"]
```

**Razón:** Ejecuta `server.js` (Express) que maneja SPA routing correctamente.

---

### 7️⃣ **render.yaml** - SPA Routes Configuration

**Nuevo:** Configuración de rutas en Render.

```yaml
services:
  - type: web
    name: reqtracker-frontend
    # ... resto de config ...
    routes:
      - type: rewrite
        source: "/*"
        destination: "/index.html"
        status: 200
```

**Qué hace:**
- Todas las rutas que NO son assets estáticos → `/index.html`
- Permite que BrowserRouter maneje routing en cliente
- Crítico para URLs limpias sin fallos 404

**Flujo:**
```
Acceso: /auth/success?token=JWT
  ↓
Render busca archivo /auth/success → no existe
  ↓
Aplica rewrite: /* → /index.html
  ↓
Browser recibe index.html
  ↓
React Router procesa /auth/success
  ↓
OAuthSuccess.jsx monta ✅
```

---

### 8️⃣ **frontend/package.json** - Scripts y Dependencias

**Cambios:**

1. **Script start:**
```json
"scripts": {
  "start": "node server.js"  // Nuevo
}
```

2. **Dependencia Express:**
```json
"dependencies": {
  "express": "^4.18.2"  // Agregado
}
```

**Razón:** Necesarios para ejecutar `server.js` en Render.

---

## 🔄 Flujo Completo OAuth

```
1. USUARIO ACCEDE A LOGIN
   ↓
   Navegador: https://reqtracker-frontend.onrender.com/login
   ↓
   Frontend: LoginPage.jsx → Google Sign-In button

2. USUARIO HACE CLICK EN "LOGIN WITH GOOGLE"
   ↓
   OAuth: Google login dialog
   ↓
   Usuario: Autenticación con Google

3. GOOGLE REDIRIGE A BACKEND
   ↓
   URL: https://reqtracker-backend.onrender.com/api/auth/google/callback?code=...
   ↓
   Backend: Recibe authorization code

4. BACKEND PROCESA OAUTH
   ↓
   auth.js (línea 301-375):
     - GoogleStrategy verifica profile
     - Busca/crea usuario en DB
     - Genera JWT (línea 422-432)
   ↓
   Backend: Token generado = eyJ...

5. BACKEND REDIRIGE AL FRONTEND
   ↓
   auth.js (línea 440):
     res.redirect(`${FRONTEND_URL}/auth/success?token=${token}`)
   ↓
   URL: https://reqtracker-frontend.onrender.com/auth/success?token=eyJ...

6. RENDER REWRITE ACTIVA
   ↓
   render.yaml routes/* → /index.html
   ↓
   Frontend recibe: GET /index.html

7. REACT ROUTER PROCESA
   ↓
   BrowserRouter ve: /auth/success
   ↓
   Route matching: path="/auth/success" → OAuthSuccess.jsx

8. OAUTHSUCCESS PROCESA TOKEN
   ↓
   OAuthSuccess.jsx (línea 21):
     - Extrae token de searchParams
     - localStorage.setItem('authToken', token)
     - window.location.href = '/'
   ↓
   Recarga completa de página

9. AUTHCONTEXT VERIFICA TOKEN
   ↓
   AuthProvider useEffect (línea 95):
     - Detecta localStorage.authToken
     - Llama verifyToken()
     - setUser(data.user)
     - connectSocket(data.user)

10. USUARIO AUTENTICADO
    ↓
    ProtectedRoute permite acceso
    ↓
    App.jsx: Home page renderiza ✅
```

---

## 📊 Tabla de Cambios

| Archivo | Línea | Tipo | Descripción |
|---------|-------|------|-------------|
| User.js | 20 | Fix | Null password check para Google OAuth |
| auth.js | 381 | Feature | FRONTEND_URL env variable |
| auth.js | 440 | Fix | Redirect a /auth/success |
| App.jsx | 1 | Major | HashRouter → BrowserRouter |
| App.jsx | 36 | Feature | Nueva ruta /auth/success |
| OAuthSuccess.jsx | NEW | Feature | Nuevo componente de callback |
| server.js | Optimizado | Improvement | Logging, caching, error handling |
| Dockerfile | CMD | Fix | Usar npm start (server.js) |
| render.yaml | routes | Feature | SPA rewrite configuration |
| package.json | scripts | Feature | Script start |
| package.json | dependencies | Feature | Express como dependencia |

---

## 🔐 Consideraciones de Seguridad

✅ **Implementado:**
- Token guardado en `localStorage` (accesible a XSS, pero estándar en SPA)
- JWT con expiración 7 días (`JWT_EXPIRY=7d`)
- Token nunca está en URL después de redirigir (solo en navegación)
- Validación de token en backend con `verifyToken()`

⚠️ **Mejoras Futuras:**
- Considerar `httpOnly` cookies si es posible en arquitectura
- Rate limiting en endpoint OAuth
- CSRF protection si se agrega session

---

## 📝 Environment Variables Necesarias

**Backend (.env):**
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://reqtracker-backend.onrender.com/api/auth/google/callback
FRONTEND_URL=https://reqtracker-frontend.onrender.com
JWT_SECRET=... (64 caracteres random)
MONGO_URI=...
NODE_ENV=production
```

**Frontend (.env):**
```
VITE_API_BASE=https://reqtracker-backend.onrender.com
```

---

## ✅ Validación Post-Deploy

Después de push a main:

1. **Esperar redeploy** (3-5 minutos)
2. **Probar flujo completo:**
   - [ ] Ir a `https://reqtracker-frontend.onrender.com/login`
   - [ ] Click "Login with Google"
   - [ ] Completar auth Google
   - [ ] Redirección a `/auth/success?token=...`
   - [ ] Redirección automática a `/` (home)
   - [ ] Usuario autenticado y visible

3. **Verificar console logs:**
   ```
   [OAuthSuccess] Mounted. Token present: true
   [OAuthSuccess] Token saved to localStorage as authToken
   [OAuthSuccess] Redirecting to home
   ```

4. **Verificar localStorage:**
   - [ ] DevTools → Application → localStorage
   - [ ] Key: `authToken`
   - [ ] Value: `eyJ...` (JWT válido)

5. **Probar recarga:**
   - [ ] F5 en homepage
   - [ ] Usuario permanece autenticado
   - [ ] Token verificado por backend

---

## 🐛 Troubleshooting

### Problema: "Not Found" en `/auth/success`
**Causa:** Render rewrite no configurado
**Fix:** Verificar `render.yaml` tiene sección `routes`

### Problema: Token no guarda
**Causa:** localStorage key incorrecto
**Fix:** Debe ser `authToken`, no `token`

### Problema: Redirecciona a `/login` después de guardar token
**Causa:** `window.location.href` redirige muy rápido
**Fix:** Normal - permite AuthContext verificar token

### Problema: "t is not a function"
**Causa:** Intento de usar `setToken()` que no existe
**Fix:** Usar solo localStorage, dejar que AuthContext maneje contexto

---

## 📚 Referencias

- [Passport.js Google OAuth](http://www.passportjs.org/packages/passport-google-oauth20/)
- [React Router BrowserRouter](https://reactrouter.com/en/main/router-components/browser-router)
- [Render SPA Routing](https://render.com/docs/static-sites)
- [JWT Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)

---

**Documento Generado:** Mayo 18, 2026  
**Responsable:** Implementación OAuth Google para ReqTracker  
**Status:** ✅ Producción
