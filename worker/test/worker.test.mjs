import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createConfirmationToken,
  isValidEmail,
  normalizeEmail,
  verifyConfirmationToken,
} from '../src/index.mjs';
import worker from '../src/index.mjs';

test('normalizes and validates ordinary email addresses', () => {
  assert.equal(normalizeEmail('  Vivek@Example.COM '), 'vivek@example.com');
  assert.equal(isValidEmail('vivek@example.com'), true);
  assert.equal(isValidEmail('missing-at.example.com'), false);
  assert.equal(isValidEmail('a@localhost'), false);
  assert.equal(isValidEmail(`x@${'a'.repeat(250)}.com`), false);
});

test('creates and verifies a signed 24-hour token', async () => {
  const now = Date.UTC(2026, 6, 10, 12);
  const token = await createConfirmationToken('vivek@example.com', 'test-secret', now);
  assert.deepEqual(await verifyConfirmationToken(token, 'test-secret', now + 1000), {
    email: 'vivek@example.com',
    exp: now + (24 * 60 * 60 * 1000),
  });
});

test('rejects altered, expired, and wrong-secret tokens', async () => {
  const now = Date.UTC(2026, 6, 10, 12);
  const token = await createConfirmationToken('vivek@example.com', 'test-secret', now);
  assert.equal(await verifyConfirmationToken(`${token}x`, 'test-secret', now), null);
  assert.equal(await verifyConfirmationToken(token, 'wrong-secret', now), null);
  assert.equal(await verifyConfirmationToken(token, 'test-secret', now + (25 * 60 * 60 * 1000)), null);
});

test('mock signup enforces origin, validation, and CORS preflight', async () => {
  const env = {
    ALLOWED_ORIGINS: 'http://localhost:4173',
    SIGNUP_MODE: 'mock',
  };
  const request = (body, origin = 'http://localhost:4173') => new Request('https://signup.example/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, 'CF-Connecting-IP': `${Math.random()}` },
    body: JSON.stringify(body),
  });

  const invalidOrigin = await worker.fetch(request({ email: 'vivek@example.com' }, 'https://evil.example'), env);
  assert.equal(invalidOrigin.status, 403);

  const invalidEmail = await worker.fetch(request({ email: 'bad-email' }), env);
  assert.equal(invalidEmail.status, 400);

  const accepted = await worker.fetch(request({ email: ' Vivek@Example.com ' }), env);
  assert.equal(accepted.status, 202);
  assert.deepEqual(await accepted.json(), { message: 'Check your inbox to confirm.' });

  const preflight = await worker.fetch(new Request('https://signup.example/subscribe', {
    method: 'OPTIONS',
    headers: { Origin: 'http://localhost:4173' },
  }), env);
  assert.equal(preflight.status, 204);
  assert.equal(await preflight.text(), '');
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), 'http://localhost:4173');
});
