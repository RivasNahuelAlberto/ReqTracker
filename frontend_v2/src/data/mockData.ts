// Central mock data for prototype — shared across all tab components

export const MOCK_PROJECT: Record<string, { name: string; description: string; about: { intro: string; items: string[] } }> = {
  p1: {
    name: 'Sistema de Gestión Académica',
    description: 'Plataforma de gestión de materias, alumnos y calificaciones para universidad pública.',
    about: {
      intro: 'El Sistema de Gestión Académica (SGA) es una plataforma integral que permite administrar el ciclo académico completo de la institución, incluyendo inscripciones, calificaciones, asistencia y comunicación entre actores.',
      items: [
        'Gestión de alumnos, docentes y materias en un único sistema centralizado.',
        'Control de correlatividades y habilitación de inscripciones por período.',
        'Carga y consulta de calificaciones con auditoría completa.',
        'Notificaciones automáticas por email ante eventos académicos relevantes.',
        'Reportes exportables en CSV y PDF para administradores.',
      ],
    },
  },
  p2: {
    name: 'Portal de Pacientes Salud+',
    description: 'Sistema de turnos y expedientes médicos para red de clínicas.',
    about: { intro: 'Sistema de gestión hospitalaria.', items: [] },
  },
  p3: {
    name: 'ERP Manufactura Integral',
    description: 'Módulos de producción, inventario y logística para planta industrial.',
    about: { intro: 'ERP para manufactura.', items: [] },
  },
  p4: {
    name: 'App Delivery Barrio',
    description: 'Plataforma de pedidos y seguimiento para comercios locales.',
    about: { intro: 'Plataforma de delivery.', items: [] },
  },
}

export const MOCK_SYMBOLS = [
  { _id: 's1', name: 'Usuario', type: 'Sujeto', order: '1', status: 'complete', isSeed: true, parentSymbol: '', reviewNotes: '', notion: 'Persona que interactúa con el sistema para realizar operaciones académicas. Puede ser alumno, docente o administrativo.', impact: 'Accede a su perfil académico.\nConsulta horarios y calificaciones.\nPuede inscribirse a materias dentro del período habilitado.' },
  { _id: 's2', name: 'Administrador', type: 'Sujeto', order: '2', status: 'complete', isSeed: true, parentSymbol: '', reviewNotes: '', notion: 'Personal técnico con privilegios de configuración del sistema y gestión de cuentas de usuario.', impact: 'Gestiona usuarios y roles.\nConfigura períodos de inscripción.\nGenera reportes de actividad del sistema.' },
  { _id: 's3', name: 'Alumno', type: 'Sujeto', order: '3', status: 'complete', isSeed: false, parentSymbol: 's1', reviewNotes: '', notion: 'Estudiante matriculado en la institución que puede inscribirse a materias y consultar su historial académico.', impact: 'Inscripción a materias habilitadas.\nVisualización de calificaciones y asistencia.\nAcceso a materiales del docente.' },
  { _id: 's4', name: 'Docente', type: 'Sujeto', order: '4', status: 'review', isSeed: false, parentSymbol: 's1', reviewNotes: 'Revisar impacto: falta especificar cómo gestiona las correlatividades de los alumnos.', notion: 'Profesor responsable de una o más materias, encargado de cargar calificaciones y gestionar asistencia.', impact: 'Carga de calificaciones y notas parciales.\nGestión de listas de asistencia.\nAcceso a información de alumnos inscriptos.' },
  { _id: 's5', name: 'Materia', type: 'Objeto', order: '5', status: 'complete', isSeed: false, parentSymbol: 's2', reviewNotes: '', notion: 'Unidad académica dictada por un docente dentro de un período semestral.', impact: 'Define el plan de estudio.\nTiene cupos limitados.\nHabilita inscripciones según correlatividades.' },
  { _id: 's6', name: 'Calificación', type: 'Objeto', order: '6', status: 'complete', isSeed: false, parentSymbol: 's4', reviewNotes: '', notion: 'Valoración numérica o conceptual que el docente asigna al desempeño del alumno en una materia.', impact: 'Determina la aprobación.\nSe registra en el historial.\nPuede impugnarse dentro del período establecido.' },
  { _id: 's7', name: 'Inscripción', type: 'Verbo', order: '7', status: 'incomplete', isSeed: false, parentSymbol: 's3', reviewNotes: 'Pendiente: definir flujo de lista de espera y criterio de priorización.', notion: 'Proceso por el cual el alumno se registra en una materia para el semestre vigente.', impact: 'Requiere correlatividades aprobadas.\nSujeta a cupo disponible.\nGenera notificación al docente.' },
  { _id: 's8', name: 'Validar', type: 'Verbo', order: '8', status: 'review', isSeed: false, parentSymbol: 's7', reviewNotes: 'Ambigüedad detectada: especificar criterios concretos de validación por entidad.', notion: 'Verificar que los datos ingresados cumplen con las reglas del sistema antes de persistirlos.', impact: 'Previene inconsistencias.\nGenera mensajes de error claros.\nSe ejecuta en cliente y servidor.' },
  { _id: 's9', name: 'Estado de Cursado', type: 'Estado', order: '9', status: 'complete', isSeed: false, parentSymbol: 's3', reviewNotes: '', notion: 'Situación académica del alumno respecto a una materia: pendiente, en curso, aprobada, reprobada.', impact: 'Determina habilitación para cursar materias correlativas.\nSe actualiza automáticamente al cierre del período.' },
]

