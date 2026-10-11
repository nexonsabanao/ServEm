import { getPreferences, updatePreferences } from '@/lib/account';
import { getSessionAccount } from '@/lib/auth';
import {
  FORBIDDEN_CROSS_SITE,
  MALFORMED_BODY,
  isSameOrigin,
  jsonResponse,
  readJsonBody,
} from '@/lib/http';
import { readPreferencePatch } from '@/lib/preferences';

export const dynamic = 'force-dynamic';

export async function GET() {
  const account = await getSessionAccount();
  if (!account) return jsonResponse({ message: 'Sign in to see your preferences.' }, 401);
  return jsonResponse({ preferences: await getPreferences(account.id) }, 200);
}

/**
 * Stores a partial preference patch.
 *
 * Only known keys with valid values are accepted, and the patch is folded onto
 * the account's current preferences, so a client that sends one field cannot
 * blank the rest.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  const account = await getSessionAccount();
  if (!account) return jsonResponse({ message: 'Sign in to change your preferences.' }, 401);

  const body = await readJsonBody(request);
  if (!body) return jsonResponse(MALFORMED_BODY, 400);

  const parsed = readPreferencePatch(body);
  if (!parsed.ok) {
    return jsonResponse(
      { message: 'Check the highlighted fields.', errors: parsed.errors },
      400,
    );
  }

  const preferences = await updatePreferences(account.id, parsed.patch);
  if (!preferences) return jsonResponse({ message: 'That account no longer exists.' }, 404);

  return jsonResponse({ preferences }, 200);
}
