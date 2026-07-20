# AI Fallback System - Testing Guide

## Quick Test: Verificar que el fallback funciona

### Paso 1: Redeployment
Push los cambios y redeploy el backend en Render:
```bash
git add -A
git commit -m "Fix: Improved AI fallback system with streaming error handling"
git push
# Render detectará los cambios automáticamente
```

### Paso 2: Monitor los logs en Render
Una vez que el backend se redeploy, envía un mensaje al chat y verifica:

**Escenario esperado si OpenRouter falla:**
```
📡 AI: 2 providers available: openRouter, openAI
📡 AI Stream: Attempting openRouter (attempt 1/3) with model openai/gpt-4o-mini
✅ AI Stream: Got response stream from openRouter
❌ AI Stream: openRouter failed (attempt 1/3): 
   { status: 401, code: 'AuthenticationError', isRetryable: false }
⚠️  AI Stream: openRouter error is not retryable (401), trying next provider...
📡 AI Stream: Attempting openAI (attempt 1/3) with model gpt-4o-mini
✅ AI Stream: openAI completed successfully in 890ms
```

### Paso 3: Verificaciones

**✅ Fallback funcionando:**
- ✅ Los logs muestran "openRouter failed (attempt 1/3)"
- ✅ Luego muestra "Attempting openAI"
- ✅ OpenAI request completa exitosamente
- ✅ El usuario recibe respuesta normal (sin error 500)

**❌ Fallback NO funcionando (problemas esperados):**
- ❌ El error 401 no es capturado, genera error 500 en frontend
- ❌ No ve el log "Attempting openAI"
- ❌ Los logs NO diferencian entre retryables/no-retryables

### Logs Clave a Buscar

| Log | Significado |
|-----|-------------|
| `📡 AI: 2 providers available` | Ambos providers configurados ✅ |
| `Attempting openRouter` | Intentando primary provider |
| `error is not retryable (401)` | Detectó error de auth, saltando a fallback ✅ |
| `Attempting openAI` | Saltó exitosamente al fallback ✅ |
| `All providers exhausted` | Ambos providers fallaron ❌ |
| `Circuit breaker is OPEN` | Provider en "timeout" después de N fallos |

### Cómo Triggerear Errores para Testear

**Para simular fallo de OpenRouter:**
1. Borrar o invalidar `OPENROUTER_API_KEY` en Render env vars
2. Enviar mensaje al chat
3. Verificar que automáticamente usa OpenAI

**Para simular fallo de OpenAI:**
1. Borrar o invalidar `OPENAI_API_KEY`  
2. Enviar mensaje
3. Verificar que abre circuit breaker y lanza error apropiado

**Para simular fallo de ambos:**
1. Borrar ambas API keys
2. Enviar mensaje
3. Esperar error: "No API keys configured"

## Metrics to Monitor

Después del redeployment, monitorear:

```javascript
Provider Stats:
- openRouter success rate (debería ser ~98%+)
- openAI fallback triggers (debería ser 0-2%)
- Average response time per provider
- Circuit breaker opens/resets
```

Los logs incluyen esta info en cada respuesta fallida:
```
Provider stats: {
  openRouter: { successCount: 150, failureCount: 0, avgMs: 1240 },
  openAI: { successCount: 0, failureCount: 0, avgMs: 0 }
}
```

## Expected Behavior After Fix

### Normal Operation (99% of time)
- OpenRouter responde exitosamente
- Tiempo: ~1.2-2 segundos
- Logs: `✅ openRouter succeeded in 1240ms`

### Occasional Failure (1% of time)
- OpenRouter falla con 401/429/timeout
- Fallback automático a OpenAI
- Tiempo: ~3-5 segundos (incluye backoff si 429)
- Logs: Muestra el fallback en acción
- Usuario ve respuesta normal (sin errores)

### Circuit Breaker Triggered (<0.1%)
- OpenRouter falla 3+ veces consecutivas
- Circuit breaker abre
- Próximas 60 segundos: solo usa OpenAI
- Después 60s: reintentas OpenRouter
- Logs: `Circuit breaker OPEN for openRouter after 3 failures`

## Verification Checklist

- [ ] Backend redeploy exitoso en Render
- [ ] Logs muestran "providers available"
- [ ] Enviar mensaje al chat → respuesta OK
- [ ] Verificar fallback en los logs (si ocurre error)
- [ ] No hay errores 500 en el frontend
- [ ] Los tiempos de respuesta están dentro de lo normal
- [ ] Circuit breaker no se abre sin razón (no ver 3+ fallos)

## Performance Baseline

Después del fix, esperamos estos tiempos:
- **Happy path** (OpenRouter success): 1000-1500ms
- **Retry path** (429 retry): 4000-8000ms total (backoff)
- **Fallback path** (OpenRouter 401): 2000-3000ms total
- **Circuit breaker path** (60s timeout): Uses OpenAI only

Si los tiempos son significativamente más altos, revisar:
1. Network latency (Render → OpenRouter/OpenAI)
2. Model processing time
3. Message complexity
4. Backend CPU/memory utilization

## Troubleshooting

### Problema: "All providers exhausted" error
**Solución:**
- Verificar OPENROUTER_API_KEY está válida en Render env
- Verificar OPENAI_API_KEY está válida en Render env
- Verificar que ambos servicios (OpenRouter, OpenAI) están online
- Revisar rate limits en ambos providers

### Problema: Fallback no se usa cuando debería
**Solución:**
- Buscar "is not retryable" en logs - si no está, error manejado como retryable
- Revisar CIRCUIT_BREAKER_THRESHOLD (default: 3)
- Revisar CIRCUIT_BREAKER_RESET_MS (default: 60000)

### Problema: Tiempos de respuesta muy lentos
**Solución:**
- Verificar si hay muchos retries (429 errors)
- Buscar exponential backoff en logs: "Retrying in 4000ms"
- Considerar aumentar rate limits con OpenRouter/OpenAI
- Verificar latency de red entre Render y providers

## Notes

- El sistema es completamente automático - no requiere intervención manual
- Los usuarios nunca verán errores de provider (fallback transparente)
- Todos los intentos son registrados en logs para debugging
- Circuit breaker reset automático cada 60s - no requiere reinicio