export const MOCK_SCENARIOS = [
  { _id: 'sc1', type: 'Escenario', title: 'Login de Usuario', order: '1', objective: 'El usuario accede al sistema mediante sus credenciales y obtiene una sesión autenticada.', status: 'complete', actors: 'Usuario', preconditions: 'El usuario debe estar registrado en el sistema.', resources: 'Módulo de autenticación, base de datos de usuarios.', locationTemporal: 'Al inicio de cada sesión', locationGeographic: 'Aplicación web o móvil', episodes: '1. El usuario navega a la pantalla de login.\n2. Ingresa su usuario y contraseña.\n3. El sistema valida las credenciales.\n4. Si son correctas, se genera un token de sesión.\n5. El sistema redirige al dashboard principal.', exceptions: 'Credenciales inválidas: se muestra mensaje de error y se bloquea tras 5 intentos.' },
  { _id: 'sc2', type: 'Escenario', title: 'Inscripción a Materia', order: '2', objective: 'El alumno se inscribe a una materia habilitada dentro del período de inscripciones vigente.', status: 'review', actors: 'Alumno', preconditions: 'Período de inscripción abierto. Alumno con correlativas aprobadas. Cupo disponible en la materia.', resources: 'Sistema de correlativas, cupos por materia.', locationTemporal: 'Durante el período de inscripciones', locationGeographic: 'Portal web del alumno', episodes: '1. El alumno accede al módulo de inscripciones.\n2. Visualiza el listado de materias disponibles.\n3. Selecciona una materia con cupo.\n4. El sistema verifica correlatividades.\n5. Se confirma la inscripción y se actualiza el cupo.', exceptions: 'Sin cupo disponible: se agrega a lista de espera. Correlativas insuficientes: se muestra alerta.' },
  { _id: 'sc3', type: 'Escenario', title: 'Carga de Calificaciones', order: '3', objective: 'El docente ingresa las calificaciones finales de los alumnos inscriptos en su materia.', status: 'complete', actors: 'Docente', preconditions: 'Período de carga abierto por el administrador. Docente asignado a la materia.', resources: 'Lista de alumnos inscriptos, formulario de notas.', locationTemporal: 'Al cierre del período académico', locationGeographic: 'Panel docente', episodes: '1. El docente accede a su panel de materias.\n2. Selecciona la materia y el tipo de evaluación.\n3. Ingresa la calificación para cada alumno.\n4. Confirma y guarda el registro.\n5. El sistema notifica a los alumnos.', exceptions: 'Período cerrado: la carga es rechazada. Calificación fuera de rango: validación falla.' },
  { _id: 'sc4', type: 'Subescenario', title: 'Validación de Correlativas', order: '2.1', objective: 'Verificar que el alumno cumple con las correlatividades requeridas para la inscripción.', status: 'complete', actors: 'Sistema', preconditions: 'Solicitud de inscripción iniciada.', resources: 'Historial académico del alumno, tabla de correlativas.', locationTemporal: 'Durante la inscripción', locationGeographic: 'Backend del sistema', episodes: '1. El sistema obtiene el historial académico del alumno.\n2. Compara con las correlativas requeridas.\n3. Determina si están todas aprobadas.\n4. Retorna resultado de la validación.', exceptions: 'Error de base de datos: se reporta fallo técnico.' },
  { _id: 'sc5', type: 'Episodio', title: 'Notificación por Email', order: '2.1.1', objective: 'Enviar confirmación de inscripción al correo del alumno.', status: 'incomplete', actors: 'Sistema de notificaciones', preconditions: 'Inscripción confirmada. Email del alumno registrado.', resources: 'Servidor SMTP, plantilla de email.', locationTemporal: 'Inmediatamente después de confirmar inscripción', locationGeographic: 'Servidor de notificaciones', episodes: '1. Sistema genera email de confirmación.\n2. Envía al servidor SMTP.\n3. Registra el envío en el log.', exceptions: 'SMTP no disponible: reintento hasta 3 veces, luego registra el fallo.' },
]

