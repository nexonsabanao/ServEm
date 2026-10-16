import { requireSession } from '@/lib/auth';
import { FORBIDDEN_CROSS_SITE, guarded, isSameOrigin, jsonResponse } from '@/lib/http';
import { declineOffer } from '@/lib/offers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/jobs/:id/offers/:offerId/decline — pass on one offer.
 *
 * The job stays open with its other offers intact, so a customer narrowing the
 * field does not lose the rest of the field with it.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ offerId: string }> },
) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  return guarded(async () => {
    const account = await requireSession();
    const { offerId } = await context.params;
    const result = await declineOffer(offerId, account.id);

    if (result.ok) return jsonResponse({ offer: result.offer }, 200);
    if (result.error === 'not_found' || result.error === 'not_owner') {
      return jsonResponse({ message: 'That offer was not found.' }, 404);
    }
    return jsonResponse({ message: 'That offer is no longer open.' }, 409);
  });
}
