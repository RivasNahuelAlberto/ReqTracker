# 🔧 ReqTracker - Technology Stack & Setup

**Última actualización:** 2026-05-17

> **Inventario completo de tecnologías, versiones, configuración, herramientas**

---

## Tabla de Contenidos

1. [Overview del Stack](#overview-del-stack)
2. [Frontend Stack](#frontend-stack)
3. [Backend Stack](#backend-stack)
4. [Analytics Stack](#analytics-stack)
5. [Infrastructure & DevOps](#infrastructure--devops)
6. [Herramientas de Desarrollo](#herramientas-de-desarrollo)
7. [Configuración Ambiente](#configuración-ambiente)
8. [Troubleshooting Setup](#troubleshooting-setup)

---

## Overview del Stack

```
┌─────────────────────────────────────────┐
│ FRONTEND                                │
│ React 18 + Vite + Bootstrap 5 + Axios  │
│ Port: 5173 (dev), 4173 (build)          │
└─────────────────────────────────────────┘
           ↕ HTTP + Socket.io
┌─────────────────────────────────────────┐
│ BACKEND                                 │
│ Node.js + Express + Mongoose            │
│ Port: 3000                              │
└─────────────────────────────────────────┘
           ↕ HTTP REST
┌─────────────────────────────────────────┐
│ ANALYTICS                               │
│ Python 3.10+ + FastAPI                  │
│ Port: 8000 (dev), containerized (prod)  │
└─────────────────────────────────────────┘
           ↕ HTTP REST
┌─────────────────────────────────────────┐
│ DATABASE                                │
│ MongoDB (Atlas cloud | local instance)  │
│ Port: 27017                             │
└─────────────────────────────────────────┘
```

---

## Frontend Stack

### Core Frameworks

| Tecnología | Versión | Uso | Config |
|-----------|---------|-----|--------|
| **React** | 18.x | UI framework | `package.json` |
| **Vite** | 4.x+ | Build tool, dev server | `vite.config.js` |
| **Bootstrap** | 5.x | CSS framework | Via CDN o npm |
| **Axios** | 1.x | HTTP client | `src/api.js` |
| **Socket.io Client** | 4.x | Real-time sync | `package.json` |

### Dependencies Completo

```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^6.0.0",
  "axios": "^1.4.0",
  "socket.io-client": "^4.5.0",
  "bootstrap": "^5.2.0"
}
```

### Dev Dependencies

```json
{
  "@vitejs/plugin-react": "^4.0.0",
  "vite": "^4.0.0",
  "eslint": "^8.0.0",
  "eslint-plugin-react": "^7.32.0"
}
```

### Estructura de Build

```bash
# Development
npm run dev
# → Vite dev server: http://localhost:5173

# Production build
npm run build
# → Salida: dist/
# → Optimizado para producción

# Preview build
npm run preview
# → Previsualizar output build localmente
```

### Configuración Vite

```javascript
// frontend/vite.config.js
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});
```

---

## Backend Stack

### Core Frameworks

| Tecnología | Versión | Uso | Config |
|-----------|---------|-----|--------|
| **Node.js** | 18.x+ | Runtime | `.nvmrc` (if using nvm) |
| **Express** | 4.x | Web framework | `backend/index.js` |
| **Mongoose** | 6.x+ | MongoDB ODM | `backend/models/` |
| **Socket.io** | 4.x | Real-time | `backend/index.js` |
| **Axios** | 1.x | HTTP client | `backend/ai/services/` |

### Dependencies Completo

```json
{
  "express": "^4.18.0",
  "mongoose": "^6.8.0",
  "socket.io": "^4.5.0",
  "axios": "^1.4.0",
  "dotenv": "^16.0.0",
  "cors": "^2.8.5",
  "express-rate-limit": "^6.7.0"
}
```

### Dev Dependencies

```json
{
  "nodemon": "^2.0.0",
  "jest": "^29.0.0",
  "supertest": "^6.3.0"
}
```

### Scripts NPM

```json
{
  "scripts": {
    "start": "node backend/index.js",
    "dev": "nodemon backend/index.js",
    "test": "jest",
    "lint": "eslint backend/"
  }
}
```

### Estructura de Start

```bash
# Development (con hot-reload via nodemon)
npm run dev

# Production
npm start
```

### Configuración Principal

```javascript
// backend/index.js
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// DB Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/reqtracker', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Routes
app.use('/api', require('./routes/projects'));

// Socket.io
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL }
});

server.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
```

---

## Analytics Stack

### Core Frameworks

| Tecnología | Versión | Uso | Config |
|-----------|---------|-----|--------|
| **Python** | 3.10+ | Language | `requirements.txt` |
| **FastAPI** | 0.95.x+ | Web framework | `analytics/app.py` |
| **Pydantic** | 1.x+ | Data validation | Models en `analytics/` |
| **MongoDB** | Python driver | DB client | Connection en `app.py` |
| **Numpy/Scipy** | Latest | Math operations | Embeddings, algorithms |

### Dependencies Completo

```
fastapi==0.95.2
uvicorn==0.21.0
pydantic==1.10.0
pymongo==4.3.0
numpy==1.24.0
scipy==1.10.0
scikit-learn==1.2.0
python-dotenv==1.0.0
```

### Dev Dependencies

```
pytest==7.2.0
pytest-cov==4.0.0
black==23.1.0
pylint==2.17.0
```

### Estructura de Start

```bash
# Development
uvicorn analytics.app:app --reload --port 8000

# Production (via Docker)
docker build -t reqtracker-analytics .
docker run -p 8000:8000 reqtracker-analytics
```

### Configuración Principal

```python
# analytics/app.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv('FRONTEND_URL', 'http://localhost:5173')],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*']
)

# MongoDB
client = MongoClient(os.getenv('MONGO_URI', 'mongodb://localhost:27017'))
db = client['reqtracker']

@app.get('/health')
async def health():
    return {'status': 'ok'}

# Rutas específicas
@app.post('/semantic/analyze')
async def analyze_semantic(data: dict):
    # Lógica de análisis
    pass
```

---

## Infrastructure & DevOps

### Database: MongoDB

#### Opciones de Deployment

```
DEV:
├─ Local MongoDB (localhost:27017)
└─ mongosh CLI para queries

STAGING/PROD:
├─ MongoDB Atlas (Cloud)
├─ Connection string: mongodb+srv://user:pass@cluster.mongodb.net/dbname
└─ Backups automáticos habilitados
```

#### Collections

```
reqtracker
├── projects
│   └─ Índices: { projectId }, { createdAt }
├── symbols
│   └─ Índices: { projectId }, { name }
├── relations
│   └─ Índices: { fromId, toId }
├── scenarios
├── tasks
├── inspections
└── conversations (if chat history)
```

#### Backups

```bash
# Local backup
mongodump --uri "mongodb://localhost:27017/reqtracker" --out ./backup

# Local restore
mongorestore --uri "mongodb://localhost:27017" ./backup

# Atlas backups
# → Habilitados automáticamente en panel web
# → Retención: 7 días (default)
```

### Docker & Containerization

#### Backend Dockerfile

```dockerfile
# backend/Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --production

COPY . .
EXPOSE 3000
CMD ["node", "backend/index.js"]
```

#### Analytics Dockerfile

```dockerfile
# analytics/Dockerfile
FROM python:3.10-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
EXPOSE 8000
CMD ["uvicorn", "analytics.app:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### docker-compose.yml

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      - MONGO_URI=mongodb://mongo:27017/reqtracker
      - PORT=3000
    depends_on:
      - mongo

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    environment:
      - VITE_API_BASE=http://localhost:3000

  analytics:
    build: ./analytics
    ports:
      - "8000:8000"
    environment:
      - MONGO_URI=mongodb://mongo:27017/reqtracker

  mongo:
    image: mongo:5.0
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db

volumes:
  mongodb_data:
```

### Production Deployment

```
Deployment Platform: Render.com (o similar)

Frontend:
├─ Build: npm run build
├─ Output: dist/
├─ Serve: Static hosting (Render, Netlify, etc.)
└─ URL: https://reqtracker.com

Backend:
├─ Build: Docker image
├─ Registry: Docker Hub (o similar)
├─ Deploy: Render Web Service
├─ URL: https://api.reqtracker.com
└─ Auto-deploy: On main branch push

Analytics:
├─ Build: Docker image
├─ Deploy: Render Web Service
├─ URL: https://analytics.reqtracker.com
└─ Auto-deploy: On main branch push

Database:
├─ MongoDB Atlas (cloud)
├─ Connection: Whitelist IPs
├─ Backups: Automáticas
└─ Monitoring: Atlas UI
```

---

## Herramientas de Desarrollo

### CLI Tools

```bash
# Node.js version management
nvm install 18
nvm use 18

# Node package manager
npm --version

# MongoDB CLI
mongosh "mongodb://localhost:27017"

# Git
git clone https://github.com/user/reqtracker.git
cd reqtracker

# Docker
docker --version
docker-compose up
```

### IDEs Recomendadas

- **VS Code** — Editor principal
  - Extensions: ESLint, Prettier, MongoDB for VS Code
  - Debug: Debugger for Chrome para frontend
  
- **Postman/Insomnia** — API testing
  - Importar rutas de `backend/routes/`
  
- **MongoDB Compass** — BD GUI
  - Conectar a localhost:27017
  - Visualizar collections

### Browsers DevTools

- **Chrome DevTools** — Frontend debugging
  - Network tab para HTTP requests
  - Storage tab para localStorage/cookies
  
- **Browser WebSocket Inspector**
  - Monitorear Socket.io conexiones

### Testing Tools

```bash
# Jest (Backend unit tests)
npm test

# Supertest (Backend integration tests)
npm test -- --verbose

# React Testing Library (Frontend)
npm test -- --watch

# End-to-End (Playwright, si existe)
npm run test:e2e
```

---

## Configuración Ambiente

### .env.example (Backend)

```env
# Server
NODE_ENV=development
PORT=3000

# Database
MONGO_URI=mongodb://localhost:27017/reqtracker

# LLM APIs
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=sk-...

# Frontend
FRONTEND_URL=http://localhost:5173

# Analytics
ANALYTICS_URL=http://localhost:8000

# Optional
LOG_LEVEL=debug
ENABLE_ANALYTICS=true
```

### .env.example (Frontend)

```env
# API
VITE_API_BASE=http://localhost:3000

# Analytics
VITE_ANALYTICS_URL=http://localhost:8000

# Optional
VITE_LOG_LEVEL=debug
```

### .env.example (Analytics)

```env
# Server
ANALYTICS_PORT=8000

# Database
MONGO_URI=mongodb://localhost:27017/reqtracker

# Optional
LOG_LEVEL=debug
ENABLE_CACHE=true
REDIS_URL=redis://localhost:6379
```

### Setup Local (First Time)

```bash
# 1. Clone repo
git clone https://github.com/user/reqtracker.git
cd reqtracker

# 2. Backend setup
cd backend
cp .env.example .env
npm install
npm run dev  # Terminal 1

# 3. Frontend setup (Terminal 2)
cd frontend
npm install
npm run dev

# 4. Analytics setup (Terminal 3)
cd analytics
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
uvicorn analytics.app:app --reload

# 5. MongoDB (Terminal 4)
# Opción A: Local MongoDB
mongod --dbpath ./data

# Opción B: MongoDB Atlas
# → Usa MONGO_URI en .env

# URLs
# Frontend: http://localhost:5173
# Backend: http://localhost:3000
# Analytics: http://localhost:8000
```

---

## Troubleshooting Setup

### Frontend Issues

```bash
# Port 5173 already in use
sudo lsof -i :5173
kill -9 <PID>

# Dependencies conflicted
rm -rf node_modules package-lock.json
npm install

# Vite hot reload not working
# → Check vite.config.js HMR configuration
# → Restart dev server
```

### Backend Issues

```bash
# Port 3000 already in use
sudo lsof -i :3000
kill -9 <PID>

# MongoDB connection failed
# → Verificá MONGO_URI en .env
# → Mongodb running? mongosh test

# nodemon not reloading
npm install -D nodemon@latest
```

### Analytics Issues

```bash
# Port 8000 already in use
sudo lsof -i :8000
kill -9 <PID>

# Python virtual env not activated
source venv/bin/activate

# Missing dependencies
pip install -r requirements.txt --upgrade

# Import errors
# → Check sys.path in analytics/app.py
# → Re-read CRITICAL_DEPENDENCIES.md Issue #3
```

### Database Issues

```bash
# MongoDB not starting
# Local: mongod --dbpath ./data
# Atlas: Check connection string in .env

# Connection timeout
# → Whitelist your IP (Atlas)
# → Check firewall
# → Increase timeout in Mongoose config

# Collections not showing
mongosh
> use reqtracker
> show collections
```

---

## Version Compatibility Matrix

| Componente | Versión Mín | Versión Recomendada | Versión Máx |
|-----------|------------|-------------------|-----------|
| Node.js | 16.x | 18.x LTS | Latest |
| npm | 8.x | 9.x+ | Latest |
| React | 17.x | 18.x+ | Latest |
| Vite | 3.x | 4.x | Latest |
| Express | 4.17 | 4.18+ | 5.x (beta) |
| Mongoose | 6.x | 6.8+ | 7.x |
| FastAPI | 0.90 | 0.95+ | Latest |
| Python | 3.8 | 3.10+ | 3.11 |
| MongoDB | 4.x | 5.x | 6.x |

---

## Performance Benchmarks (Target)

```
Frontend:
├─ Build time: < 30s
├─ First paint: < 1s
├─ LCP (Largest Contentful Paint): < 2.5s
└─ TTI (Time to Interactive): < 3.5s

Backend:
├─ API response: < 200ms (p95)
├─ Chat stream start: < 500ms
└─ Throughput: 100 req/s

Analytics:
├─ Semantic analysis: < 2s
└─ Graph algorithms: < 5s

Database:
├─ Query time: < 10ms
├─ Throughput: 1000 ops/s
└─ Replication lag: < 1s
```

---

## Documentos Relacionados

- **[00_GETTING_STARTED.md](./00_GETTING_STARTED.md)** — Setup local rápido
- **[TECHNICAL_OVERVIEW.md](./TECHNICAL_OVERVIEW.md)** — Arquitectura general
- **[MODULES_AND_LAYERS.md](./MODULES_AND_LAYERS.md)** — Estructura de código

---

**Versión:** 1.0  
**Última revisión:** 2026-05-17
