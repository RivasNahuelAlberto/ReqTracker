/**
 * Structured logging module for agent operations
 * Provides consistent JSON logging format for monitoring and debugging
 */

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const COLORS = {
  debug: '\x1b[36m',    // Cyan
  info: '\x1b[32m',     // Green
  warn: '\x1b[33m',     // Yellow
  error: '\x1b[31m',    // Red
  reset: '\x1b[0m'
};

class StructuredLogger {
  constructor(serviceName = 'agent', minLevel = 'info') {
    this.serviceName = serviceName;
    this.minLevel = LOG_LEVELS[minLevel] || LOG_LEVELS.info;
    this.metrics = {
      totalLogs: 0,
      cacheHits: 0,
      cacheMisses: 0,
      toolExecutions: 0,
      errors: 0
    };
  }

  /**
   * Format a log entry as JSON
   */
  _formatLog(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const entry = {
      timestamp,
      level,
      service: this.serviceName,
      message,
      ...data
    };

    return entry;
  }

  /**
   * Output log to console with color
   */
  _output(level, entry) {
    const color = COLORS[level] || COLORS.info;
    const levelUpper = level.toUpperCase();
    const logMessage = `${color}[${entry.timestamp}] [${levelUpper}] ${entry.service}: ${entry.message}${COLORS.reset}`;
    
    if (level === 'error') {
      console.error(logMessage, entry);
      this.metrics.errors++;
    } else if (level === 'warn') {
      console.warn(logMessage, entry);
    } else if (level === 'info') {
      console.log(logMessage, entry);
    } else {
      console.debug(logMessage, entry);
    }

    this.metrics.totalLogs++;
  }

  /**
   * Log at info level
   */
  info(message, data = {}) {
    if (LOG_LEVELS.info >= this.minLevel) {
      const entry = this._formatLog('info', message, data);
      this._output('info', entry);
    }
  }

  /**
   * Log at warn level
   */
  warn(message, data = {}) {
    if (LOG_LEVELS.warn >= this.minLevel) {
      const entry = this._formatLog('warn', message, data);
      this._output('warn', entry);
    }
  }

  /**
   * Log at error level
   */
  error(message, data = {}) {
    if (LOG_LEVELS.error >= this.minLevel) {
      const entry = this._formatLog('error', message, data);
      this._output('error', entry);
    }
  }

  /**
   * Log at debug level
   */
  debug(message, data = {}) {
    if (LOG_LEVELS.debug >= this.minLevel) {
      const entry = this._formatLog('debug', message, data);
      this._output('debug', entry);
    }
  }

  /**
   * Log a tool execution
   */
  logToolExecution(toolName, projectId, duration, success = true, cacheHit = false, error = null) {
    const data = {
      tool: toolName,
      projectId,
      duration,
      success,
      cacheHit,
      error: error ? error.toString() : null
    };

    if (cacheHit) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }
    this.metrics.toolExecutions++;

    const message = `Tool ${toolName} ${success ? 'succeeded' : 'failed'} (${duration}ms${cacheHit ? ', cached' : ''})`;
    if (!success) {
      this.error(message, data);
    } else if (cacheHit) {
      this.info(`✨ ${message}`, data);
    } else {
      this.info(message, data);
    }
  }

  /**
   * Log agent context generation
   */
  logAgentContext(projectId, duration, cacheHit = false) {
    const data = {
      projectId,
      duration,
      cacheHit
    };

    if (cacheHit) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }

    const message = `Agent context for project ${projectId} ${cacheHit ? '(cached)' : '(generated)'} in ${duration}ms`;
    this.info(`📊 ${message}`, data);
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheHitRate: this.metrics.cacheMisses + this.metrics.cacheHits > 0 ? 
        (this.metrics.cacheHits / (this.metrics.cacheMisses + this.metrics.cacheHits) * 100).toFixed(2) + '%' :
        'N/A'
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalLogs: 0,
      cacheHits: 0,
      cacheMisses: 0,
      toolExecutions: 0,
      errors: 0
    };
  }
}

export default StructuredLogger;
