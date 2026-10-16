import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { emailConfigured, passwordResetEmail, sendEmail } from './email';
import { normaliseEmail } from './passwords';
import { hashPassword } from './passwords';
import { query, transact, type PasswordResetRecord } from './store';

/**
 * Password recovery over email.
 *
 * Four rules hold this together, and each of them is a thing that is usually
 * got wrong:
 *
 * 1. **The token is never stored.** Only its SHA-256 digest is, so the data file
 *    (or a copy of it) cannot be turned back into a working reset link.
 * 2. **It works once.** The row is deleted inside the same transaction that
 *    changes the password, so a second visit with the same link finds nothing.
 * 3. **The answer never depends on the account.** An address with no account, an
 *    account that signs in through a provider, and a real account all get the
 *    same reply. Whether a mail was actually sent is a server-side fact.
 * 4. **A reset ends every session.** The whole point is that the old credential
 *    is gone, so anything that was signed in with it stops being signed in.
 *
 * What is deliberately *not* here: a rate limit. The endpoints are same-origin
 * checked and the response is uniform, so a hostile script learns nothing, but it
 * could still make the server send a lot of mail. That belongs with the other
 * throttles, and it is recorded in the roadmap rather than half-built here.
 */

export const RESET_TTL_MINUTES = 60;
const RESET_TTL_MS = RESET_TTL_MINUTES * 60 * 1000;

/** Long enough that guessing is hopeless; shown to nobody. */
const TOKEN_BYTES = 32;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export type ResetRequest =
  /** A link was generated and handed to the mail channel. */
  | { ok: true; delivery: 'sent' }
  /** Answered identically to `sent`; recorded here so the reason is not lost. */
  | { ok: true; delivery: 'no_account' }
  /** The server has no mail channel configured. */
  | { ok: false; error: 'not_configured' };

/**
 * Starts a recovery.
 *
 * `baseUrl` is resolved by the caller from configuration, never from a request
 * header — a reset link built from a spoofed Host would send the token to the
 * attacker.
 */
export async function requestPasswordReset(input: {
  email: string;
  baseUrl: string;
}): Promise<ResetRequest> {
  if (!emailConfigured()) return { ok: false, error: 'not_configured' };

  const email = normaliseEmail(input.email);
  const user = await query(
    (database) => database.users.find((candidate) => candidate.email === email) ?? null,
  );

  // An address with no account, and an account that has no password to recover,
  // are both answered exactly like a successful send.
  if (!user || !user.passwordHash) return { ok: true, delivery: 'no_account' };

  const token = randomBytes(TOKEN_BYTES).toString('hex');
  const record: PasswordResetRecord = {
    id: randomUUID(),
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + RESET_TTL_MS).toISOString(),
    createdAt: new Date().toISOString(),
  };

  await transact((database) => {
    const now = Date.now();
    // Drop anything expired, and every live link for this account: asking for a
    // new one invalidates the previous one, so an older mail cannot be replayed.
    database.passwordResets = database.passwordResets.filter(
      (reset) => new Date(reset.expiresAt).getTime() > now && reset.userId !== user.id,
    );
    database.passwordResets.push(record);
  });

  const link = `${input.baseUrl}/reset?token=${token}`;
  const message = passwordResetEmail(link, RESET_TTL_MINUTES);
  const sent = await sendEmail({ to: user.email, subject: message.subject, text: message.text });

  if (!sent.ok) {
    // The token must not outlive a delivery that never happened, or a retry
    // would leave a stale link sitting in the database.
    await transact((database) => {
      database.passwordResets = database.passwordResets.filter((reset) => reset.id !== record.id);
    });
    if (sent.error === 'not_configured') return { ok: false, error: 'not_configured' };
    // A provider refusal is reported as a send here so the HTTP reply stays
    // uniform; the reason belongs in the log, not in the response.
    console.error('password reset email was refused by the provider');
  }

  return { ok: true, delivery: 'sent' };
}

export type ResetCompletion =
  | { ok: true }
  /** Unknown, already used, or expired — the caller cannot tell which, and does not need to. */
  | { ok: false; error: 'invalid_token' };

/**
 * Redeems a token and sets a new password.
 *
 * Everything happens in one transaction: the hash is rotated, every remaining
 * reset link for the account is deleted, and every session is ended. A
 * half-applied reset — new password, old sessions still live — is the failure
 * this ordering exists to prevent.
 */
export async function completePasswordReset(input: {
  token: string;
  password: string;
}): Promise<ResetCompletion> {
  const tokenHash = hashToken(input.token);
  const passwordHash = await hashPassword(input.password);

  return transact((database) => {
    const now = Date.now();
    database.passwordResets = database.passwordResets.filter(
      (reset) => new Date(reset.expiresAt).getTime() > now,
    );

    const reset = database.passwordResets.find((candidate) => candidate.tokenHash === tokenHash);
    if (!reset) return { ok: false as const, error: 'invalid_token' as const };

    const user = database.users.find((candidate) => candidate.id === reset.userId);
    if (!user) return { ok: false as const, error: 'invalid_token' as const };

    user.passwordHash = passwordHash;
    database.passwordResets = database.passwordResets.filter(
      (candidate) => candidate.userId !== user.id,
    );
    database.sessions = database.sessions.filter((session) => session.userId !== user.id);

    return { ok: true as const };
  });
}

/**
 * Whether a token is worth showing a form for, without spending it.
 *
 * The page uses this to render "link expired" instead of a password box that
 * cannot work. It is a courtesy for the honest visitor, not a security check:
 * redeeming the token is still the only thing that changes a password.
 */
export async function resetTokenIsLive(token: string): Promise<boolean> {
  if (!token) return false;
  const tokenHash = hashToken(token);
  return query((database) => {
    const now = Date.now();
    return database.passwordResets.some(
      (reset) => reset.tokenHash === tokenHash && new Date(reset.expiresAt).getTime() > now,
    );
  });
}
