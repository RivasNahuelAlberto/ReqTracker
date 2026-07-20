import express from 'express';
import { stream } from '../ai/ai.controller.js';
import { analyzeRequirement } from '../ai/quality.controller.js';
import { analyzeImpact } from '../ai/impact.controller.js';
import { analyzeOptimization } from '../ai/optimizer.controller.js';
import { getRecommendations } from '../ai/recommendation.controller.js';
import { analyzeProjectHealth, getHealthIssues } from '../ai/health.controller.js';
import { runAgent } from '../ai/agent/controller.js';
import { authenticateToken, authorizeProjectRoles } from '../middleware/auth.js';

const router = express.Router();

router.post('/chat/stream', authenticateToken, stream);
router.post('/quality/analyze', authenticateToken, analyzeRequirement);
router.post('/impact/analyze', authenticateToken, analyzeImpact);
router.post('/optimizer/analyze', authenticateToken, analyzeOptimization);
router.post('/recommendations', authenticateToken, getRecommendations);
router.post('/health/analyze', authenticateToken, authorizeProjectRoles('invitado', 'usuario', 'admin', 'super_admin'), analyzeProjectHealth);
router.get('/health/issues/:projectId', authenticateToken, authorizeProjectRoles('invitado', 'usuario', 'admin', 'super_admin'), getHealthIssues);
router.post('/agent/run', authenticateToken, authorizeProjectRoles('admin', 'super_admin'), runAgent);

export default router;
