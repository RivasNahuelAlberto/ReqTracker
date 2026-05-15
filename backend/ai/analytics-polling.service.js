import { StructuredLogger } from '../middleware/logger.js';
import { createAnalyticsClient } from './analytics.client.js';
import {
  emitProjectAnalyticsUpdated,
  emitProjectGraphRecomputed,
  emitProjectPredictionGenerated,
  emitProjectSemanticDrift,
  emitProjectRiskDetected,
} from '../socket.js';
import { getRedisClient } from '../cache/redis-client.js';
import crypto from 'crypto';

const logger = new StructuredLogger('AnalyticsPollingService');
const analyticsClient = createAnalyticsClient();

/**
 * ETAPA 8 Fase 2: Analytics Polling Service
 *
 * Periodically refreshes analytics data for active projects and emits socket events only if data changed.
 *
 * - Polls every 30-60 seconds
 * - Caches previous data in Redis to detect changes
 * - Emits socket events only on significant changes
 * - Non-blocking: runs in background without affecting HTTP responses
 * - Respects rate limiting to avoid overwhelming analytics service
 */

const POLLING_CONFIG = {
  INTERVAL_MS: 45000, // 45 seconds - adjust based on analytics service capacity
  DATA_HASH_TTL: 120, // Keep hash for 2 minutes to detect changes
  MAX_PROJECTS_PER_POLL: 50, // Limit concurrent analytics calls
  RETRY_BACKOFF_MS: 5000, // Wait 5s before retrying failed project
};

// Track which projects are currently being polled
const pollingState = new Map(); // projectId -> { lastPoll: timestamp, retries: number }
const MAX_RETRIES = 3;

/**
 * Generate hash of data to detect changes
 */
function hashData(data) {
  if (!data) return null;
  const json = JSON.stringify(data);
  return crypto.createHash('sha256').update(json).digest('hex');
}

/**
 * Check if data has changed compared to cached hash
 */
async function hasDataChanged(projectId, dataType, currentData) {
  try {
    const redisClient = getRedisClient();
    if (!redisClient) return true; // No Redis, assume changed

    const cacheKey = `analytics:polling:${projectId}:${dataType}:hash`;
    const cachedHash = await redisClient.get(cacheKey);
    const currentHash = hashData(currentData);

    if (cachedHash === currentHash) {
      return false; // Data unchanged
    }

    // Store new hash with TTL
    await redisClient.setex(cacheKey, POLLING_CONFIG.DATA_HASH_TTL, currentHash);
    return true; // Data changed
  } catch (error) {
    logger.warn('Error checking data change', { projectId, dataType, error: error.message });
    return true; // Assume changed on error
  }
}

/**
 * Fetch semantic health for project
 */
async function fetchSemanticHealth(projectId) {
  try {
    const response = await analyticsClient.callAnalytics(
      '/semantic/health',
      { projectId },
      { timeout: 10000 }
    );

    if (response && response.overall_score !== undefined) {
      return {
        type: 'semantic',
        data: response,
      };
    }
    return null;
  } catch (error) {
    logger.warn('Failed to fetch semantic health during polling', {
      projectId,
      error: error.message,
    });
    return null;
  }
}

/**
 * Fetch graph metrics for project
 */
async function fetchGraphMetrics(projectId) {
  try {
    const response = await analyticsClient.callAnalytics(
      '/graph/metrics',
      { projectId },
      { timeout: 10000 }
    );

    if (response && response.nodes !== undefined) {
      return {
        type: 'graph',
        data: response,
      };
    }
    return null;
  } catch (error) {
    logger.warn('Failed to fetch graph metrics during polling', {
      projectId,
      error: error.message,
    });
    return null;
  }
}

/**
 * Fetch prediction data for project
 */
async function fetchPredictions(projectId) {
  try {
    const response = await analyticsClient.callAnalytics(
      '/predictions/forecast',
      { projectId },
      { timeout: 10000 }
    );

    if (response && response.predictions) {
      return {
        type: 'prediction',
        data: response,
      };
    }
    return null;
  } catch (error) {
    logger.warn('Failed to fetch predictions during polling', {
      projectId,
      error: error.message,
    });
    return null;
  }
}

/**
 * Poll all analytics data for a project
 */
