import { changePassword, revokeOtherSessions } from '@/lib/account';
import { getSessionAccount, getSessionToken } from '@/lib/auth';
import {
  FORBIDDEN_CROSS_SITE,
  MALFORMED_BODY,
  isSameOrigin,
  jsonResponse,
  readJsonBody,
} from '@/lib/http';
import { readString, validatePassword } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/**
 * Changes the password.
 *
 * The current password is required, so a stolen session cookie is not enough to
 * take over the account. On success every other session for the account is
 * revoked — if the old password had leaked, the sessions opened with it end
 * here. The browser making the request keeps its own session.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  const account = await getSessionAccount();
  if (!account) return jsonResponse({ message: 'Sign in to change your password.' }, 401);

  const body = await readJsonBody(request);
  if (!body) return jsonResponse(MALFORMED_BODY, 400);

  const current = readString(body.current);
  const next = readString(body.next);

  const errors: Record<string, string> = {};
  if (!current) errors.current = 'Enter your current password.';
  const nextError = validatePassword(next);
  if (nextError) errors.next = nextError;
  else if (next === current) errors.next = 'Choose a password you have not used here.';

  if (Object.keys(errors).length > 0) {
    return jsonResponse({ message: 'Check the highlighted fields.', errors }, 400);
  }

  const result = await changePassword(account.id, current, next);
  if (!result.ok) {
    if (result.error === 'wrong_current') {
      const message = 'That is not your current password.';
      return jsonResponse({ message, errors: { current: message } }, 400);
    }
    if (result.error === 'no_password') {
      return jsonResponse(
        {
          message: 'This account signs in with a provider and has no password yet.',
          errors: { current: 'This account has no password to change.' },
        },
        409,
      );
    }
    return jsonResponse({ message: 'That account no longer exists.' }, 404);
  }

  const token = await getSessionToken();
  const revoked = token ? await revokeOtherSessions(account.id, token) : 0;

  return jsonResponse({ ok: true, otherSessionsEnded: revoked }, 200);
}
