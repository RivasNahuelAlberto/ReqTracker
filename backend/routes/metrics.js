import express from 'express';
import metricsCollector from '../ai/metrics/metrics.collector.js';
import StructuredLogger from '../ai/logger/structured.logger.js';

const logger = new StructuredLogger('metrics-controller');
const router = express.Router();

/**
 * Get comprehensive metrics for all tools
 */
export async function getMetrics(req, res) {
  try {
    logger.info('Fetching metrics', {});
    
    const metrics = metricsCollector.getMetrics();
    const health = metricsCollector.getHealthStatus();
    
    res.json({
      status: health.healthy ? 'healthy' : 'degraded',
      health,
      metrics
    });
  } catch (error) {
    logger.error('Failed to fetch metrics', { error: error.message });
    res.status(500).json({ error: 'Error fetching metrics' });
  }
}

/**
 * Get metrics for a specific tool
 */
export async function getToolMetrics(req, res) {
  try {
    const { toolName } = req.params;
    
    if (!toolName) {
      return res.status(400).json({ error: 'toolName is required' });
    }

    logger.info('Fetching tool metrics', { toolName });

    const metrics = metricsCollector.getMetrics(toolName);
    
    if (!metrics) {
      return res.status(404).json({ error: `No metrics found for tool: ${toolName}` });
    }

    res.json({ metrics });
  } catch (error) {
    logger.error('Failed to fetch tool metrics', { 
      toolName: req.params?.toolName,
      error: error.message 
    });
    res.status(500).json({ error: 'Error fetching tool metrics' });
  }
}

/**
 * Reset all metrics
 */
export async function resetMetrics(req, res) {
  try {
    logger.info('Resetting metrics', {});
    metricsCollector.reset();
    res.json({ message: 'Metrics reset successfully' });
  } catch (error) {
    logger.error('Failed to reset metrics', { error: error.message });
    res.status(500).json({ error: 'Error resetting metrics' });
  }
}

/**
 * Get health status
 */
export async function getHealthStatus(req, res) {
  try {
    logger.info('Fetching health status', {});
    
    const health = metricsCollector.getHealthStatus();
    const metrics = metricsCollector.getMetrics();
    
    res.json({
      status: health.healthy ? 'healthy' : 'degraded',
      health,
      summary: {
        totalExecutions: metrics.totalExecutions,
        successRate: metrics.overallSuccessRate?.toFixed(2) + '%',
        cacheHitRate: metrics.overallCacheHitRate?.toFixed(2) + '%',
        avgLatency: metrics.averageToolLatency?.toFixed(2) + 'ms'
      }
    });
  } catch (error) {
    logger.error('Failed to fetch health status', { error: error.message });
    res.status(500).json({ error: 'Error fetching health status' });
  }
}

// Routes
router.get('/', getMetrics);
router.get('/health', getHealthStatus);
router.get('/tools/:toolName', getToolMetrics);
router.post('/reset', resetMetrics);

export default router;
