import { updateAccountName, updateProfile } from '@/lib/account';
import { getSessionAccount, getSessionProfile } from '@/lib/auth';
import {
  FORBIDDEN_CROSS_SITE,
  MALFORMED_BODY,
  isSameOrigin,
  jsonResponse,
  readJsonBody,
} from '@/lib/http';
import { readProfilePatch } from '@/lib/profile';
import { readString, validateName } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/**
 * Changes the display name and the customer profile.
 *
 * The account is taken from the session cookie, so the body can only ever
 * describe this person's own details, never whose they are. The profile patch
 * is validated field by field and folded onto the stored record, so a client
 * that sends one field cannot blank the rest. Changing the email address is not
 * offered here: it needs a verification flow, which is still an open decision.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  const account = await getSessionAccount();
  if (!account) return jsonResponse({ message: 'Sign in to change your details.' }, 401);

  const body = await readJsonBody(request);
  if (!body) return jsonResponse(MALFORMED_BODY, 400);

  const errors: Record<string, string> = {};

  const name = readString(body.name);
  const nameError = validateName(name);
  if (nameError) errors.name = nameError;

  // The profile fields are optional: a name-only save still works.
  const wantsProfile = 'area' in body || 'about' in body || 'tone' in body;
  const parsed = wantsProfile ? readProfilePatch(body) : null;
  if (parsed && !parsed.ok) Object.assign(errors, parsed.errors);

  if (Object.keys(errors).length > 0) {
    return jsonResponse({ message: 'Check the highlighted fields.', errors }, 400);
  }

  const result = await updateAccountName(account.id, name);
  if (!result.ok) return jsonResponse({ message: 'That account no longer exists.' }, 404);

  let profile = (await getSessionProfile())?.profile;
  if (parsed && parsed.ok && Object.keys(parsed.patch).length > 0) {
    profile = await updateProfile(account.id, parsed.patch) ?? profile;
  }

  return jsonResponse({ account: { ...account, name: result.name }, profile }, 200);
}
