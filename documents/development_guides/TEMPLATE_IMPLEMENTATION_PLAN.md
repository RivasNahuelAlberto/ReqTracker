# 📋 Template: IMPLEMENTATION_PLAN.md

> **Este es un template para documentar procesos de desarrollo en ReqTracker.**
> Copiar esta estructura a cada carpeta de proyecto en `development_guides/`

---

## Nombre del Proyecto / Iniciativa

**Última actualización:** [FECHA]  
**Estado:** [PLANIFICADO | EN PROGRESO | REVISIÓN | COMPLETADO]  
**Responsables:** [Agente/Desarrollador]

---

## 1. Objetivo General

Descripción clara y concisa del qué se busca lograr.

**Impacto esperado:**
- Item 1
- Item 2

---

## 2. Contexto Funcional y Técnico

### Problema que resuelve
Explicá brevemente el problema actual y por qué es importante abordarlo.

### Beneficios principales
- Beneficio 1
- Beneficio 2

### Stakeholders afectados
- Frontend developers
- Backend developers
- End users

---

## 3. Alcance

### Incluye:
- [Qué SÍ abarca]
- [Qué SÍ abarca]

### Excluye:
- [Qué NO abarca]
- [Qué NO abarca]

---

## 4. Arquitectura Involucrada

### Subsistemas afectados
- Frontend (componentes específicas)
- Backend (rutas/servicios específicas)
- Analytics (si aplica)
- BD (esquemas a modificar)

### Responsabilidades de cada capa
| Capa | Responsabilidad |
|------|-----------------|
| Frontend | [Qué hace] |
| Backend | [Qué hace] |
| Analytics | [Qué hace] |

### Dependencias críticas
- Listar módulos que DEPENDEN de los cambios
- Listar módulos DE LOS CUALES dependen los cambios

---

## 5. Análisis de Impacto

### Impacto en BD
- [ ] Nuevas colecciones
- [ ] Cambios de esquema
- [ ] Migraciones necesarias

### Impacto en API
- [ ] Nuevos endpoints
- [ ] Cambios en endpoints existentes
- [ ] Cambios en response format

### Impacto en UI
- [ ] Nuevos componentes
- [ ] Cambios en componentes existentes
- [ ] Nuevas páginas

### Impacto en Analytics
- [ ] Nuevos análisis
- [ ] Cambios en datos de entrada
- [ ] Nuevos endpoints

### Requerimientos de compatibilidad
- [ ] Backward compatibility? ¿Cómo?
- [ ] Migraciones de datos?
- [ ] Versionamiento de API?

---

## 6. Riesgos Identificados

| Riesgo | Severidad | Mitigación |
|--------|-----------|-----------|
| [Riesgo 1] | [Alta/Media/Baja] | [Cómo mitigarlo] |
| [Riesgo 2] | [Alta/Media/Baja] | [Cómo mitigarlo] |

---

## 7. Estrategia de Implementación

### Enfoque general
Descripción de cómo abordarás el proyecto.

### Fases de trabajo

#### Fase 1: [Nombre]
- Duración estimada: [Tiempo]
- Tareas principales:
  - [ ] Tarea 1
  - [ ] Tarea 2
  - [ ] Tarea 3
- Deliverables:
  - [Deliverable 1]

#### Fase 2: [Nombre]
- Duración estimada: [Tiempo]
- Tareas principales:
  - [ ] Tarea 1
  - [ ] Tarea 2
- Deliverables:
  - [Deliverable 1]

---

## 8. Checklist Detallado

### Tareas de Diseño
- [ ] Diseñar arquitectura general
- [ ] Validar con equipo
- [ ] Documentar decisiones

### Tareas de Implementación - Backend
- [ ] Crear/modificar modelos en `backend/models/`
- [ ] Crear/modificar rutas en `backend/routes/`
- [ ] Crear/modificar servicios en `backend/ai/`
- [ ] Agregar validaciones
- [ ] Agregar manejo de errores
- [ ] Testar endpoints en Postman/Insomnia

### Tareas de Implementación - Frontend
- [ ] Crear/modificar componentes en `frontend/src/components/`
- [ ] Crear/modificar páginas en `frontend/src/pages/`
- [ ] Agregar funciones en `frontend/src/api.js`
- [ ] Testar UI en navegador
- [ ] Validar responsive design

