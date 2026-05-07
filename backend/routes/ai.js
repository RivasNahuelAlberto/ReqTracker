import express from 'express';
import { stream } from '../ai/ai.controller.js';

const router = express.Router();

router.post('/chat/stream', stream);

export default router;
