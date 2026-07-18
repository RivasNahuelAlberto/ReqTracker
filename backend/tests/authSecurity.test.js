import test from 'node:test';
import assert from 'node:assert/strict';
import { getJwtSecret, sanitizeAuthPayload } from '../middleware/auth.js';

test('getJwtSecret rejects missing secret configuration', () => {
  const previous = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;

  assert.throws(() => getJwtSecret(), /JWT_SECRET/);

  if (previous !== undefined) {
    process.env.JWT_SECRET = previous;
  }
});

test('sanitizeAuthPayload trims input and rejects empty credentials', () => {
  const payload = sanitizeAuthPayload({
    username: '  Alice  ',
    email: '  alice@example.com  ',
    password: '  secret123  ',
    projectHash: '  PRJ-ABC123  '
  });

  assert.equal(payload.username, 'Alice');
  assert.equal(payload.email, 'alice@example.com');
  assert.equal(payload.password, 'secret123');
  assert.equal(payload.projectHash, 'PRJ-ABC123');

  assert.throws(() => sanitizeAuthPayload({ username: '   ', email: '', password: '' }), /required/i);
});