export const MOCK_REQUIREMENTS = [
  { _id: 'r1', identifier: 'RF-001', name: 'Autenticación con JWT', type: 'Funcional', priority: 'Alta', status: 'complete', description: 'El sistema debe autenticar usuarios mediante JWT con tiempo de expiración configurable.', basis: 'Entrevista con administrador del sistema (2024-09-10)', criticidad: 'Alta', volatilidad: 'Baja', factibilidad: 'Alta', riesgo: 'Bajo', costoImplementacion: 'Medio' },
  { _id: 'r2', identifier: 'RF-002', name: 'Inscripción en línea', type: 'Funcional', priority: 'Alta', status: 'complete', description: 'Los alumnos deben poder inscribirse a materias durante el período habilitado.', basis: 'Requerimiento de alumnos y decanato', criticidad: 'Alta', volatilidad: 'Media', factibilidad: 'Alta', riesgo: 'Bajo', costoImplementacion: 'Alto' },
  { _id: 'r3', identifier: 'RF-003', name: 'Carga de calificaciones', type: 'Funcional', priority: 'Alta', status: 'review', description: 'Los docentes deben poder ingresar y modificar calificaciones hasta el cierre del período.', basis: 'Normativa académica vigente', criticidad: 'Alta', volatilidad: 'Baja', factibilidad: 'Alta', riesgo: 'Medio', costoImplementacion: 'Medio' },
  { _id: 'r4', identifier: 'RNF-001', name: 'Tiempo de respuesta < 2s', type: 'No Funcional', priority: 'Media', status: 'complete', description: 'Las operaciones críticas deben completarse en menos de 2 segundos bajo carga normal.', basis: 'Estándar de usabilidad institucional', criticidad: 'Media', volatilidad: 'Baja', factibilidad: 'Alta', riesgo: 'Bajo', costoImplementacion: 'Bajo' },
  { _id: 'r5', identifier: 'RNF-002', name: 'Disponibilidad 99.5%', type: 'No Funcional', priority: 'Alta', status: 'review', description: 'El sistema debe estar disponible el 99.5% del tiempo en horario académico.', basis: 'SLA con proveedor de infraestructura', criticidad: 'Alta', volatilidad: 'Baja', factibilidad: 'Media', riesgo: 'Alto', costoImplementacion: 'Alto' },
  { _id: 'r6', identifier: 'RF-004', name: 'Exportación de listados', type: 'Funcional', priority: 'Baja', status: 'incomplete', description: 'Docentes y administradores deben poder exportar listados en formato CSV y PDF.', basis: 'Solicitud de secretaría académica', criticidad: 'Baja', volatilidad: 'Alta', factibilidad: 'Alta', riesgo: 'Bajo', costoImplementacion: 'Bajo' },
  { _id: 'r7', identifier: 'RS-001', name: 'Auditoría de accesos', type: 'Seguridad', priority: 'Alta', status: 'incomplete', description: 'Todo acceso y modificación debe quedar registrado con usuario, IP y timestamp.', basis: 'Política de seguridad institucional', criticidad: 'Alta', volatilidad: 'Baja', factibilidad: 'Alta', riesgo: 'Medio', costoImplementacion: 'Medio' },
]

