# Auditoría de la sección de escenarios

## Alcance
Se revisó el flujo de escenarios desde el frontend y el backend, incluyendo carga inicial, selección desde la lista, edición, creación, cancelación, eliminación, bloqueo/desbloqueo y el uso de enlaces dentro de episodios.

## Hallazgos confirmados

### 1. Inconsistencia en el contrato de datos de escenarios
- El backend devolvía escenarios con `id` pero sin `_id` en varios puntos del flujo.
- El frontend usa `_id` para identificar la selección activa, comparar elementos en la lista y conservar el estado del escenario seleccionado.
- Esto podía provocar que la selección no se mantuviera correctamente o que el estado del panel se comportara de forma indefinida.

### 2. Problemas de selección y estado visual
- La lista de escenarios dependía de comparar `selectedScenario?._id === scenario._id`.
- Si el escenario seleccionado no llegaba con `_id`, el estado activo no se aplicaba correctamente.
- El efecto de carga inicial también podía sobrescribir la selección en algunos casos.

### 3. Riesgo de edición inconsistente
- El flujo de edición usa bloqueo y desbloqueo por escenario.
- Si el objeto seleccionado cambia de forma inesperada, el estado de edición y el lock pueden quedar desincronizados.
- La sección necesita un manejo más explícito de estado de selección y de edición.

### 4. Enlaces dentro de episodios
- El componente permite enlazar símbolos y escenarios desde la caja de episodios.
- El flujo depende de la lista `filteredLinkItemsEpisode` y del helper `insertLinkToItem`.
- Requiere una validación extra para evitar enlaces rotos o referencias vacías.

## Pruebas realizadas
- Revisión estática del flujo de carga inicial, selección de escenario, edición, creación, cancelación, eliminación y enlaces.
- Verificación de los contratos usados por el frontend y el backend.
- Ejecución de pruebas de regresión del backend.

## Estado actual
- Corregido: contrato de datos de escenarios para incluir `_id` y `id` de forma consistente.
- Verificado: pruebas backend pasan correctamente.

## Plan de resolución integral

### Fase 1 — Unificar el contrato de datos
- Normalizar todos los escenarios devueltos por el backend para incluir `_id` de forma consistente.
- Mantener `id` como alias compatible para evitar regresiones con otros puntos del sistema.
- Asegurar que la carga inicial del proyecto no sobrescriba la selección activa de forma inesperada.

### Fase 2 — Reforzar la selección de escenarios
- Introducir una función centralizada para seleccionar un escenario y sincronizar el estado visual.
- Evitar que la selección se pierda al cambiar filtros o al recargar datos.
- Asegurar que el detalle mostrado corresponda siempre al escenario seleccionado.

### Fase 3 — Estabilizar edición y bloqueo
- Reutilizar un único flujo para entrar/salir de modo edición.
- Desbloquear solo cuando el escenario activo aún coincide con el que se está editando.
- Evitar cancelaciones y guardados sobre escenarios que ya fueron reemplazados.

### Fase 4 — Mejorar la experiencia de creación y eliminación
- Limpiar el formulario al crear un nuevo escenario.
- Asegurar que la selección cambie a un elemento válido después de crear, borrar o cancelar.
- Mostrar mensajes de estado claros para cada operación.

### Fase 5 — Fortalecer enlaces en episodios
- Validar que los elementos seleccionados existan antes de insertar un enlace.
- Evitar referencias vacías o duplicadas en el contenido de episodios.
- Asegurar que el contenido enlazado sea renderizado de forma consistente.

## Priorización
1. Contrato de datos y selección.
2. Edición y bloqueo.
3. Creación, cancelación y eliminación.
4. Enlaces dentro de episodios.
