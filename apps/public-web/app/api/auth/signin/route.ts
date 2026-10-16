import { cookies } from 'next/headers';
import { authenticateUser, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth';
import {
  FORBIDDEN_CROSS_SITE,
  MALFORMED_BODY,
  isSameOrigin,
  jsonResponse,
  readJsonBody,
} from '@/lib/http';
import { clientAddress, consume, tooManyResponse } from '@/lib/rate-limit';
import { readString } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  const body = await readJsonBody(request);
  if (!body) return jsonResponse(MALFORMED_BODY, 400);

  const email = readString(body.email);
  const password = readString(body.password);

  const errors: Record<string, string> = {};
  if (!email.trim()) errors.email = 'Enter your email address.';
  if (!password) errors.password = 'Enter your password.';
  if (Object.keys(errors).length > 0) {
    return jsonResponse({ message: 'Check the highlighted fields.', errors }, 400);
  }

  /*
   * Two counters before the hash is even computed: one per address+email pair,
   * which stops a stuffing run against one account, and one per address, which
   * stops a spread run across many accounts from one source. Both answer the
   * same way — an attacker cannot use the refusal to learn which part tripped.
   */
  const address = clientAddress(request);
  const byPair = consume('signin', `${address}:${email.trim().toLowerCase()}`);
  if (!byPair.ok) return tooManyResponse(byPair.retryAfterSeconds);
  const byAddress = consume('signinPerAddress', address);
  if (!byAddress.ok) return tooManyResponse(byAddress.retryAfterSeconds);

  const result = await authenticateUser(email, password);
  if (!result) {
    const message = 'That email and password do not match an account.';
    return jsonResponse({ message, errors: { password: message } }, 401);
  }

  (await cookies()).set(SESSION_COOKIE, result.token, sessionCookieOptions());
  return jsonResponse({ account: result.account }, 200);
}
