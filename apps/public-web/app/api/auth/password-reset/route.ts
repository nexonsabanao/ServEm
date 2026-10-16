import { resolveAppOrigin } from '@/lib/origin';
import {
  FORBIDDEN_CROSS_SITE,
  MALFORMED_BODY,
  isSameOrigin,
  jsonResponse,
  readJsonBody,
} from '@/lib/http';
import { requestPasswordReset } from '@/lib/password-reset';
import { clientAddress, consume, tooManyResponse } from '@/lib/rate-limit';
import { readString, validateEmail } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/**
 * Starts a password recovery.
 *
 * The reply does not depend on whether the address has an account: a missing
 * address, an account that signs in through a provider, and a delivered link are
 * all answered with the same `202`, so the endpoint cannot be used to test which
 * addresses are registered. The two conditions that do produce an error are
 * global rather than per-account — no mail channel, and no origin the link may
 * be built from — so they reveal nothing about the address that was sent.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  const body = await readJsonBody(request);
  if (!body) return jsonResponse(MALFORMED_BODY, 400);

  const email = readString(body.email);
  const emailError = validateEmail(email);
  if (emailError) return jsonResponse({ message: emailError, errors: { email: emailError } }, 400);

  /*
   * Recovery is the endpoint an attacker uses to test which addresses are
   * registered and to spend someone else's mail budget, so it carries the
   * tightest pair of counters: five per address+email, sixty per client
   * address across every email. Both refuse identically, so neither can be
   * used to enumerate accounts.
   */
  const address = clientAddress(request);
  const perEmail = consume('passwordReset', `${address}:${email.trim().toLowerCase()}`);
  if (!perEmail.ok) return tooManyResponse(perEmail.retryAfterSeconds);
  const perAddress = consume('passwordResetPerAddress', address);
  if (!perAddress.ok) return tooManyResponse(perAddress.retryAfterSeconds);

  // The link is built from configuration, never from the request's Host: a
  // spoofed host would otherwise hand the token to whoever controlled it. Local
  // development has no configured origin by default, so it falls back to the
  // request — which is only safe because it cannot happen in production, where
  // `resolveAppOrigin` refuses without APP_ORIGIN.
  const baseUrl = resolveAppOrigin() ?? localOrigin(request);
  if (!baseUrl) {
    return jsonResponse({ message: 'Password recovery is not configured on this server yet.' }, 503);
  }

  const result = await requestPasswordReset({ email, baseUrl });
  if (!result.ok) {
    return jsonResponse({ message: 'Password recovery is not configured on this server yet.' }, 503);
  }

  return jsonResponse({ ok: true }, 202);
}

/** The caller's own origin, used only where the server has no configured one. */
function localOrigin(request: Request): string | null {
  if (process.env.NODE_ENV === 'production') return null;
  try {
    return new URL(request.url).origin;
  } catch {
    return null;
  }
}
