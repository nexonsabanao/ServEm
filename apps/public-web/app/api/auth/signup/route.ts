import { cookies } from 'next/headers';
import { registerUser, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth';
import {
  FORBIDDEN_CROSS_SITE,
  MALFORMED_BODY,
  isSameOrigin,
  jsonResponse,
  readJsonBody,
} from '@/lib/http';
import { clientAddress, consume, tooManyResponse } from '@/lib/rate-limit';
import { readString, validateEmail, validateName, validatePassword } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  const body = await readJsonBody(request);
  if (!body) return jsonResponse(MALFORMED_BODY, 400);

  const name = readString(body.name);
  const email = readString(body.email);
  const password = readString(body.password);

  const errors: Record<string, string> = {};
  const nameError = validateName(name);
  if (nameError) errors.name = nameError;
  const emailError = validateEmail(email);
  if (emailError) errors.email = emailError;
  const passwordError = validatePassword(password);
  if (passwordError) errors.password = passwordError;

  if (Object.keys(errors).length > 0) {
    return jsonResponse({ message: 'Check the highlighted fields.', errors }, 400);
  }

  // Account creation is limited per client address: one person opening an
  // account does not approach it, and a scripted run cannot mint dozens.
  const addressLimit = consume('signup', clientAddress(request));
  if (!addressLimit.ok) return tooManyResponse(addressLimit.retryAfterSeconds);

  const result = await registerUser({ name, email, password });
  if (!result.ok) {
    const message = 'That email already has a ServEm account. Sign in instead.';
    return jsonResponse({ message, errors: { email: message } }, 409);
  }

  (await cookies()).set(SESSION_COOKIE, result.token, sessionCookieOptions());
  return jsonResponse({ account: result.account }, 201);
}
