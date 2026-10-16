import { requireSession } from '@/lib/auth';
import { FORBIDDEN_CROSS_SITE, guarded, isSameOrigin, jsonResponse } from '@/lib/http';
import { acceptOffer, listOffersForJob } from '@/lib/offers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/jobs/:id/offers/:offerId/accept — book the job with one offer.
 *
 * One transaction: the winning offer is accepted, the others are withdrawn, the
 * job is booked, and the booking stores an immutable snapshot of the agreed
 * amount, scope and schedule (§4.7). Concurrency is handled by the store's single
 * writer, so two simultaneous acceptances cannot both create a booking.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; offerId: string }> },
) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  return guarded(async () => {
    const account = await requireSession();
    const { id, offerId } = await context.params;

    // The job id in the path must be the job the offer belongs to, so a client
    // cannot pair an offer with a different job.
    const offers = await listOffersForJob(id, account.id);
    if (!offers) return jsonResponse({ message: 'That job was not found.' }, 404);
    if (!offers.some((entry) => entry.offer.id === offerId)) {
      return jsonResponse({ message: 'That offer was not found.' }, 404);
    }

    const result = await acceptOffer(offerId, account.id);
    if (result.ok) {
      return jsonResponse({ bookingId: result.bookingId, reference: result.reference }, 201);
    }

    if (result.error === 'offer_not_found' || result.error === 'not_owner') {
      return jsonResponse({ message: 'That offer was not found.' }, 404);
    }
    if (result.error === 'offer_not_pending') {
      return jsonResponse({ message: 'That offer is no longer open.' }, 409);
    }
    if (result.error === 'provider_not_eligible') {
      return jsonResponse(
        { message: 'That ServMate can no longer take this job. Ask them to offer again.' },
        409,
      );
    }
    return jsonResponse({ message: 'That job is no longer open.' }, 409);
  });
}
