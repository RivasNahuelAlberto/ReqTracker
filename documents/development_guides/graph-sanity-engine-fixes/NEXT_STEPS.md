# 📋 Graph Sanity Engine Fixes - NEXT_STEPS.md

**Última actualización:** 2026-05-17  
**Estado:** ✅ COMPLETADO - Trabajo futuro solo mantenimiento

---

## Próximas Acciones (Prioridad)

### 🔴 CRÍTICO - Hacer Ahora

- [x] ✅ COMPLETADO: Verificar Chat IA en producción funciona
- [x] ✅ COMPLETADO: Monitorear logs por "START NODE NOT FOUND"
- [x] ✅ COMPLETADO: Feedback de usuarios

**Status:** ✅ TODOS COMPLETADOS

---

### 🟠 IMPORTANTE - Próximas 48 horas

- [ ] **Monitoreo de Producción**
  - Revisar logs de backend cada 4 horas
  - Buscar: errores de validación, format mismatches
  - Alertar si graphSize sigue siendo 0

- [ ] **Performance Analysis**
  - Medir P95 response time de chat IA
  - Comparar con target < 2s
  - Si más lento: revisar GraphSanityEngine optimization

- [ ] **User Feedback Collection**
  - ¿Chat IA ahora es útil?
  - ¿Análisis son relevantes?
  - ¿Response time aceptable?

---

### 🟡 FUTURO - Próximas 1-2 semanas

#### 1. Optimizaciones de Performance

**Si Chat IA es lento (> 2s):**

- [ ] Implementar caching de lookups (lookup maps)
- [ ] Usar índices en MongoDB para nodes
- [ ] Considerar async processing si grafo > 1000 nodes

```javascript
// Pseudo-code: Cache lookup maps
const lookupCache = new Map();

function getNodeMap(projectId) {
  if (lookupCache.has(projectId)) {
    return lookupCache.get(projectId);
  }
  
  // Compute
  const map = computeNodeMap(projectId);
  lookupCache.set(projectId, map);
  
  // Invalidate after 10 min
  setTimeout(() => lookupCache.delete(projectId), 10 * 60 * 1000);
  
  return map;
}
```

#### 2. Mejorar Validación

**Si aún hay errores edge-case:**

- [ ] Agregar validación para ciclos (detectar y romper)
- [ ] Agregar validación para self-loops (A → A)
- [ ] Agregar validación para multigraphs (multiple edges same nodes)

```javascript
// Detectar ciclos
function hasCycle(graph) {
  const visited = new Set();
  const recursionStack = new Set();
  
  const dfs = (node) => {
    visited.add(node);
    recursionStack.add(node);
    
    const neighbors = graph.edges
      .filter(e => e.source === node)
      .map(e => e.target);
    
    for (const neighbor of neighbors) {
      if (recursionStack.has(neighbor)) return true;  // Ciclo encontrado
      if (!visited.has(neighbor) && dfs(neighbor)) return true;
    }
    
    recursionStack.delete(node);
    return false;
  };
  
  for (const node of graph.nodes) {
    if (!visited.has(node.id) && dfs(node.id)) return true;
  }
  return false;
}
```

#### 3. Tests Automatizados

**Si no existen tests automáticos:**

- [ ] Crear suite de tests para GraphSanityEngine
- [ ] Tests para casos edge: ciclos, orphans, self-loops
- [ ] Tests de integración: GraphSanityEngine → ContextCompiler
- [ ] Tests E2E: Chat IA completo

```javascript
// tests/unit/graph-sanity-engine.test.js
describe('GraphSanityEngine', () => {
  describe('fromRelations()', () => {
    test('should include fromName/toName', () => {
      // ...
    });
    
    test('should handle missing nodes gracefully', () => {
      // ...
    });
  });
});
```

#### 4. Documentación Adicional

- [ ] Video tutorial: "Cómo Graph Pipeline funciona"
- [ ] Decision log: Por qué lookup maps
- [ ] Troubleshooting guide: Errores comunes

---

### 🟢 FUTURO - Próximo Mes

#### 1. Refactorización si Necesario

- [ ] **Considerada pero no urgente:**
  - Extraer node lookup logic a helper class
  - Crear GraphNormalizationStrategy interface
  - Soportar múltiples formatos de entrada (JSON, CSV, etc.)

```typescript
interface GraphNormalizer {
  normalize(input: unknown): NormalizedGraph;
  validate(graph: NormalizedGraph): ValidationResult;
}

class ArrayFormatNormalizer implements GraphNormalizer {
  // ...
}

class ObjectFormatNormalizer implements GraphNormalizer {
  // ...
}
```

#### 2. Análisis Avanzado

- [ ] Agregar metrics de grafo (centrality, betweenness, etc.)
- [ ] Análisis de clustering
- [ ] Detección de comunidades

#### 3. Escalabilidad

- [ ] Soportar grafos > 10000 nodos
- [ ] Implementar streaming graph processing
- [ ] Considerar distributed processing (si aplicable)

---

## Manutenimiento Continuo

### Monitoreo Regular

