import {
  FORBIDDEN_CROSS_SITE,
  MALFORMED_BODY,
  isSameOrigin,
  jsonResponse,
  readJsonBody,
} from '@/lib/http';
import { completePasswordReset } from '@/lib/password-reset';
import { clientAddress, consume, tooManyResponse } from '@/lib/rate-limit';
import { readString, validatePassword } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/**
 * Redeems a recovery link and sets the new password.
 *
 * One refusal covers unknown, expired and already-used tokens. Distinguishing
 * them would let anyone holding a link learn which tokens the server still has,
 * and the person at the other end of a broken link cannot tell the difference
 * anyway: they ask for a new one either way.
 *
 * A successful reset ends every session for the account, which is why this
 * route does not sign the caller in — the session the form came in on is gone
 * the moment the password changes.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  // Token guessing is the threat here: each wrong guess costs an attempt, so a
  // brute-force run against a 256-bit token is refused long before it matters.
  const redeem = consume('passwordResetComplete', clientAddress(request));
  if (!redeem.ok) return tooManyResponse(redeem.retryAfterSeconds);

  const body = await readJsonBody(request);
  if (!body) return jsonResponse(MALFORMED_BODY, 400);

  const token = readString(body.token).trim();
  const password = readString(body.password);

  const errors: Record<string, string> = {};
  if (!token) errors.token = 'That reset link is incomplete. Ask for a new one.';
  const passwordError = validatePassword(password);
  if (passwordError) errors.password = passwordError;

  if (Object.keys(errors).length > 0) {
    return jsonResponse({ message: 'Check the highlighted fields.', errors }, 400);
  }

  const result = await completePasswordReset({ token, password });
  if (!result.ok) {
    const message = 'That link has expired or has already been used. Ask for a new one.';
    return jsonResponse({ message, errors: { token: message } }, 400);
  }

  return jsonResponse({ ok: true }, 200);
}