export const MOCK_TASKS = [
  { _id: 't1', description: 'Revisar y completar la noción del símbolo "Docente"', priority: 1, targetType: 'symbol', targetId: 's4', targetLabel: 'Docente', status: 'pending', createdAt: '2025-06-10' },
  { _id: 't2', description: 'Agregar episodios faltantes al escenario "Inscripción a Materia"', priority: 2, targetType: 'scenario', targetId: 'sc2', targetLabel: 'Inscripción a Materia', status: 'pending', createdAt: '2025-06-11' },
  { _id: 't3', description: 'Definir requisito de seguridad para auditoría (RS-001)', priority: 1, targetType: 'requirement', targetId: 'r7', targetLabel: 'RS-001', status: 'pending', createdAt: '2025-06-12' },
  { _id: 't4', description: 'Completar escenario de notificación por email', priority: 3, targetType: 'scenario', targetId: 'sc5', targetLabel: 'Notificación por Email', status: 'pending', createdAt: '2025-06-14' },
]

export const MOCK_INSPECTIONS = [
  { _id: 'i1', aspect: 'Ambigüedad', description: 'El símbolo "Validar" carece de definición precisa del criterio de validación. No queda claro qué constituye un dato inválido.', targetLabel: 'Validar', targetType: 'symbol', targetId: 's8', createdAt: '2025-06-10', status: 'open' },
  { _id: 'i2', aspect: 'Completitud', description: 'El escenario "Notificación por Email" no especifica el tiempo máximo de entrega del email ni el comportamiento ante fallo definitivo.', targetLabel: 'Notificación por Email', targetType: 'scenario', targetId: 'sc5', createdAt: '2025-06-15', status: 'open' },
  { _id: 'i3', aspect: 'Consistencia', description: 'El RF-003 menciona "período" pero no hay una definición formal de "período académico" en el léxico del sistema.', targetLabel: 'RF-003', targetType: 'requirement', targetId: 'r3', createdAt: '2025-06-18', status: 'open' },
]

export const MOCK_RESOLVE_NOTES = [
  { _id: 'rn1', text: 'Definir concretamente qué constituye un "período académico" y agregarlo al léxico como símbolo de tipo Objeto.', status: 'pending', createdAt: '2025-06-10' },
  { _id: 'rn2', text: 'Revisar si el símbolo "Validar" necesita ser dividido en múltiples acciones específicas (ValidarCredenciales, ValidarDatos, etc.).', status: 'pending', createdAt: '2025-06-12' },
  { _id: 'rn3', text: 'Acordar con el cliente el criterio de aprobación mínimo para calificaciones (¿6 sobre 10 o 4 sobre 10?).', status: 'resolved', createdAt: '2025-06-08' },
  { _id: 'rn4', text: 'Determinar si la "lista de espera" de inscripciones requiere un escenario propio o es suficiente como excepción.', status: 'pending', createdAt: '2025-06-16' },
]