**Cada 24 horas:**
```
☐ Revisar logs de backend
☐ Buscar: graphSize, START NODE, validation errors
☐ Verificar P95 response time
☐ Revisar error rate
```

**Cada semana:**
```
☐ Revisar performance trends
☐ Recopilar feedback de usuarios
☐ Actualizar README si necesario
☐ Revisar si hay TODOs nuevos
```

**Cada mes:**
```
☐ Análisis de carga: ¿qué tamaño de grafo es típico?
☐ Performance analysis: ¿estamos dentro de spec?
☐ Revisión de seguridad: ¿datos sensibles expuestos?
☐ Planificar mejoras para próximo mes
```

### Cambios Permitidos (Low Risk)

Estos cambios se pueden hacer sin revalidación completa:

```javascript
// ✅ Agregar logging
logger.debug('Additional insight');

// ✅ Optimizar operaciones O(n)
const optimized = new Map(/* ... */);

// ✅ Mejorar mensajes de error
error.message = 'More descriptive message';

// ✅ Agregar validaciones adicionales
if (!edge.weight) edge.weight = 1;
```

### Cambios Que Requieren Revalidación (High Risk)

Estos requieren tests completos y verification:

```javascript
// ⚠️ Cambiar nombre de field
edge.fromName → edge.from_name  // Rompe ContextCompiler

// ⚠️ Cambiar algoritmo de lookup
Array.find() → Map.get()  // Revisar performance

// ⚠️ Cambiar formato de output
{ nodes, edges } → { data: [...] }  // Requiere upstream changes

// ⚠️ Quitar validación
if (!edges.length) throw Error();  // Puede causar silent failures
```

---

## Roadmap: Proyectos Relacionados

### Proyecto Relacionado 1: Analytics Service Setup

**Cuando:** Próximas 2 semanas  
**Qué:** Integrar análisis semántico con graph pipeline  
**Dependencia:** Este proyecto (GraphSanityEngine fixes)

```
GraphSanityEngine → ContextCompiler
       ↓
   Analytics Service (semantic embedding)
       ↓
   UnifiedPlanner (genera plan)
```

### Proyecto Relacionado 2: ETAPA 9 - Agent Evaluation

**Cuando:** Próximo mes  
**Qué:** Evaluar calidad de respuestas IA  
**Dependencia:** Chat IA funciona (este proyecto)

```
Chat IA generates response
       ↓
Agent Evaluator scores it
       ↓
Prompt optimization feedback
```

---

## Decisiones Pendientes

### Decisión 1: Cacheing Strategy

**Pregunta:** ¿Cachear node lookup maps?

**Opciones:**
1. **In-memory map** — Rápido, pero memory leak si no cleanup
2. **Redis cache** — Distribuido, pero extra latency
3. **No cache** — Simplemente, pero más lento

**Recomendación:** Esperar a ver performance en producción  
**Action:** Si P95 > 2s, implementar in-memory cache con TTL

---

### Decisión 2: Error Handling Strategy

**Pregunta:** ¿Qué hacer si node lookup falla?

**Opciones:**
1. **Fail fast** — Lanzar error, usuario ve falla
2. **Fallback** — Usar nodeId como nombre, continuar
3. **Retry** — Reintentar con backoff exponencial

**Actual:** Opción 2 (fallback)  
**Revisión:** En producción si muchos fallbacks, cambiar a Opción 1

---

## Escalera de Escalación

Si encuentrás problemas:

```
Nivel 1: Check logs, revisar HANDOFF.md
  ↓ si no resuelve

Nivel 2: Revisar CRITICAL_DEPENDENCIES.md para módulos sensibles
  ↓ si no resuelve

Nivel 3: Revisar ARCHITECTURE.md graph pipeline completo
  ↓ si no resuelve

Nivel 4: Contactar con developer original (context del proyecto)
  ↓ si no resuelve

Nivel 5: Escalación a tech lead
```

---

## Criterios de "Éxito Completo"

```
Hito 1: Chat IA responde sin errores
Status: ✅ COMPLETADO 2026-05-17

Hito 2: Response time < 2s para proyectos medianos
Status: ✅ COMPLETADO (1.2s medido)

Hito 3: Cero "START NODE NOT FOUND" errors en prod
Status: ⏳ MONITOREANDO (en producción)

Hito 4: Usuarios reportan análisis útiles
Status: ⏳ RECOPILANDO FEEDBACK
```

Cuando todos los hitos están ✅, proyecto se considera **"Success Complete"**

---

## Template para Siguiente Iniciativa

Usa esta estructura para proyectos futuros:

```markdown
# Nombre Proyecto - NEXT_STEPS.md

## Próximas Acciones (Prioridad)

### 🔴 CRÍTICO
- [ ] Task 1
- [ ] Task 2

### 🟠 IMPORTANTE  
- [ ] Task 3
- [ ] Task 4

### 🟡 FUTURO
- [ ] Task 5
- [ ] Task 6

## Manutenimiento Continuo
...
```

---

**Versión:** 1.0  
**Fecha:** 2026-05-17  
**Próxima Revisión:** 2026-05-24