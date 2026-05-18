# DEPLOYMENT GUIDE - FASE 3.1 A PRODUCCIÓN

## 📋 Pre-Deployment Checklist

### 1. Verificación de Código ✅
```bash
# Verificar que no hay SyntaxErrors
node -c backend/ai/embeddings.js
node -c backend/ai/knowledge/semantic-matcher.js
node -c backend/ai/knowledge/pattern-clustering.js
node -c backend/ai/agent/controller.js
node -c backend/ai/knowledge/knowledge.promoter.js

# Verificar imports
npm list | grep -E "redis|openai|mongoose"
```

### 2. Verificación de Redis
```bash
# Conectar a Redis y verificar disponibilidad
redis-cli ping
# Respuesta esperada: PONG

# Verificar que lazy initialization funciona
npm test -- tests/redis.test.js
```

### 3. Verificación de OpenAI API
```bash
# Testear generación de embeddings
curl -X POST https://api.openai.com/v1/embeddings \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Test embedding",
    "model": "text-embedding-ada-002"
  }'
```

### 4. Verificación de Base de Datos
```bash
# Conectar a MongoDB y verificar esquemas
mongosh --eval "db.projects.findOne()"
mongosh --eval "db.requirements.findOne()"
mongosh --eval "db.symbols.findOne()"
```

---

## 🚀 Deployment Steps

### Paso 1: Código a Staging
```bash
# Checkout de rama FASE_3.1
git checkout FASE_3.1

# Verificar archivos modificados
git status

# Expected files:
# M backend/ai/embeddings.js
# M backend/ai/embeddings.utils.js
# M backend/ai/agent/planner.service.js
# M backend/ai/agent/controller.js
# M backend/ai/knowledge/knowledge.promoter.js
# M backend/routes/projects.js
# M backend/routes/symbols.js
# A backend/ai/knowledge/semantic-matcher.js
# A backend/ai/knowledge/pattern-clustering.js
# A backend/ai/cache/redis.cache.js (if new)
```

### Paso 2: Run Test Suite
```bash
# Tests de gaps cerrados
npm test -- tests/checkpoint-b.test.js

# Tests de funcionalidad nueva
npm test -- tests/checkpoint-c.test.js

# Tests de robustez
npm test -- tests/checkpoint-d.test.js

# Suite final
npm test -- tests/checkpoint-final.test.js
```

### Paso 3: Staging Deployment
```bash
# En servidor staging:
cd /app/staging

# Pull código
git pull origin FASE_3.1

# Install dependencies (si hay nuevas)
npm install

# Build (si tiene build step)
npm run build

# Start server
npm start

# Verificar que server arranca sin errores
curl http://localhost:3000/api/health
# Expected: {"status":"ok"}
```

### Paso 4: Smoke Tests en Staging
```bash
# Test 1: Crear proyecto de prueba
curl -X POST http://staging:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"F3.1 Test","description":"Testing FASE 3.1"}'

# Test 2: Agregar requisitos
curl -X POST http://staging:3000/api/projects/{projectId}/requirements \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Requirement","description":"Testing semantic matching"}'

# Test 3: Run agent
curl -X POST http://staging:3000/api/ai/runAgent \
  -H "Content-Type: application/json" \
  -d '{
    "projectId":"{projectId}",
    "goal":"Analiza los requisitos del proyecto"
  }'

# Expected response: {task, planText, metrics}
# Verify metrics.totalDuration < 15000ms
```

### Paso 5: Performance Baseline
```bash
# Ejecutar agent 3 veces seguidas
for i in {1..3}; do
  echo "=== Execution $i ==="
  curl -X POST http://staging:3000/api/ai/runAgent \
    -H "Content-Type: application/json" \
    -d '{"projectId":"{projectId}","goal":"Análisis rápido"}' \
  | jq '.metrics | {totalDuration, stages}'
done

# Expected:
# Exec 1: ~8000ms
# Exec 2: ~2000ms (cache hit)
# Exec 3: ~2000ms (cache hit)
```

### Paso 6: Production Deployment
```bash
# Merge a main
git checkout main
git merge --no-ff FASE_3.1

# Tag versión
git tag -a v3.1-complete -m "FASE 3.1 Complete - Gaps and Improvements"
git push origin main v3.1-complete

# En servidor producción:
cd /app/production

# Pull con tag
git pull origin main
git checkout v3.1-complete

# Install y start
npm install
npm run build  # si existe
npm start &

# Verificar que arranca
sleep 5
curl http://localhost:3000/api/health
```

---

## 📊 Monitoring Post-Deployment

