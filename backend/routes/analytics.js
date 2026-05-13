import express from 'express';

const router = express.Router();
const analyticsUrl = process.env.ANALYTICS_URL || 'http://analytics:8000';

router.get('/health', async (req, res) => {
  try {
    const response = await fetch(`${analyticsUrl}/health`);
    const data = await response.json();
    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/compare-entities', async (req, res) => {
  try {
    const response = await fetch(`${analyticsUrl}/compare-entities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
