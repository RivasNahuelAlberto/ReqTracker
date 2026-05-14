import StructuredLogger from '../logger/structured.logger.js';

const logger = new StructuredLogger('retry-util');

/**
 * Determine if an error is transient and retryable
 */
function isRetryableError(error, statusCode) {
  // HTTP status codes that are transient
  if (statusCode === 429) return true; // Rate limit
  if (statusCode >= 500) return true; // Server errors
  
  // Network errors that are transient
  if (error.code === 'ETIMEDOUT') return true;
  if (error.code === 'ECONNREFUSED') return true;
  if (error.code === 'ECONNRESET') return true;
  if (error.code === 'ENOTFOUND') return true;
  if (error.message?.includes('ECONNABORTED')) return true;
  
  // Permanent errors - don't retry
  if (statusCode === 400) return false; // Bad request
  if (statusCode === 401) return false; // Unauthorized
  if (statusCode === 403) return false; // Forbidden
  if (statusCode === 404) return false; // Not found
  
  return false;
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * 
 * @param {Function} fn - Async function to retry
 * @param {number} maxAttempts - Maximum number of attempts (default 3)
 * @param {number[]} backoffDelays - Backoff delays in ms for each retry (default [1000, 2000, 4000])
 * @param {string} operationName - Name of operation for logging
 * @returns {Promise} - Result from function
 * @throws {Error} - After all retries exhausted
 */
export async function retryWithBackoff(
  fn,
  maxAttempts = 3,
  backoffDelays = [1000, 2000, 4000],
  operationName = 'operation'
) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Extract status code if available
      const statusCode = error.status || error.statusCode;
      
      // Check if error is retryable
      if (!isRetryableError(error, statusCode)) {
        logger.warn(`Non-retryable error in ${operationName}`, {
          attempt,
          statusCode,
          errorCode: error.code,
          message: error.message
        });
        throw error;
      }
      
      // If this is the last attempt, throw
      if (attempt === maxAttempts) {
        logger.warn(`Max retries exhausted for ${operationName}`, {
          maxAttempts,
          statusCode,
          errorCode: error.code,
          message: error.message
        });
        throw error;
      }
      
      // Calculate delay (with optional jitter for production)
      const delay = backoffDelays[attempt - 1] || backoffDelays[backoffDelays.length - 1];
      const jitter = Math.random() * 100; // Add 0-100ms jitter
      const totalDelay = delay + jitter;
      
      logger.info(`Retrying ${operationName} after ${totalDelay.toFixed(0)}ms`, {
        attempt,
        nextAttempt: attempt + 1,
        maxAttempts,
        statusCode,
        errorCode: error.code
      });
      
      // Wait before retrying
      await sleep(totalDelay);
    }
  }
  
  // Should not reach here, but just in case
  throw lastError;
}

/**
 * Wrap a fetch call with retry logic
 * 
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @param {string} operationName - Name for logging
 * @returns {Promise<Response>}
 */
export async function fetchWithRetry(url, options = {}, operationName = 'fetch') {
  return retryWithBackoff(
    async () => {
      const response = await fetch(url, options);
      
      // Throw on non-ok status so retry logic can handle it
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        error.status = response.status;
        error.response = response;
        throw error;
      }
      
      return response;
    },
    3,
    [1000, 2000, 4000],
    operationName
  );
}

export default { retryWithBackoff, fetchWithRetry };
