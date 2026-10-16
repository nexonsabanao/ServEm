import { requireServMate } from '@/lib/auth';
import { FORBIDDEN_CROSS_SITE, guarded, isSameOrigin, jsonResponse, readJsonBody } from '@/lib/http';
import { setListingPublication } from '@/lib/servmate-profile';

export const dynamic = 'force-dynamic';

/**
 * POST /api/servmate/me/services/:id/publish — show or withdraw a listing.
 *
 * `{ published: false }` withdraws it: it leaves the storefront immediately but
 * keeps its history, so it can be published again. Omitted, the default is to
 * publish, which is what the workbench's one-click action sends.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  return guarded(async () => {
    const account = await requireServMate();
    const { id } = await context.params;
    const body = (await readJsonBody(request)) ?? {};
    const publish = body.published !== false;

    const result = await setListingPublication(account.id, id, publish);
    if (result.ok) return jsonResponse({ listing: result.listing }, 200);
    if (result.error === 'not_found') {
      return jsonResponse({ message: 'That listing was not found.' }, 404);
    }
    return jsonResponse({ message: 'That account has no ServMate profile.' }, 404);
  });
}
