import { requireSession } from '@/lib/auth';
import { FORBIDDEN_CROSS_SITE, guarded, isSameOrigin, jsonResponse, readJsonBody } from '@/lib/http';
import { onboardServMate } from '@/lib/servmate-profile';

export const dynamic = 'force-dynamic';

/**
 * POST /api/servmate/onboard — enable provider capability on this account.
 *
 * One account may be both a customer and a ServMate (blueprint §1), so this adds
 * a provider profile to the existing account rather than creating a second one.
 * The profile starts active and unverified: it can list and offer, and nothing
 * claims its credentials were checked until a verification process says so.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  return guarded(async () => {
    const account = await requireSession();
    const body = (await readJsonBody(request)) ?? {};
    const { profileId, created } = await onboardServMate(account.id, body);

    if (!profileId) return jsonResponse({ message: 'That account was not found.' }, 404);
    return jsonResponse({ servmateProfileId: profileId, created }, created ? 201 : 200);
  });
}
