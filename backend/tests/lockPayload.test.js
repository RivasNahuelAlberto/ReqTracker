import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLockPayload } from '../utils/lockPayload.js';

test('normalizeLockPayload rejects blank targetType, targetId or sessionId', () => {
  assert.deepEqual(normalizeLockPayload({ targetType: '  ', targetId: '   ', sessionId: '   ' }), {
    targetType: '',
    targetId: '',
    sessionId: '',
    lockedBy: '',
    isValid: false
  });
});

test('normalizeLockPayload trims and preserves valid values', () => {
  const payload = normalizeLockPayload({ targetType: ' scenario ', targetId: ' 123 ', sessionId: ' sess-1 ', lockedBy: ' Ana ' });

  assert.equal(payload.targetType, 'scenario');
  assert.equal(payload.targetId, '123');
  assert.equal(payload.sessionId, 'sess-1');
  assert.equal(payload.lockedBy, 'Ana');
  assert.equal(payload.isValid, true);
});
