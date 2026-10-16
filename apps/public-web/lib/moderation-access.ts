import { cookies } from 'next/headers';
import { AuthError } from './auth';
import {
  MODERATION_COOKIE,
  MODERATION_TTL_SECONDS,
  evaluateModeratorAccess,
  moderationConfigured,
  moderationCookieDigest,
  moderatorToken,
} from './moderation';

/**
 * The request-scope half of the moderation console.
 *
 * `./moderation` holds the credential's primitives and the case work; this module
 * only reads the cookie and throws the refusal, because `next/headers` exists
 * inside a request and nowhere else. The split is what lets the access decision be
 * asserted directly in the test suite rather than inferred from HTTP responses.
 */

/**
 * The operator, or a `404`.
 *
 * Everything refused here is refused identically — a signed-in customer, an
 * anonymous visitor, and an operator whose token was rotated all get the same
 * answer, and the route layer reuses it for a case that genuinely does not exist.
 */
export async function requireModerator(): Promise<{ label: string }> {
  const access = evaluateModeratorAccess(
    moderatorToken(),
    (await cookies()).get(MODERATION_COOKIE)?.value,
  );
  if (!access.allowed) throw new AuthError(404, 'Not found.');
  return { label: access.label };
}

/** Non-throwing form, for a page that renders the unlock form instead. */
export async function hasModeratorSession(): Promise<boolean> {
  try {
    await requireModerator();
    return true;
  } catch {
    return false;
  }
}

/**
 * Unlocks the console for this browser, or answers `false`.
 *
 * The caller has already checked the token; the check is repeated here so no
 * route can set the cookie without one, and the value written is the digest rather
 * than the token itself.
 */
export async function unlockModerator(): Promise<boolean> {
  const digest = moderationCookieDigest();
  if (!digest) return false;
  (await cookies()).set(MODERATION_COOKIE, digest, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MODERATION_TTL_SECONDS,
  });
  return true;
}

/**
 * Ends this browser's console session.
 *
 * Idempotent and unauthenticated on purpose: clearing a cookie the caller no
 * longer wants is not an operator action, and refusing it would leave a stale
 * credential sitting in a browser when the surface is switched off.
 */
export async function lockModerator(): Promise<void> {
  (await cookies()).delete(MODERATION_COOKIE);
}

/** Whether this deployment has an operator console at all. */
export function moderationGateConfigured(): boolean {
  return moderationConfigured();
}
