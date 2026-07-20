# 🚀 Ollama Local Setup Guide para ReqTracker

**Objetivo:** Configurar Continue en VS Code para usar Ollama (local LLM) sin dependencias de modelos pagos.

**Estado:** ✅ Configurado completamente  
**Fecha:** 2026-05-17  
**Requisitos:** Ollama instalado + Continue extension

---

## 1. Instalación de Ollama

### Windows
```powershell
# Descargar instalador desde https://ollama.ai/download
# O usar winget:
winget install Ollama.Ollama

# Verificar instalación
ollama --version
```

### macOS
```bash
# Descargar desde https://ollama.ai/download
# O usar brew:
brew install ollama

# Verificar
ollama --version
```

### Linux (Ubuntu/Debian)
```bash
curl -fsSL https://ollama.ai/install.sh | sh

# Verificar
ollama --version
```

---

## 2. Descargar Modelos Locales

### Opción 1: Llama 3 (Recomendado)
**Tamaño:** ~4.7 GB | **Velocidad:** Buena | **Calidad:** Excelente para código

```bash
ollama pull llama3
```

### Opción 2: Mistral (Alternativa rápida)
**Tamaño:** ~3.8 GB | **Velocidad:** Muy rápida | **Calidad:** Buena

```bash
ollama pull mistral
```

### Opción 3: Neural Chat (Lightweight)
**Tamaño:** ~1.3 GB | **Velocidad:** Muy rápida | **Calidad:** OK para tareas simples

```bash
ollama pull neural-chat
```

### Listar modelos descargados
```bash
ollama list
```

---

## 3. Iniciar Ollama Server

```bash
# En terminal, ejecutar:
ollama serve

# Output esperado:
# listening on 127.0.0.1:11434
```

**⚠️ IMPORTANTE:** 
- El servidor debe estar corriendo en `http://localhost:11434`
- Deja esta terminal abierta mientras usas Continue
- Si necesitas correr otra cosa, abre otra terminal

---

## 4. Verificar Conexión Ollama

### Desde terminal
```bash
# Test de conexión
curl http://localhost:11434/api/tags

# Output esperado: lista de modelos descargados en JSON
```

### Desde VS Code (Continue)
1. Abre Continue chat (⌘+Shift+L o Ctrl+Shift+L)
2. Escribe: `Hola, puedes ayudarme?`
3. Si responde → ✅ Ollama está funcionando

---

## 5. Configuración Continue ya Hecha

El archivo `.continue/config.json` ya está configurado con:

✅ **Modelo principal:** Llama 3 (Ollama local)  
✅ **Modelo alternativo:** Mistral (si quieres cambiar)  
✅ **Context providers:** Backend, Frontend, Analytics, Docs  
✅ **Debugging modes:** OAuth, MongoDB, Socket.io, Performance  
✅ **Continue Hub:** Deshabilitado  
✅ **APIs externas:** Deshabilitadas  

**No necesitas modificar nada más.**

---

## 6. Primeros Pasos - Comandos Útiles

### Análisis de código
```
Analiza este archivo: backend/routes/auth.js
¿Hay vulnerabilidades de seguridad?
```

### Debugging
```
He encontrado este error:
[PEGA EL ERROR AQUÍ]

¿Cuál es la causa y cómo lo arreglo?
```

### Ayuda arquitectónica
```
Según la arquitectura de ReqTracker, ¿cómo debería implementar [FEATURE]?
```

### Trace de flujo
```
Traza la ejecución completa del flujo de OAuth.
Comienza en LoginPage.jsx y termina en MongoDB.
```

---

## 7. Modos de Debugging Integrados

Pregunta a Continue sobre:

### 🔐 OAuth Debug
```
@mention oauth-debug
```
**Contexto:** Routes auth, middleware, frontend login, documentación OAuth

### 🗄️ MongoDB Debug
```
@mention mongodb-debug
```
**Contexto:** Modelos, rutas, MODULES_AND_LAYERS.md

### 🔄 Socket.io Debug
```
@mention socket-debug
```
**Contexto:** Backend index.js, socket config, frontend App.jsx

### ⚡ Performance Debug
```
@mention performance-debug
```
**Contexto:** Servicios AI, CRITICAL_DEPENDENCIES

