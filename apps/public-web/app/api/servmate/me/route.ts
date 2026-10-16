import { requireServMate } from '@/lib/auth';
import { FORBIDDEN_CROSS_SITE, guarded, isSameOrigin, jsonResponse, readJsonBody } from '@/lib/http';
import { getProviderWorkspace, updateOwnProfile } from '@/lib/servmate-profile';

export const dynamic = 'force-dynamic';

/**
 * GET /api/servmate/me — the caller's own provider profile, as one read.
 *
 * The profile is found through the session, never through a URL parameter, so
 * there is no id to guess and no way to read another provider's workspace.
 */
export async function GET() {
  return guarded(async () => {
    const account = await requireServMate();
    const workspace = await getProviderWorkspace(account.servmateProfileId);
    if (!workspace) return jsonResponse({ message: 'That profile was not found.' }, 404);
    return jsonResponse(workspace, 200);
  });
}

/**
 * PATCH /api/servmate/me — update the caller's own profile facts.
 *
 * A partial edit leaves everything it does not mention alone, and a field sent as
 * an empty string is cleared. Nothing here can change verification status, which
 * is the one field a provider must not be able to assert about themselves.
 */
export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  return guarded(async () => {
    const account = await requireServMate();
    const body = await readJsonBody(request);
    if (!body) return jsonResponse({ message: 'Send a JSON object as the request body.' }, 400);

    const result = await updateOwnProfile(account.id, body);
    if (result.ok) return jsonResponse({ servmateProfileId: result.profileId }, 200);
    if (result.error === 'invalid') {
      return jsonResponse({ message: 'Check the highlighted fields.', errors: result.errors }, 400);
    }
    return jsonResponse({ message: 'That account has no ServMate profile.' }, 404);
  });
}
