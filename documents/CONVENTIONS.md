# 📏 ReqTracker - Code Conventions & Standards

**Última actualización:** 2026-05-17

> **Estándares de código, naming, organización, patrones que observamos en ReqTracker**

---

## Tabla de Contenidos

1. [Convenciones de Naming](#convenciones-de-naming)
2. [Organización de Carpetas](#organización-de-carpetas)
3. [Estructura de Componentes (React)](#estructura-de-componentes-react)
4. [Estructura de Services (Node.js)](#estructura-de-services-nodejs)
5. [DTOs y Contracts](#dtos-y-contracts)
6. [Error Handling](#error-handling)
7. [Logging](#logging)
8. [Type Safety y Validación](#type-safety-y-validación)
9. [Testing](#testing)
10. [Anti-patterns Observados](#anti-patterns-observados)

---

## Convenciones de Naming

### Variables y Funciones

```javascript
// ✅ Buen naming (camelCase)
const userProject = await Project.findById(userId);
const projectSymbols = project.symbols;
const calculateNodeScore = (node) => { ... };

// ❌ Mal naming (PascalCase para variables)
const UserProject = await Project.findById(userId);  // NO
const PROJECTSYMBOLS = project.symbols;              // NO
const calculateNodeScore_v2 = () => { ... };         // NO, evitar _v2

// ✅ Boolean prefixes (is*, has*, can*)
const isValidSymbol = (symbol) => { ... };
const hasProjectAccess = (user, projectId) => { ... };
const canCreateSymbol = (user) => { ... };

// ❌ Evitar
const valid = (symbol) => { ... };     // Ambiguo
const access = (user, project) => { }; // No claro
```

### Constantes

```javascript
// ✅ UPPER_SNAKE_CASE
const MAX_SYMBOLS_PER_PROJECT = 1000;
const DEFAULT_THEME = 'light';
const GRAPH_COMPRESSION_RATIO = 0.05;  // Reducir 20x

// ✅ Enums/tipos
const SYMBOL_TYPES = {
  SUBJECT: 'Sujeto',
  OBJECT: 'Objeto',
  VERB: 'Verbo'
};

const VALIDATION_ERRORS = {
  REQUIRED_FIELD: 'Este campo es obligatorio',
  INVALID_TYPE: 'El tipo no es válido',
  DUPLICATE_NAME: 'El nombre ya existe'
};

// ❌ Evitar
const types = ['Sujeto', 'Objeto'];  // No descriptivo
const ERR_1 = 'Error';               // No claro
```

### Archivos y Carpetas

```javascript
// ✅ Kebab-case para archivos
├── graph-sanity-engine.service.js
├── context-compiler.js
├── unified-planner.service.js
├── planner-contract-enforcer.js
└── symbol-validator.js

// ✅ PascalCase para componentes React
├── ProjectPage.jsx
├── AIChat.jsx
├── RelationMap.jsx
├── AuthContext.jsx
└── RoleManagement.jsx

// ✅ Nombres descriptivos
├── backend/routes/projects.js   ← Describe qué es
│   (NO: router.js, api.js)
└── backend/ai/tools/project.tool.js  ← Específico

// ❌ Nombres genéricos
├── utils.js            (¿qué utilities?)
├── helper.js           (¿qué ayuda?)
└── index.js (en routes/)  (¿cuál index?)
```

### React Componentes

```javascript
// ✅ Nombre descriptivo + -Component si es util
export function ProjectPage() { ... }       // Página
export function AIChat() { ... }            // Feature principal
export function RelationMap() { ... }       // Feature principal
export function ReloadNotification() { ... }// Notificación util
export function SymbolCard() { ... }        // Componente reutilizable

// ❌ Nombres vagos
export function Component() { ... }         // NO
export function Comp() { ... }              // NO
export function UI() { ... }                // NO
```

---

## Organización de Carpetas

### Backend Estructura Estándar

```
backend/
├── routes/                    # REST endpoints
│   ├── projects.js           (CRUD proyectos)
│   ├── symbols.js            (CRUD símbolos)
│   └── index.js              (importar + registrar todas)
│
├── ai/                        # Inteligencia artificial
│   ├── controllers/          (Orquestación)
│   │   ├── ai.controller.js
│   │   └── recommendation.controller.js
│   │
│   ├── services/             (Lógica pesada)
│   │   ├── graph-sanity-engine.service.js
│   │   ├── context-compiler.js
│   │   ├── unified-planner.service.js
│   │   ├── chat.service.js
│   │   └── index.js          (exportar todas)
│   │
│   ├── tools/                (Funciones para LLM)
│   │   ├── index.js          (registry)
│   │   ├── project.tool.js
│   │   ├── symbol.tool.js
│   │   ├── semantic.tool.js
│   │   └── graph.tool.js
│   │
│   ├── prompts/              (Strings largos)
│   │   └── system.prompt.js
│   │
│   └── logger/               (Logging centralizado)
│       └── structured-logger.js
│
├── models/                    # Mongoose schemas
│   ├── Project.js
│   ├── Symbol.js
│   ├── Relation.js
│   ├── User.js (si auth)
│   └── index.js              (exportar todas)
│
├── middleware/                # Express middlewares
│   ├── auth.js               (JWT validation)
│   └── error-handler.js      (error middleware)
│
├── index.js                   # Entry point
├── .env.example              # Template
└── package.json
```

### Frontend Estructura Estándar

```
frontend/src/
├── pages/                     # Componentes top-level (páginas)
│   ├── Home.jsx              (Landing, crear/listar proyectos)
│   ├── ProjectPage.jsx       (Editor principal)
│   └── LoginPage.jsx         (Si auth)
│
├── components/                # Componentes reutilizables
│   ├── AIChat.jsx            (UI chat)
│   ├── RelationMap.jsx       (Visualización grafo)
│   ├── AuthContext.jsx       (Contexto auth)
│   ├── RoleManagement.jsx    (Gestión roles si RBAC)
│   └── ReloadNotification.jsx (Notificación RT)
│
├── hooks/                     # React hooks custom (si existen)
│   └── useProject.js
│
├── api.js                     # HTTP client centralizado
├── App.jsx                    # Router principal
├── main.jsx                   # Bootstrap React
├── styles.css                 # CSS global
└── index.html
```

### Regla: ¿Dónde va este archivo?

| Tipo | Ubicación | Ejemplo |
|------|-----------|---------|
| Componente de página | `pages/` | `ProjectPage.jsx` |
| Componente reutilizable | `components/` | `RelationMap.jsx` |
| Lógica HTTP | `api.js` | `fetchProject()` |
| Lógica de negocio | `services/` | `graph-sanity-engine.js` |
| HTTP endpoint | `routes/` | `projects.js` |
| Esquema BD | `models/` | `Project.js` |
| Middleware | `middleware/` | `auth.js` |
| Configuración | Raíz | `.env`, `.env.example` |

---

## Estructura de Componentes (React)

### Template Componente Funcional

```javascript
// frontend/src/components/MyComponent.jsx

import { useState, useEffect, useCallback } from 'react';
import './MyComponent.css';  // Estilos locales (si existen)

/**
 * Descripción breve de qué hace el componente.
 * 
 * @param {Object} props
 * @param {string} props.title - Título del componente
 * @param {Array} props.items - Items a renderizar
 * @param {Function} props.onItemClick - Callback cuando se clickea item
 * @returns {JSX.Element}
 */
export function MyComponent({ title, items = [], onItemClick }) {
  // 1. State
  const [selectedId, setSelectedId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // 2. Effects (data fetching, suscripciones)
  useEffect(() => {
    // Setup
    const handleWindowResize = () => {
      console.log('Window resized');
    };
    window.addEventListener('resize', handleWindowResize);
    
    // Cleanup
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  // 3. Callbacks
  const handleSelectItem = useCallback((itemId) => {
    setSelectedId(itemId);
    onItemClick?.(itemId);
  }, [onItemClick]);

  // 4. Computations
  const selectedItem = items.find(item => item.id === selectedId);

  // 5. Render
  return (
    <div className="my-component">
      <h2>{title}</h2>
      <ul>
        {items.map(item => (
          <li key={item.id} onClick={() => handleSelectItem(item.id)}>
            {item.name}
          </li>
        ))}
      </ul>
      {selectedItem && <p>Selected: {selectedItem.name}</p>}
    </div>
  );
}

export default MyComponent;
```

### Orden de Hooks (Convención)

```javascript
// 1. useState (todos juntos al inicio)
const [state1, setState1] = useState(null);
const [state2, setState2] = useState([]);
const [isLoading, setIsLoading] = useState(false);

// 2. useEffect (en orden de dependencias)
useEffect(() => { /* fetch on mount */ }, []);
useEffect(() => { /* sync cuando prop cambió */ }, [propName]);

// 3. useCallback (para handlers)
const handleClick = useCallback(() => { ... }, [dep]);

// 4. useMemo (para computaciones pesadas)
const expensive = useMemo(() => computeValue(), [dep]);
```

### Prop Validation

```javascript
// ✅ Con JSDoc (comentarios tipo TypeScript)
/**
 * @param {Object} props
 * @param {string} props.title - Obligatorio
 * @param {Array<Object>} props.items - Array de items
 * @param {Function} props.onSelect - Callback
 * @returns {JSX.Element}
 */
function MyComponent({ title, items, onSelect }) { ... }

// ✅ Con PropTypes (si existe package)
import PropTypes from 'prop-types';

MyComponent.propTypes = {
  title: PropTypes.string.isRequired,
  items: PropTypes.arrayOf(PropTypes.object).isRequired,
  onSelect: PropTypes.func
};

MyComponent.defaultProps = {
  items: [],
  onSelect: () => {}
};
```

---

## Estructura de Services (Node.js)

### Template Service

```javascript
// backend/ai/services/my-service.js

/**
 * MyService - Descripción de responsabilidad
 * 
 * Expone funciones puras sin side-effects.
 * Coordina entre models y tools.
 */

class MyService {
  constructor() {
    this.logger = require('../logger/structured-logger');
  }

  /**
   * Procesa entrada y retorna resultado
   * 
   * @param {Object} input - Input validado
   * @param {string} input.projectId - Project ID
   * @returns {Promise<Object>} Resultado normalizado
   * @throws {Error} Si validación falla
   */
  async process(input) {
    // 1. Validar entrada
    if (!input.projectId) {
      throw new Error('projectId is required');
    }

    // 2. Lógica
    const result = await this._internalLogic(input);

    // 3. Retornar resultado normalizado
    return {
      success: true,
      data: result
    };
  }

  /**
   * Funciones privadas con _prefix
   */
  async _internalLogic(input) {
    // ...
  }

  /**
   * Funciones helper reutilizables
   */
  _normalize(data) {
    // ...
  }
}

// Exportar instancia (singleton)
module.exports = new MyService();
```

### Patrón: Validación → Lógica → Retorno

```javascript
// ✅ Buen patrón
async function createProject(data) {
  // 1. Validar
  if (!data.name || data.name.trim() === '') {
    throw new Error('VALIDATION_ERROR: name required');
  }
  
  // 2. Lógica
  const project = await Project.create(data);
  
  // 3. Retornar normalizado
  return {
    success: true,
    project: {
      id: project._id,
      name: project.name,
      // ... solo campos necesarios
    }
  };
}

// ❌ Mal patrón (mezcla todo)
async function createProject(data) {
  const project = await Project.create(data);
  await somethingElse();
  logThis();
  return project;
}
```

---

## DTOs y Contracts

### Contract: Input/Output de Services

```javascript
// Bien documentado
class GraphSanityEngine {
  /**
   * @param {Object} input
   * @param {Array<{id: string, name: string}>} input.nodes
   * @param {Array<{fromId: string, toId: string}>} input.relations
   * 
   * @returns {Object}
   * @returns {Array} result.nodes
   * @returns {Array} result.edges - Con fromName, toName incluidos
   * @returns {Object} result.validation
   */
  async run(input) { ... }
}
```

### Validación de DTO

```javascript
// ✅ Función helper
function validateProjectDTO(project) {
  const errors = [];
  
  if (!project._id) errors.push('_id required');
  if (!Array.isArray(project.symbols)) errors.push('symbols must be array');
  
  if (errors.length > 0) {
    throw new Error(`DTO validation failed: ${errors.join(', ')}`);
  }
  
  return project;  // Si válido
}

// Uso
try {
  const validated = validateProjectDTO(project);
  processProject(validated);
} catch (error) {
  logger.error('DTO validation failed', error);
}
```

---

## Error Handling

### Backend Error Codes

```javascript
// Define códigos de error estándar
const ERROR_CODES = {
  // Validación (4xx)
  VALIDATION_ERROR: { status: 400, message: 'Input validation failed' },
  AUTH_REQUIRED: { status: 401, message: 'Authentication required' },
  FORBIDDEN: { status: 403, message: 'Access denied' },
  NOT_FOUND: { status: 404, message: 'Resource not found' },
  CONFLICT: { status: 409, message: 'Resource conflict' },
  
  // Server (5xx)
  INTERNAL_ERROR: { status: 500, message: 'Internal server error' },
  NOT_IMPLEMENTED: { status: 501, message: 'Not implemented' }
};

// Uso
router.post('/projects', async (req, res) => {
  try {
    // ...
  } catch (error) {
    const errorCode = ERROR_CODES.INTERNAL_ERROR;
    res.status(errorCode.status).json({
      success: false,
      error: errorCode.message,
      code: 'INTERNAL_ERROR'
    });
  }
});
```

### Error Format Consistente

```javascript
// ✅ Respuesta success
{ 
  success: true,
  data: { ... },
  message: "Operation completed"
}

// ✅ Respuesta error
{
  success: false,
  error: "Validation failed",
  code: "VALIDATION_ERROR",
  details: { ... }
}

// ❌ Inconsistente
{ message: "Error occurred" }
{ err: "Something" }
{ success: null }
```

---

## Logging

### Estructura de Logs

```javascript
// ✅ Structured logging (para análisis)
logger.info('Symbol created', {
  projectId: projectId,
  symbolId: symbol._id,
  name: symbol.name,
  timestamp: new Date().toISOString()
});

logger.error('Symbol creation failed', {
  projectId: projectId,
  error: error.message,
  stack: error.stack,
  input: req.body
});

// ❌ Logging vago
logger.log('Done');
console.log('Error: ' + error);
```

### Log Levels

```javascript
// Orden de severidad
logger.debug('Detailed info for debugging');        // 0
logger.info('General informational message');       // 1
logger.warn('Warning, check but not critical');     // 2
logger.error('Error, something failed');            // 3
logger.fatal('Critical, system down');              // 4
```

---

## Type Safety y Validación

### Sin TypeScript, usar JSDoc

```javascript
/**
 * @typedef {Object} ProjectDTO
 * @property {string} _id
 * @property {string} name
 * @property {Array<Symbol>} symbols
 */

/**
 * Procesa proyecto
 * 
 * @param {ProjectDTO} project - El proyecto
 * @returns {Promise<{status: 'ok'}>}
 */
async function processProject(project) {
  // Editor autocomplete!
  const id = project._id;
  const syms = project.symbols.filter(s => s.type === 'Sujeto');
}
```

### Validación en Entrada

```javascript
// ✅ Validar siempre en routes
router.post('/projects/:projectId/symbols', (req, res) => {
  const { name, type } = req.body;
  
  // Validar
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ message: 'name must be string' });
  }
  
  if (!['Sujeto', 'Objeto', 'Verbo'].includes(type)) {
    return res.status(400).json({ message: 'Invalid type' });
  }
  
  // Procesa...
});

// ❌ No asumir tipo correcto
router.post('/projects/:projectId/symbols', (req, res) => {
  const name = req.body.name.toUpperCase();  // Puede fallar si name no es string
  // ...
});
```

---

## Testing

### Convención: Nombrar Tests

```javascript
// backend/ai/services/__tests__/graph-sanity-engine.test.js

describe('GraphSanityEngine', () => {
  describe('run()', () => {
    test('should normalize array input correctly', () => { ... });
    test('should validate broken edges', () => { ... });
    test('should throw error if nodes missing', () => { ... });
  });
  
  describe('validateGraph()', () => {
    test('should detect orphan nodes', () => { ... });
    test('should return stability score', () => { ... });
  });
});
```

### Setup/Teardown

```javascript
beforeEach(() => {
  // Reset state antes de cada test
  gse = new GraphSanityEngine();
});

afterEach(async () => {
  // Cleanup (si tests modifica BD)
  await Project.deleteMany({});
});

afterAll(async () => {
  // Cleanup global (desconectar BD)
  await mongoose.disconnect();
});
```

---

## Anti-patterns Observados

### ❌ Arrays/Maps sin validación

```javascript
// MALO: Asumir que es array
const symbols = graph.symbols;
const filtered = symbols.map(s => s.name);  // Falla si undefined

// BUENO: Validar primero
const symbols = Array.isArray(graph.symbols) ? graph.symbols : [];
const filtered = symbols.map(s => s.name);

// MEJOR: Guard clause
if (!Array.isArray(graph.symbols)) {
  throw new Error('symbols must be array');
}
```

### ❌ Modificación de estado sin broadcast

```javascript
// MALO: BD actualizada pero otros usuarios no ven
await project.symbols.push(symbolId);
await project.save();

// BUENO: Broadcast cambio
await project.symbols.push(symbolId);
await project.save();
broadcastProjectUpdate(req, projectId);  // ← CRÍTICO
```

### ❌ Hardcoded valores

```javascript
// MALO
const API_URL = 'http://localhost:3000';
const TIMEOUT = 5000;
const MAX_SIZE = 100;

// BUENO
const API_URL = process.env.VITE_API_BASE || 'http://localhost:3000';
const TIMEOUT = process.env.REQUEST_TIMEOUT || 5000;
const MAX_SIZE = process.env.MAX_SYMBOLS || 100;
```

### ❌ No manejar errores

```javascript
// MALO
const result = await somePromise();

// BUENO
try {
  const result = await somePromise();
} catch (error) {
  logger.error('Operation failed', { error: error.message });
  throw error;  // Re-throw o retornar error format
}
```

---

## Checklist para Nueva Feature

- [ ] Nombraste variable/función con camelCase
- [ ] Nombraste archivo con kebab-case (servicios) o PascalCase (componentes)
- [ ] Pusiste archivo en carpeta correcta
- [ ] Documentaste entrada/salida con JSDoc
- [ ] Validaste entrada antes de procesar
- [ ] Retornaste formato consistente ({ success, data } o throw Error)
- [ ] Si modifica BD, emitiste evento Socket.io
- [ ] Loguaste operaciones importantes
- [ ] Manejaste errores con try/catch
- [ ] Actualizaste documentación

---

**Versión:** 1.0  
**Última revisión:** 2026-05-17
