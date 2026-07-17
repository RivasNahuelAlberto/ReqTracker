# Plan de trabajo incremental para el pipeline de IA

## Fase 1 — Corregir el flujo de ejecución de tools
- [x] Normalizar los argumentos que llegan desde el planner antes de ejecutar cada tool.
- [x] Traducir nombres textuales como "Solicitud de Compra" a la firma real del tool (`symbolName`, `projectId`, etc.).
- [x] Evitar que herramientas fallen por argumentos incompletos.

## Fase 2 — Mejorar la identificación de entidades
- [ ] Resolver de forma explícita si la referencia es un símbolo, requisito, escenario o elemento de otro tipo.
- [ ] Usar esa resolución antes de invocar tools analíticos.
- [ ] Devolver resultados con entidad resuelta + tipo + id cuando sea posible.

## Fase 3 — Refactorizar el modelo de datos
- [ ] Desacoplar Project de subcolecciones embebidas en modelos propios.
- [ ] Mover `scenarios`, `documents`, `tasks`, `inspections`, `requirements`, `resolveNotes` a colecciones separadas con referencias.
- [ ] Mantener compatibilidad temporal con lectura/escritura mientras se migra.

## Fase 4 — Separar embeddings y trazabilidad
- [ ] Crear un modelo propio para embeddings por entidad.
- [ ] Referenciar el embedding desde el objeto propietario en vez de embebirlo directamente.
- [ ] Revisar consultas y pipelines para no depender de estructuras densas.

## Fase 5 — Revalidar con pruebas y logs
- [ ] Añadir pruebas para la normalización de argumentos.
- [ ] Añadir pruebas para la resolución de entidades.
- [ ] Repetir flujos completos desde `/chat/stream` y verificar resultados.