### Métricas a Monitorear (Primeras 24h)
```
1. Error rate - Target: <0.1%
2. Response time - Target: <10s para agent execution
3. Cache hit rate - Target: >70% en segunda ejecución
4. Redis latency - Target: <5ms

# Logs a revisar:
tail -f /var/log/app/agent.log | grep -E "ERROR|WARN|metrics"
```

### Alertas a Configurar
```yaml
- name: "Agent Execution Timeout"
  condition: execution_time > 15000ms
  action: page_on_call

- name: "Cache Miss Rate High"
  condition: cache_hit_rate < 50%
  action: notify_slack

- name: "Parser Errors"
  condition: failed_parses > 5/hour
  action: notify_devops

- name: "Redis Unavailable"
  condition: redis_latency > 1000ms
  action: page_on_call
```

---

## 🔄 Rollback Plan

Si algo falla en producción:

### Rollback Rápido
```bash
# Volver a versión anterior
git checkout v3.0-stable

# Restart server
systemctl restart app

# Verificar
curl http://localhost:3000/api/health

# Post-incident analysis
# - Check logs en /var/log/app/
# - Grabar issue para post-mortem
# - Comunicar timeline a team
```

### Partial Rollback (Mantener Gap 1, revertir Mejoras)
```bash
# Si solo Mejoras 4-7 falla:
# Revertir funcionalidad pero mantener cache

git revert {commit-mejoras-4-7}
git push origin main
```

---

## 📋 Post-Deployment Validation (24 horas)

### Checklist Final
```
FUNCIONALIDAD:
☑ Agent executes end-to-end without errors
☑ Cache hits reducing response time
☑ Semantic matching finding duplicates
☑ Pattern clustering detecting themes
☑ Adaptive timeouts respecting formula
☑ Metrics being logged and tracked

PERFORMANCE:
☑ First execution <10s
☑ Subsequent executions <3s
☑ Cache hit rate >70%
☑ No timeout errors

STABILITY:
☑ Error rate <0.1%
☑ No memory leaks
☑ Redis connection stable
☑ OpenAI API calls successful

OBSERVABILITY:
☑ Logs readable and structured
☑ Metrics dashboard showing data
☑ Alerts configured and working
☑ Can trace individual executions
```

---

## 🎓 Training/Handoff

### Documentación para Team
1. **Architecture**: FASE_3.1_IMPLEMENTATION_COMPLETE.md
2. **API Changes**: 
   - `/api/ai/runAgent` now returns `{task, planText, failureExplanation, metrics}`
   - New optional headers for debugging
3. **Monitoring**: 
   - Key metrics in response
   - Structured logs in backend
   - Redis cache behavior

### Capacitación
- Session sobre semantic matching y cuando se usa
- Demo de pattern clustering
- Explicación de timeout adaptativo
- Cómo leer las métricas

---

## 🆘 Troubleshooting

### Agent taking >15s to execute
```
1. Check project size (requirements count)
2. Verify formula: 5000 + (reqs/200)*1000
3. Check if Redis is hit or miss
4. Monitor if API calls are slow
5. Increase timeout in controller.js if needed
```

### Cache not working
```
1. Verify Redis is running: redis-cli ping
2. Check logs for Redis connection errors
3. Verify setex calls in embeddings.js
4. Test cache manually: redis-cli GET "agent:embeddings:*"
```

### Parser failing on valid JSON
```
1. Check if JSON has unusual escaping
2. Review extractJson() logs
3. Test with bracket-matching strategy
4. Add to test cases if new pattern found
```

### Clustering producing poor patterns
```
1. Check threshold setting (default 0.75)
2. Verify embeddings are being generated
3. Review cluster coherence scores
4. Consider lowering threshold if data sparse
```

---

## 📞 Support

**For issues in production:**

1. **Immediate**: Rollback using rollback plan above
2. **Short-term**: Apply hotfix on staging first, test, then deploy
3. **Medium-term**: Root cause analysis and prevention
4. **Long-term**: Update monitoring/documentation

**Escalation path:**:
- Level 1: Check logs and metrics
- Level 2: Consult implementation document
- Level 3: Roll back and investigate offline
- Level 4: Contact original developer (if available)

---

## ✨ Success Criteria

FASE 3.1 es considerada exitosa en producción si:

✅ **24 horas sin errores** - error_rate < 0.1%  
✅ **Cache performance** - hit_rate > 70%, latency <5ms  
✅ **Agent reliability** - success_rate > 99%  
✅ **Parser robustness** - parse_failure_rate < 0.1%  
✅ **Timeout behavior** - 0 false timeouts en 48h  
✅ **Monitoring complete** - All metrics collected and visible  

---

**Generated**: 2026-05-15  
**Status**: Ready for Production  
**Version**: FASE 3.1 Complete
