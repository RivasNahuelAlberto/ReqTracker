import express from 'express';
import { stream } from '../ai/ai.controller.js';
import { analyzeRequirement } from '../ai/quality.controller.js';
import { analyzeImpact } from '../ai/impact.controller.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/chat/stream', authenticateToken, stream);
router.post('/quality/analyze', authenticateToken, analyzeRequirement);
router.post('/impact/analyze', authenticateToken, analyzeImpact);

export default router;
