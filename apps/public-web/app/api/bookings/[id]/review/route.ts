import { getSessionAccount } from '@/lib/auth';
import {
  FORBIDDEN_CROSS_SITE,
  MALFORMED_BODY,
  isSameOrigin,
  jsonResponse,
  readJsonBody,
} from '@/lib/http';
import { submitReview } from '@/lib/reviews';

export const dynamic = 'force-dynamic';

/**
 * POST /api/bookings/:id/review — the customer rates the completed work.
 *
 * Only the booking's own customer, only once, and only once the work is actually
 * complete; `submitReview` decides all three from stored rows (blueprint §10.9).
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  const account = await getSessionAccount();
  if (!account) {
    return jsonResponse({ message: 'Sign in to review this work.' }, 401);
  }

  const body = await readJsonBody(request);
  if (!body) return jsonResponse(MALFORMED_BODY, 400);

  const { id } = await context.params;
  const result = await submitReview({
    bookingId: id,
    reviewerUserId: account.id,
    rating: body.rating,
    comment: body.comment,
  });

  if (!result.ok) {
    if (result.error === 'invalid') {
      return jsonResponse(
        { message: 'Check the highlighted fields.', errors: result.errors },
        400,
      );
    }
    if (result.error === 'not_reviewable') {
      return jsonResponse(
        {
          message: 'This work cannot be reviewed yet.',
          errors: { status: 'You can review it once it is complete.' },
        },
        409,
      );
    }
    return jsonResponse({ message: 'That booking was not found.' }, 404);
  }

  return jsonResponse({ review: result.review }, 201);
}
