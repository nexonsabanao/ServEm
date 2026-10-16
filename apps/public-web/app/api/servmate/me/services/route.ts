import { requireServMate } from '@/lib/auth';
import { FORBIDDEN_CROSS_SITE, guarded, isSameOrigin, jsonResponse, readJsonBody } from '@/lib/http';
import { createListing, listOwnListings } from '@/lib/servmate-profile';

export const dynamic = 'force-dynamic';

/** GET /api/servmate/me/services — the caller's own listings, drafts included. */
export async function GET() {
  return guarded(async () => {
    const account = await requireServMate();
    const listings = await listOwnListings(account.id);
    return jsonResponse({ listings }, 200);
  });
}

/**
 * POST /api/servmate/me/services — create a listing on the caller's profile.
 *
 * The listing starts as a draft: publishing is a separate, deliberate act,
 * because a listing is what the public storefront shows (§5.4).
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  return guarded(async () => {
    const account = await requireServMate();
    const body = await readJsonBody(request);
    if (!body) return jsonResponse({ message: 'Send a JSON object as the request body.' }, 400);

    const result = await createListing(account.id, body);
    if (result.ok) return jsonResponse({ listing: result.listing }, 201);
    if (result.error === 'invalid') {
      return jsonResponse({ message: 'Check the highlighted fields.', errors: result.errors }, 400);
    }
    return jsonResponse({ message: 'That account has no ServMate profile.' }, 404);
  });
}
