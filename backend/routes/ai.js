const express = require('express');
const { stream } = require('../ai/ai.controller');

const router = express.Router();

router.post('/chat/stream', stream);

module.exports = router;