export const MOCK_DOCUMENTS = [
  { id: 'doc1', name: 'Especificación de Requisitos SRS', type: 'texto', description: 'Documento principal de especificación de requisitos del sistema. Contiene todos los requisitos funcionales, no funcionales y de seguridad identificados en la primera fase del proyecto.', extension: '', fileName: '', content: '' },
  { id: 'doc2', name: 'Diagrama de Casos de Uso', type: 'archivo', description: 'Diagrama UML de casos de uso del sistema. Incluye actores principales y sus relaciones con los casos de uso identificados.', extension: 'pdf', fileName: 'casos_uso_v2.pdf', content: 'Contenido extraído del PDF: Diagrama de casos de uso versión 2.0. Actores: Usuario, Administrador, Docente, Alumno. Casos de uso principales: Autenticar, Inscribir, Calificar, Gestionar...' },
  { id: 'doc3', name: 'Glosario del Dominio Académico', type: 'texto', description: 'Glosario de términos técnicos y del negocio utilizados en el proyecto. Sirve como referencia para todo el equipo de desarrollo y stakeholders.', extension: '', fileName: '', content: '' },
  { id: 'doc4', name: 'Acta de Reunión — Kick-off', type: 'archivo', description: 'Acta de la reunión inicial con el cliente. Incluye objetivos, restricciones y próximos pasos acordados.', extension: 'docx', fileName: 'acta_kickoff_2024-09-10.docx', content: 'Asistentes: Lic. Pérez (cliente), Ing. García (PO), Dr. Rodríguez (cliente), Ana López (BA).\n\nTemas tratados:\n1. Objetivos del proyecto y alcance inicial\n2. Restricciones tecnológicas\n3. Cronograma tentativo\n4. Próximos pasos: entrevistas con usuarios finales' },
]

export const MOCK_USERS = [
  { _id: 'u1', username: 'carlos.mendez', email: 'carlos@empresa.com', role: 'admin', joined: '2024-09-12' },
  { _id: 'u2', username: 'ana.rodriguez', email: 'ana@empresa.com', role: 'usuario', joined: '2024-09-15' },
  { _id: 'u3', username: 'lucas.garcia', email: 'lucas@empresa.com', role: 'usuario', joined: '2024-11-02' },
  { _id: 'u4', username: 'invitado42', email: 'inv42@empresa.com', role: 'invitado', joined: '2025-01-10' },
]

export const MOCK_CONVERSATIONS = [
  { _id: 'c1', title: 'Análisis de inconsistencias léxicas', date: '2025-06-14' },
  { _id: 'c2', title: 'Revisión de escenarios de inscripción', date: '2025-06-17' },
  { _id: 'c3', title: 'Sugerencias de requisitos no funcionales', date: '2025-06-20' },
]

export const MOCK_CHAT_MESSAGES = [
  { role: 'user', content: '¿Qué inconsistencias detectas en el léxico del proyecto?', timestamp: '14:23' },
  { role: 'assistant', content: 'He analizado el léxico del proyecto. Encontré las siguientes inconsistencias:\n\n1. **"Validar" (Verbo)** — La noción carece de criterios específicos de validación.\n\n2. **"Estado de Cursado"** — El símbolo no tiene un enlace explícito a "Materia" en su definición.\n\n3. **Símbolo faltante** — No hay un símbolo para "Período Académico", que es referenciado en varios escenarios y requisitos.', timestamp: '14:24' },
  { role: 'user', content: '¿Podés proponer una noción para "Período Académico"?', timestamp: '14:26' },
  { role: 'assistant', content: '**Período Académico (Objeto)**\n\n*Noción:* Lapso de tiempo delimitado por fechas de inicio y fin en el que se desarrollan las actividades de cursado, inscripción y evaluación. Se identifica por un código (ej: 2025-1S).\n\n*Impacto:* Define las ventanas de inscripción para alumnos. Habilita la carga de calificaciones por parte de docentes.', timestamp: '14:27' },
]

export const STATUS_BADGE: Record<string, string> = {
  complete: 'badge-green', review: 'badge-amber', incomplete: 'badge-red', open: 'badge-red', active: 'badge-blue', pending: 'badge-amber', resolved: 'badge-green',
}

export const STATUS_LABEL: Record<string, string> = {
  complete: 'Completo', review: 'Revisión', incomplete: 'Incompleto', open: 'Abierto', active: 'Activo', pending: 'Pendiente', resolved: 'Resuelto',
}
