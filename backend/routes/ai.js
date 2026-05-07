import express from 'express';
import { stream } from '../ai/ai.controller.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/chat/stream', authenticateToken, stream);

export default router;
