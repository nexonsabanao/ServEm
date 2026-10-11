import { revokeOtherSessions } from '@/lib/account';
import { getSessionAccount, getSessionToken } from '@/lib/auth';
import { FORBIDDEN_CROSS_SITE, isSameOrigin, jsonResponse } from '@/lib/http';

export const dynamic = 'force-dynamic';

/**
 * Ends every session for the account except this browser's.
 *
 * Scoped to the session's own user id, so it can only ever end the caller's own
 * sessions. Useful after signing in on a shared device.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  const account = await getSessionAccount();
  if (!account) return jsonResponse({ message: 'Sign in to manage your sessions.' }, 401);

  const token = await getSessionToken();
  if (!token) return jsonResponse({ message: 'Sign in to manage your sessions.' }, 401);

  const ended = await revokeOtherSessions(account.id, token);
  return jsonResponse({ ok: true, otherSessionsEnded: ended }, 200);
}
