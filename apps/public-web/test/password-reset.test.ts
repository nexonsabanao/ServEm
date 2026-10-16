import { mkdtempSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Password recovery.
 *
 * The properties worth breaking are the usual four: no account enumeration, no
 * plaintext token on disk, no second use of a link, and no session left alive
 * after the credential that opened it has changed.
 *
 * Mail is captured rather than sent. `lib/email.ts` posts to Resend with a real
 * `fetch`, so these tests replace `globalThis.fetch` and read the message out of
 * the request the channel was about to make — the assertion that the token
 * appears in the mail but not in the store is the whole point of hashing it.
 */

process.env.SERVEM_DATA_DIR = mkdtempSync(path.join(tmpdir(), 'servem-reset-'));
process.env.SERVEM_SEED = '0';
process.env.RESEND_API_KEY = 'test-key-not-a-real-one';

const BASE = 'http://127.0.0.1:3100';

const { requestPasswordReset, completePasswordReset, resetTokenIsLive } = await import(
  '../lib/password-reset.ts'
);
const { hashPassword, verifyPassword } = await import('../lib/passwords.ts');
const { query, transact } = await import('../lib/store.ts');

type Mail = { to: string; subject: string; text: string };

const mail: Mail[] = [];
const realFetch = globalThis.fetch;

globalThis.fetch = (async (_input: unknown, init?: { body?: unknown }) => {
  if (typeof init?.body === 'string') mail.push(JSON.parse(init.body) as Mail);
  return { ok: true, json: async () => ({ id: 'captured' }) } as Response;
}) as typeof fetch;

test.after(() => {
  globalThis.fetch = realFetch;
  delete process.env.RESEND_API_KEY;
});

async function makeUser(overrides: { id: string; password?: string; oauthOnly?: boolean }) {
  const email = `${overrides.id}@example.test`;
  await transact((database) => {
    database.users.push({
      id: overrides.id,
      name: 'Reset Test',
      email,
      ...(overrides.oauthOnly
        ? { identities: [{ provider: 'google', subject: overrides.id, linkedAt: new Date().toISOString() }] }
        : overrides.password
          ? { passwordHash: '' }
          : {}),
      createdAt: new Date().toISOString(),
    });
  });
  if (!overrides.oauthOnly && overrides.password) {
    const passwordHash = await hashPassword(overrides.password);
    await transact((database) => {
      const user = database.users.find((candidate) => candidate.id === overrides.id);
      if (user) user.passwordHash = passwordHash;
    });
  }
  return email;
}

function tokenIn(mailBody: Mail): string {
  const match = /\/reset\?token=([0-9a-f]{64})/.exec(mailBody.text);
  assert.ok(match, 'the mail should carry a reset link');
  return match[1];
}

test('an address with an account and one without are answered the same', async () => {
  const known = await makeUser({ id: 'reset-known', password: 'original-password-1' });
  const before = mail.length;

  const real = await requestPasswordReset({ email: known, baseUrl: BASE });
  const missing = await requestPasswordReset({ email: 'nobody@example.test', baseUrl: BASE });

  // Both are successes. The distinction lives only in the module's own result
  // type; the HTTP route returns 202 for both.
  assert.equal(real.ok, true);
  assert.equal(missing.ok, true);

  assert.equal(mail.length, before + 1, 'only the real address produced a message');
  assert.equal(mail[before].to, known);

  const rows = await query((database) => database.passwordResets);
  assert.equal(
    rows.filter((reset) => reset.userId === 'reset-known').length,
    1,
    'exactly one row for the address that has an account',
  );
  assert.equal(
    rows.some((reset) => reset.userId.includes('nobody')),
    false,
    'no row for an address with no account',
  );
});

test('only the digest of the token is stored', async () => {
  const email = await makeUser({ id: 'reset-digest', password: 'original-password-2' });
  await requestPasswordReset({ email, baseUrl: BASE });

  const token = tokenIn(mail[mail.length - 1]);
  const stored = await query(
    (database) => database.passwordResets.find((reset) => reset.userId === 'reset-digest') ?? null,
  );

  assert.ok(stored, 'a token row exists');
  assert.notEqual(stored.tokenHash, token, 'the raw token is not stored');
  assert.equal(
    stored.tokenHash,
    createHash('sha256').update(token).digest('hex'),
    'the stored value is the digest of the token that was sent',
  );
});

test('a link works once, then finds nothing', async () => {
  const email = await makeUser({ id: 'reset-single', password: 'original-password-3' });
  await requestPasswordReset({ email, baseUrl: BASE });
  const token = tokenIn(mail[mail.length - 1]);

  assert.equal(await resetTokenIsLive(token), true);

  const first = await completePasswordReset({ token, password: 'brand-new-password-1' });
  assert.deepEqual(first, { ok: true });
  assert.equal(await resetTokenIsLive(token), false);

  const second = await completePasswordReset({ token, password: 'another-password-9' });
  assert.deepEqual(second, { ok: false, error: 'invalid_token' });
});

test('the new password signs in and the old one does not', async () => {
  const email = await makeUser({ id: 'reset-rotate', password: 'original-password-4' });
  await requestPasswordReset({ email, baseUrl: BASE });
  const token = tokenIn(mail[mail.length - 1]);

  // A session opened with the old password, which the reset should end.
  await transact((database) => {
    database.sessions.push({
      token: 'session-before-reset',
      userId: 'reset-rotate',
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
  });

  assert.deepEqual(await completePasswordReset({ token, password: 'brand-new-password-2' }), {
    ok: true,
  });

  const user = await query((database) => database.users.find((item) => item.id === 'reset-rotate'));
  assert.ok(user);
  assert.equal(await verifyPassword('brand-new-password-2', user.passwordHash), true);
  assert.equal(await verifyPassword('original-password-4', user.passwordHash), false);

  const sessions = await query((database) =>
    database.sessions.filter((session) => session.userId === 'reset-rotate'),
  );
  assert.deepEqual(sessions, [], 'every session ends when the credential changes');
});

test('asking again invalidates the link already in the inbox', async () => {
  const email = await makeUser({ id: 'reset-invalidate', password: 'original-password-5' });
  await requestPasswordReset({ email, baseUrl: BASE });
  const firstToken = tokenIn(mail[mail.length - 1]);

  await requestPasswordReset({ email, baseUrl: BASE });
  const secondToken = tokenIn(mail[mail.length - 1]);
  assert.notEqual(firstToken, secondToken);

  assert.deepEqual(
    await completePasswordReset({ token: firstToken, password: 'brand-new-password-3' }),
    { ok: false, error: 'invalid_token' },
    'the superseded link no longer works',
  );
  assert.deepEqual(
    await completePasswordReset({ token: secondToken, password: 'brand-new-password-4' }),
    { ok: true },
    'the newest link does',
  );
});

test('an expired link is refused like an unknown one', async () => {
  const email = await makeUser({ id: 'reset-expired', password: 'original-password-6' });
  await requestPasswordReset({ email, baseUrl: BASE });
  const token = tokenIn(mail[mail.length - 1]);

  await transact((database) => {
    const row = database.passwordResets.find((reset) => reset.userId === 'reset-expired');
    if (row) row.expiresAt = new Date(Date.now() - 1000).toISOString();
  });

  assert.equal(await resetTokenIsLive(token), false);
  assert.deepEqual(
    await completePasswordReset({ token, password: 'brand-new-password-5' }),
    { ok: false, error: 'invalid_token' },
    'expired and unknown are the same refusal',
  );
});

test('an account with no password is answered like any other address', async () => {
  const email = await makeUser({ id: 'reset-oauth', oauthOnly: true });
  const before = mail.length;

  const result = await requestPasswordReset({ email, baseUrl: BASE });

  assert.deepEqual(result, { ok: true, delivery: 'no_account' });
  assert.equal(mail.length, before, 'no mail, because there is no password to reset');
  const rows = await query((database) => database.passwordResets);
  assert.equal(rows.some((reset) => reset.userId === 'reset-oauth'), false);
});

test('without a mail channel nothing is queued and nothing is discovered', async () => {
  delete process.env.RESEND_API_KEY;
  try {
    const email = await makeUser({ id: 'reset-nochannel', password: 'original-password-7' });
    const before = mail.length;

    const result = await requestPasswordReset({ email, baseUrl: BASE });

    assert.deepEqual(result, { ok: false, error: 'not_configured' });
    assert.equal(mail.length, before);
    const rows = await query((database) => database.passwordResets);
    assert.equal(rows.some((reset) => reset.userId === 'reset-nochannel'), false);
  } finally {
    process.env.RESEND_API_KEY = 'test-key-not-a-real-one';
  }
});

test('a refusal from the mail channel leaves no live token behind', async () => {
  const email = await makeUser({ id: 'reset-refused', password: 'original-password-8' });
  globalThis.fetch = (async () =>
    ({ ok: false, json: async () => ({}) }) as Response) as typeof fetch;

  try {
    const result = await requestPasswordReset({ email, baseUrl: BASE });
    assert.equal(result.ok, true, 'the reply is uniform even when the send fails');
    const rows = await query((database) => database.passwordResets);
    assert.equal(
      rows.some((reset) => reset.userId === 'reset-refused'),
      false,
      'a token that was never delivered is not left in the store',
    );
  } finally {
    globalThis.fetch = (async (_input: unknown, init?: { body?: unknown }) => {
      if (typeof init?.body === 'string') mail.push(JSON.parse(init.body) as Mail);
      return { ok: true, json: async () => ({ id: 'captured' }) } as Response;
    }) as typeof fetch;
  }
});
