import { lockModerator, unlockModerator } from '@/lib/moderation-access';
import { checkModerationToken, moderationConfigured } from '@/lib/moderation';
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

/**
 * One refusal for every reason.
 *
 * Not configured, wrong token, and (on every other route) not unlocked all answer
 * exactly this, so nothing about a deployment or a stored case can be learned
 * from the shape of a refusal.
 */
const NOT_FOUND = { message: 'Not found.' };

/**
 * Unlocking the moderation console.
 *
 * The credential is the deployment's own secret (`SERVEM_MODERATION_TOKEN`), not
 * an account: an operator does not need a ServEm account, and no account can
 * promote itself in here. What the browser is given back is a digest rather than
 * the secret itself, so the cookie cannot be replayed as a credential and
 * rotating the environment variable ends every console session at once.
 *
 * Attempts are counted per client address. Token length is what makes guessing
 * hopeless; the counter is here so a brute-force run is slow and visible rather
 * than free.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);
  if (!moderationConfigured()) return jsonResponse(NOT_FOUND, 404);

  const attempt = consume('moderationSignin', clientAddress(request));
  if (!attempt.ok) return tooManyResponse(attempt.retryAfterSeconds);

  const body = await readJsonBody(request);
  if (!body) return jsonResponse(MALFORMED_BODY, 400);

  const token = readString(body.token);
  if (!checkModerationToken(token)) return jsonResponse(NOT_FOUND, 404);
  if (!(await unlockModerator())) return jsonResponse(NOT_FOUND, 404);

  return jsonResponse({ ok: true }, 200);
}

/**
 * Leaving the console.
 *
 * Always allowed, including when the surface is switched off: clearing a cookie
 * the caller no longer wants is not an operator action, and refusing it would
 * leave a stale credential in a browser.
 */
export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);
  await lockModerator();
  return jsonResponse({ ok: true }, 200);
}
