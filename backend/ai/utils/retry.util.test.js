import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchWithRetry } from './retry.util.js';

class MockResponse {
  constructor(status) {
    this.status = status;
    this.statusText = status === 429 ? 'Too Many Requests' : 'OK';
    this.ok = status >= 200 && status < 300;
  }

  async json() {
    return { ok: false };
  }
}

test('429 responses fail fast and stop hammering the downstream service', async () => {
  let callCount = 0;
  global.fetch = async () => {
    callCount += 1;
    return new MockResponse(429);
  };

  await assert.rejects(
    () => fetchWithRetry('http://example.test/analytics', {}, 'analytics-test'),
    /HTTP 429/
  );
  assert.equal(callCount, 1);

  await assert.rejects(
    () => fetchWithRetry('http://example.test/analytics', {}, 'analytics-test'),
    /cooldown|rate limited|HTTP 429/i
  );
  assert.equal(callCount, 1);
});
