import { requireServMate } from '@/lib/auth';
import { FORBIDDEN_CROSS_SITE, guarded, isSameOrigin, jsonResponse, readJsonBody } from '@/lib/http';
import { submitOffer } from '@/lib/offers';
import { consume, tooManyResponse } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/servmate/me/available-jobs/:jobId/offers — offer on a job.
 *
 * The provider's identity comes from the session; the amount is an integer
 * number of centavos. Eligibility is re-checked by the discovery rule itself, so
 * a job this provider may not see answers 404 rather than confirming it exists.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  return guarded(async () => {
    const servmate = await requireServMate();

    // One live offer per provider per job is already the rule; this counts
    // attempts, so hammering the endpoint cannot become a job-market flood.
    const offer = consume('offerSubmit', servmate.id);
    if (!offer.ok) return tooManyResponse(offer.retryAfterSeconds);

    const { jobId } = await context.params;
    const body = await readJsonBody(request);
    if (!body) return jsonResponse({ message: 'Send a JSON object as the request body.' }, 400);

    const result = await submitOffer({
      jobPostId: jobId,
      userId: servmate.id,
      servmateProfileId: servmate.servmateProfileId,
      body,
    });

    if (result.ok) return jsonResponse({ offer: result.offer }, 201);

    if (result.error === 'invalid') {
      return jsonResponse({ message: 'Check the highlighted fields.', errors: result.errors }, 400);
    }
    if (result.error === 'job_not_found' || result.error === 'not_eligible') {
      return jsonResponse({ message: 'That job was not found.' }, 404);
    }
    if (result.error === 'self_offer') {
      return jsonResponse(
        { message: 'You cannot offer on your own job.', errors: { job: 'That is your own job.' } },
        409,
      );
    }
    if (result.error === 'already_offered') {
      return jsonResponse(
        {
          message: 'You already have an offer on this job. Withdraw it first to change your price.',
          errors: { offer: 'An offer is already pending.' },
        },
        409,
      );
    }
    return jsonResponse({ message: 'That job is no longer open for offers.' }, 409);
  });
}
