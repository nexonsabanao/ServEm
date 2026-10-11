import { cookies } from 'next/headers';
import { authenticateUser, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth';
import {
  FORBIDDEN_CROSS_SITE,
  MALFORMED_BODY,
  isSameOrigin,
  jsonResponse,
  readJsonBody,
} from '@/lib/http';
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

  const result = await authenticateUser(email, password);
  if (!result) {
    const message = 'That email and password do not match an account.';
    return jsonResponse({ message, errors: { password: message } }, 401);
  }

  (await cookies()).set(SESSION_COOKIE, result.token, sessionCookieOptions());
  return jsonResponse({ account: result.account }, 200);
}