### Tareas de Integración
- [ ] Sincronizar Backend ↔ Frontend
- [ ] Testar flujos end-to-end
- [ ] Testar Socket.io sync
- [ ] Testar error handling

### Tareas de Testing
- [ ] Escribir unit tests
- [ ] Escribir integration tests
- [ ] Testar casos edge
- [ ] Testar con datos reales

### Tareas de Documentación
- [ ] Documentar cambios en code
- [ ] Actualizar `documents/TECHNICAL_OVERVIEW.md` si arquitectura cambió
- [ ] Actualizar `documents/MODULES_AND_LAYERS.md` si estructura cambió
- [ ] Actualizar `documents/CHANGE_GUIDE.md` si flujos cambiaron

### Tareas de Deployment
- [ ] Testar en staging (si existe)
- [ ] Preparar migration scripts (si BD cambió)
- [ ] Documentar pasos de deployment
- [ ] Deploy a producción

### Post-Deployment
- [ ] Monitorear logs en producción
- [ ] Validar que funciona correctamente
- [ ] Recopilar feedback de usuarios

---

## 9. Criterios de Aceptación

### Funcionales
- [ ] Criterio 1
- [ ] Criterio 2
- [ ] Criterio 3

### No-Funcionales
- [ ] Performance dentro de SLA
- [ ] Backward compatible con datos existentes
- [ ] No regresiones en features existentes

### Testing
- [ ] Tests unitarios pasan
- [ ] Tests de integración pasan
- [ ] No errores en logs de prod

---

## 10. Decisiones Arquitectónicas

### Decisión 1: [Nombre]
**Opción A:** [Descripción]  
**Opción B:** [Descripción]  
**Elegida:** Opción [A|B]  
**Razón:** [Por qué se eligió]

### Decisión 2: [Nombre]
**Opción A:** [Descripción]  
**Opción B:** [Descripción]  
**Elegida:** Opción [A|B]  
**Razón:** [Por qué se eligió]

---

## 11. Convenciones Específicas del Proyecto

### Naming
- Variables: `camelCase`
- Componentes React: `PascalCase`
- Rutas API: `/api/resource/sub-resource`

### Patrones
- Modelos MongoDB: Usar Mongoose schema con validaciones
- Routes: Coordinación + delegación a services
- Components: Presentación + handlers
- Services: Lógica pura sin side-effects

### Error Handling
- Backend: Retornar `{ message, details, code }`
- Frontend: Mostrar error en UI + log en console

---

## 12. Documentación de Configuración

### Variables de entorno nuevas
Si agregas nuevas env vars, documentalas aquí:

```
VAR_NAME=description-and-usage
```

### Cambios en docker-compose.yml
Si necesitás agregar servicios o cambiar configuración.

### Cambios en dependencias
Lista de paquetes nuevos a instalar:
```json
{
  "new-package": "^1.0.0"
}
```

---

## 13. Consideraciones Críticas

### NUNCA
- ❌ Hardcodear URLs (usar env vars)
- ❌ Confiar en validación solo frontend (siempre backend)
- ❌ Modificar BD sin migraciones
- ❌ Commitear `.env` con valores reales
- ❌ Ignorar error handling

### Siempre
- ✅ Validar en backend
- ✅ Sincronizar con Socket.io si BD cambia
- ✅ Testear edge cases
- ✅ Loguear decisiones importantes
- ✅ Documentar cambios

---

## Roadmap de Documentos Relacionados

Este IMPLEMENTATION_PLAN.md es el documento rector. Los siguientes documentos DEBEN mantener coherencia con él:

- **[PROGRESS.md](./PROGRESS.md)** — Avance actual
- **[HANDOFF.md](./HANDOFF.md)** — Estado para transferencia
- **[NEXT_STEPS.md](./NEXT_STEPS.md)** — Próximos pasos operativos

---

## Instrucciones para Futuros Desarrolladores/Agentes

1. **Lee IMPLEMENTATION_PLAN.md primero** — Es la fuente de verdad
2. **Revisa PROGRESS.md** — Ve qué ya está hecho
3. **Consulta HANDOFF.md** — Entiende el estado actual
4. **Ejecuta NEXT_STEPS.md** — Sabés qué hacer ahora
5. **Antes de cambiar algo**, volvé a este plan y validá impacto

---

**Versión:** 1.0  
**Creado:** [FECHA]  
**Últim actualización:** [FECHA]
