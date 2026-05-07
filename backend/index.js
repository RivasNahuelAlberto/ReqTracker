import express from 'express';
import http from 'http';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import projectRoutes from './routes/projects.js';
import symbolRoutes from './routes/symbols.js';
import aiRoutes from './routes/ai.js';
import conversationsRoutes from './routes/conversations.js';
import { Server } from 'socket.io';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/reqtracker';

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || origin === process.env.FRONTEND_ORIGIN || origin === 'https://reqtracker-3.onrender.com') {
      callback(null, true);
    } else {
      callback(new Error('CORS policy: Origin not allowed'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use('/api/projects', projectRoutes);
app.use('/api/projects', symbolRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/conversations', conversationsRoutes);

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Catch all handler: send back React's index.html file for any non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  }
});

app.set('io', io);

io.on('connection', (socket) => {
  socket.on('joinProject', (projectId) => {
    if (projectId) {
      socket.join(projectId);
    }
  });

  socket.on('leaveProject', (projectId) => {
    if (projectId) {
      socket.leave(projectId);
    }
  });
});

mongoose.set('strictQuery', false);
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    server.listen(PORT, () => console.log(`Backend listening on http://localhost:${PORT}`));
  })
  .catch((error) => {
    console.error('MongoDB connection failed:', error.message);
  });
