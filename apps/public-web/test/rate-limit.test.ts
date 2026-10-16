import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  clientAddress,
  consume,
  RATE_LIMITS,
  resetRateLimits,
  tooManyResponse,
} from '../lib/rate-limit.ts';

/** Sleep long enough for a short custom window to elapse. */
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test('the sign-in scope allows exactly its quota, then refuses with a wait', () => {
  resetRateLimits();
  const { limit } = RATE_LIMITS.signin;
  for (let i = 0; i < limit; i += 1) {
    assert.equal(consume('signin', 'pair-1').ok, true, `attempt ${i + 1} should pass`);
  }
  const blocked = consume('signin', 'pair-1');
  assert.equal(blocked.ok, false);
  if (blocked.ok) return;
  assert.ok(blocked.retryAfterSeconds >= 1, 'a refusal names a wait');
  assert.ok(blocked.retryAfterSeconds * 1000 <= RATE_LIMITS.signin.windowMs, 'never past the window');
});

test('the window resets once it elapses', async () => {
  resetRateLimits();
  const rule = { limit: 2, windowMs: 60 };
  assert.equal(consume('signin', 'short-window', rule).ok, true);
  assert.equal(consume('signin', 'short-window', rule).ok, true);
  assert.equal(consume('signin', 'short-window', rule).ok, false, 'quota spent');

  await pause(80);
  const again = consume('signin', 'short-window', rule);
  assert.equal(again.ok, true, 'a full window of quiet restores the quota');
  if (!again.ok) return;
  assert.equal(again.remaining, 1, 'the new window counts down from the top');
});

test('scopes and identities are separate buckets', () => {
  resetRateLimits();
  for (let i = 0; i < RATE_LIMITS.passwordReset.limit; i += 1) {
    consume('passwordReset', 'pair-2');
  }
  assert.equal(consume('passwordReset', 'pair-2').ok, false, 'reset quota spent');

  assert.equal(consume('signin', 'pair-2').ok, true, 'the same identity can still sign in');
  assert.equal(consume('passwordReset', 'pair-3').ok, true, 'another identity is untouched');
});

test('a tighter per-address counter trips before the loose per-email one', () => {
  resetRateLimits();
  // Sign-in carries two counters: a small pair quota and a larger address one.
  // With a shared identity the smaller must bind first.
  for (let i = 0; i < RATE_LIMITS.signin.limit; i += 1) {
    consume('signin', 'shared');
    consume('signinPerAddress', 'shared');
  }
  assert.equal(consume('signin', 'shared').ok, false, 'the tight counter refuses');
  assert.equal(consume('signinPerAddress', 'shared').ok, true, 'the loose one still has room');
});

test('an environment override loosens a bucket without editing code', () => {
  resetRateLimits();
  process.env.SERVEM_RATE_LIMIT_SIGNIN = '3/1';
  try {
    for (let i = 0; i < 3; i += 1) assert.equal(consume('signin', 'override').ok, true);
    assert.equal(consume('signin', 'override').ok, false, 'the override bound the bucket');
  } finally {
    delete process.env.SERVEM_RATE_LIMIT_SIGNIN;
  }

  process.env.SERVEM_RATE_LIMIT_SIGNIN = 'nonsense/also-nonsense';
  try {
    // A malformed override falls back to the shipped quota rather than failing open.
    for (let i = 0; i < RATE_LIMITS.signin.limit; i += 1) {
      assert.equal(consume('signin', 'fallback').ok, true);
    }
    assert.equal(consume('signin', 'fallback').ok, false);
  } finally {
    delete process.env.SERVEM_RATE_LIMIT_SIGNIN;
  }
});

test('every shipped bucket is a sane quota', () => {
  for (const [name, rule] of Object.entries(RATE_LIMITS)) {
    assert.ok(rule.limit >= 1, `${name} allows at least one attempt`);
    assert.ok(rule.windowMs > 0, `${name} has a real window`);
    assert.ok(rule.windowMs <= 60 * 60_000, `${name} does not hold a grudge past an hour`);
  }
});

test('the caller identity prefers the first forwarded address', () => {
  const forwarded = new Request('http://localhost/api', {
    headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' },
  });
  assert.equal(clientAddress(forwarded), '203.0.113.9');

  const bare = new Request('http://localhost/api');
  assert.equal(clientAddress(bare), 'local', 'a missing header is a stable placeholder');
});

test('the refusal response tells a client how long to wait', async () => {
  const response = tooManyResponse(42);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Retry-After'), '42');
  assert.equal(
    response.headers.get('Cache-Control'),
    'no-store',
    'a quota refusal must never be cached',
  );

  const body = (await response.json()) as { message?: string; retryAfterSeconds?: number };
  assert.match(body.message ?? '', /too many attempts/i);
  assert.equal(body.retryAfterSeconds, 42);
});
