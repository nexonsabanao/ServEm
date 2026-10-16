import { requireServMate } from '@/lib/auth';
import { FORBIDDEN_CROSS_SITE, guarded, isSameOrigin, jsonResponse } from '@/lib/http';
import { withdrawOffer } from '@/lib/offers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/servmate/me/offers/:offerId/withdraw — take back your own offer.
 *
 * A job left without any pending offer returns to `open`, so it reappears in the
 * feed it was withdrawn from.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ offerId: string }> },
) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  return guarded(async () => {
    const servmate = await requireServMate();
    const { offerId } = await context.params;
    const result = await withdrawOffer(offerId, servmate.servmateProfileId);

    if (!result.ok) {
      if (result.error === 'not_pending') {
        return jsonResponse({ message: 'That offer is no longer pending.' }, 409);
      }
      return jsonResponse({ message: 'That offer was not found.' }, 404);
    }
    return jsonResponse({ offer: result.offer }, 200);
  });
}