---

## 8. Ventajas Ollama Local

| Aspecto | Ollama Local | Continue Hub (Pagos) |
|---------|-------------|----------------------|
| **Costo** | 💰 Gratis | 💸 $20+/mes |
| **Internet** | ✅ Offline | ❌ Requiere conexión |
| **Privacidad** | 🔒 Datos locales | ⚠️ Enviados a servidores |
| **Latencia** | ⚡ Muy rápida | 🐢 Dependencia de red |
| **Modelos** | 📦 Descargas locales | 🌐 Solo modelos pagos |
| **Control** | 👨‍💻 Total | 📋 Limitado |

---

## 9. Solución de Problemas

### Problema: "Connection refused http://localhost:11434"
**Solución:**
```bash
# Verifica que Ollama esté corriendo
ollama serve

# En otra terminal:
curl http://localhost:11434/api/tags
```

### Problema: Modelo muy lento o se cuelga
**Solución:**
- Usa `mistral` en lugar de `llama3` (más rápido)
- O `neural-chat` (más ligero)
- Aumenta memoria/GPU si tienes disponible

```bash
# Revisar configuración GPU (en config.json)
# "numGPU": "auto" → Usa GPU si está disponible
```

### Problema: Continue no ve Ollama
**Solución:**
1. Verifica `.continue/config.json` tiene endpoint correcto: `http://localhost:11434`
2. Reinicia VS Code
3. Abre terminal VS Code y verifica: `curl http://localhost:11434/api/tags`

### Problema: "No such file or directory: ollama"
**Solución:**
- Windows: Reinstala desde https://ollama.ai/download
- macOS/Linux: `brew install ollama` o reinstala desde fuente

---

## 10. Rendimiento Esperado

### Llama 3
- **Tiempo respuesta:** 30-60 segundos (primera vez)
- **Respuestas subsecuentes:** 10-30 segundos
- **Calidad:** Excelente para código y análisis
- **RAM:** ~8-16 GB recomendado

### Mistral
- **Tiempo respuesta:** 10-20 segundos
- **Calidad:** Buena, más rápida que Llama3
- **RAM:** ~6-8 GB recomendado

### Neural Chat
- **Tiempo respuesta:** 5-10 segundos
- **Calidad:** OK para tareas simples
- **RAM:** ~4 GB mínimo

**Nota:** Los tiempos mejoran si tienes GPU (NVIDIA CUDA/AMD ROCm).

---

## 11. Integración con MCP (Render) Opcional

Si luego necesitas debuggear con logs de Render:

1. Configura `RENDER_API_KEY` en `.env`
2. Edita `.continue/config.json`:
   ```json
   "mcp_servers": {
     "render": {
       "enabled": true,
       ...
     }
   }
   ```
3. Cline usará MCP cuando esté disponible (internet) + Ollama cuando sea local

---

## 12. Flujo Típico de Trabajo

```
1. Iniciar terminal → ollama serve
   (dejar abierta)

2. Abrir VS Code → Continue lista (⌘+Shift+L)

3. Hacer pregunta → Continue responde en 30-60s

4. Iteración → Seguir conversación

5. Referenciar documentación → @documents o @codebase

6. Debugging → Usar modes (oauth-debug, mongo-debug, etc)
```

---

## 13. Referencias

- **Ollama Docs:** https://github.com/ollama/ollama
- **Continue Docs:** https://continue.dev/docs
- **ReqTracker Docs:**
  - [TECHNICAL_OVERVIEW.md](../TECHNICAL_OVERVIEW.md)
  - [ARCHITECTURE.md](../ARCHITECTURE.md)
  - [MCP Integration Guide](./mcp-vscode-integration.md)

---

## 14. Próximos Pasos

✅ **Hecho:**
- Ollama descargado
- Modelos locales listos
- Continue configurado

**Próximo:**
1. Iniciar `ollama serve` en terminal
2. Verificar conexión en VS Code
3. Hacer tu primera pregunta a Continue
4. Explorar debugging modes

---

**¿Preguntas?** Consulta [MCP Integration Guide](./mcp-vscode-integration.md) o la sección de Troubleshooting arriba.

**Última actualización:** 2026-05-17  
**Status:** ✅ Fully Configured for Offline Development