async function pollProjectAnalytics(projectId) {
  try {
    logger.debug('Polling analytics for project', { projectId });

    // Fetch multiple analytics endpoints in parallel
    const [semanticHealth, graphMetrics, predictions] = await Promise.allSettled([
      fetchSemanticHealth(projectId),
      fetchGraphMetrics(projectId),
      fetchPredictions(projectId),
    ]);

    const results = [];

    // Process semantic health
    if (semanticHealth.status === 'fulfilled' && semanticHealth.value) {
      const changed = await hasDataChanged(projectId, 'semantic', semanticHealth.value.data);
      if (changed) {
        results.push(semanticHealth.value);
        emitProjectAnalyticsUpdated(projectId, {
          type: 'semantic',
          polled: true,
          data: semanticHealth.value.data,
          timestamp: new Date().toISOString(),
        });

        // Check for high risk
        if (semanticHealth.value.data.overall_score < 40) {
          emitProjectRiskDetected(projectId, {
            riskType: 'low_semantic_health',
            score: semanticHealth.value.data.overall_score,
            message: 'Semantic health has declined below threshold',
            polled: true,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    // Process graph metrics
    if (graphMetrics.status === 'fulfilled' && graphMetrics.value) {
      const changed = await hasDataChanged(projectId, 'graph', graphMetrics.value.data);
      if (changed) {
        results.push(graphMetrics.value);
        emitProjectGraphRecomputed(projectId, {
          type: 'graph',
          polled: true,
          data: graphMetrics.value.data,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Process predictions
    if (predictions.status === 'fulfilled' && predictions.value) {
      const changed = await hasDataChanged(projectId, 'prediction', predictions.value.data);
      if (changed) {
        results.push(predictions.value);
        emitProjectPredictionGenerated(projectId, {
          type: 'prediction',
          polled: true,
          data: predictions.value.data,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Update polling state
    pollingState.set(projectId, {
      lastPoll: Date.now(),
      retries: 0,
      lastSuccess: true,
    });

    logger.info('Polling completed for project', {
      projectId,
      changedMetrics: results.length,
    });

    return { success: true, changed: results.length > 0, results };
  } catch (error) {
    logger.error('Error polling project analytics', { projectId, error: error.message });

    // Retry logic
    const state = pollingState.get(projectId) || { retries: 0 };
    if (state.retries < MAX_RETRIES) {
      pollingState.set(projectId, {
        ...state,
        retries: state.retries + 1,
      });
    }

    return { success: false, error: error.message };
  }
}

/**
 * Get list of active projects that should be polled
 */
async function getActiveProjectIds() {
  try {
    // In production, fetch from MongoDB or cache
    // For now, return projects that have been accessed recently
    const redisClient = getRedisClient();
    if (!redisClient) return [];

    // Get list of projects from Redis set (populated by ProjectPage when users access)
    const projectIds = await redisClient.smembers('active:projects');
    return projectIds || [];
  } catch (error) {
    logger.warn('Error getting active projects', { error: error.message });
    return [];
  }
}

/**
 * Main polling loop - runs continuously in background
 */
async function startPollingLoop() {
  logger.info('Analytics polling loop started', {
    interval: POLLING_CONFIG.INTERVAL_MS,
    maxProjectsPerPoll: POLLING_CONFIG.MAX_PROJECTS_PER_POLL,
  });

  setInterval(async () => {
    try {
      const projectIds = await getActiveProjectIds();

      if (projectIds.length === 0) {
        logger.debug('No active projects to poll');
        return;
      }

      logger.debug('Starting polling cycle', { projectCount: projectIds.length });

      // Limit concurrent polls to avoid overwhelming analytics service
      const chunks = [];
      for (let i = 0; i < projectIds.length; i += POLLING_CONFIG.MAX_PROJECTS_PER_POLL) {
        chunks.push(projectIds.slice(i, i + POLLING_CONFIG.MAX_PROJECTS_PER_POLL));
      }

      for (const chunk of chunks) {
        const promises = chunk.map((projectId) => pollProjectAnalytics(projectId));
        await Promise.allSettled(promises);

        // Small delay between chunks to avoid thundering herd
        if (chunks.indexOf(chunk) < chunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      logger.debug('Polling cycle completed', { projectCount: projectIds.length });
    } catch (error) {
      logger.error('Polling loop error', { error: error.message });
    }
  }, POLLING_CONFIG.INTERVAL_MS);
}

/**
 * Register a project for polling
 */
async function registerProjectForPolling(projectId) {
  try {
    const redisClient = getRedisClient();
    if (!redisClient) return;

    // Add project to active projects set
    await redisClient.sadd('active:projects', projectId);

    // Set TTL so project auto-removes if no activity
    await redisClient.expire('active:projects', 3600); // 1 hour TTL

    logger.debug('Registered project for polling', { projectId });
  } catch (error) {
    logger.warn('Error registering project for polling', { projectId, error: error.message });
  }
}

/**
 * Unregister a project from polling
 */
async function unregisterProjectFromPolling(projectId) {
  try {
    const redisClient = getRedisClient();
    if (!redisClient) return;

    await redisClient.srem('active:projects', projectId);
    pollingState.delete(projectId);

    logger.debug('Unregistered project from polling', { projectId });
  } catch (error) {
    logger.warn('Error unregistering project from polling', { projectId, error: error.message });
  }
}

/**
 * Get polling status for debugging
 */
function getPollingStatus() {
  return {
    config: POLLING_CONFIG,
    pollingState: Array.from(pollingState.entries()).map(([projectId, state]) => ({
      projectId,
      ...state,
    })),
  };
}

/**
 * Singleton factory
 */
let pollingServiceInstance = null;

function getAnalyticsPollingService() {
  if (!pollingServiceInstance) {
    pollingServiceInstance = {
      startPollingLoop,
      registerProjectForPolling,
      unregisterProjectFromPolling,
      getPollingStatus,
      pollProjectAnalytics, // For manual polling/testing
    };
  }
  return pollingServiceInstance;
}

export { getAnalyticsPollingService };
